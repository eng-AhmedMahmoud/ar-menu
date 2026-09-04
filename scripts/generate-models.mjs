#!/usr/bin/env node
/**
 * Image -> 3D pipeline.
 *
 * Reads menu.json, sends each dish photo to an image-to-3D provider, waits for
 * the job, and downloads the resulting .glb (Android Scene Viewer / WebXR) and
 * .usdz (iOS Quick Look) into public/models/.
 *
 * Task ids are cached in .model-cache.json so an interrupted run resumes the
 * same paid jobs instead of starting new ones.
 *
 *   MESHY_API_KEY=... node scripts/generate-models.mjs
 *   node scripts/generate-models.mjs --force            # regenerate everything
 *   node scripts/generate-models.mjs --only burger,pizza
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODELS_DIR = path.join(ROOT, 'public', 'models')
const PHOTOS_DIR = path.join(ROOT, 'public', 'photos')
const CACHE_FILE = path.join(ROOT, '.model-cache.json')

const argv = process.argv.slice(2)
const FORCE = argv.includes('--force')
const ONLY = (() => {
  const i = argv.indexOf('--only')
  return i === -1 ? null : new Set(argv[i + 1].split(',').map((s) => s.trim()))
})()

const PROVIDER = (process.env.MODEL_PROVIDER || 'meshy').toLowerCase()
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = 20 * 60 * 1000

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

async function loadCache() {
  if (!existsSync(CACHE_FILE)) return {}
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

async function saveCache(cache) {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n')
}

async function imageAsDataUri(relPath) {
  const abs = path.join(PHOTOS_DIR, relPath)
  if (!existsSync(abs)) throw new Error(`image not found: ${relPath}`)
  const ext = path.extname(abs).toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new Error(`unsupported image type "${ext}" for ${relPath} (use jpg/png/webp)`)
  const buf = await readFile(abs)
  // Providers cap the inline payload; ~20MB of base64 is well past any of them.
  if (buf.byteLength > 15 * 1024 * 1024) {
    throw new Error(`${relPath} is ${(buf.byteLength / 1e6).toFixed(1)}MB — resize under 15MB`)
  }
  return `data:${mime};base64,${buf.toString('base64')}`
}

function cutoutFor(image) {
  const cut = image.replace(/\.[^.]+$/, '_cut.png')
  return existsSync(path.join(PHOTOS_DIR, cut)) ? cut : image
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

/* ------------------------------- providers ------------------------------- */

const meshy = {
  name: 'Meshy',
  envKey: 'MESHY_API_KEY',
  base: 'https://api.meshy.ai/openapi/v1/image-to-3d',

  headers() {
    return {
      Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
      'Content-Type': 'application/json',
    }
  },

  async createTask(dish) {
    const body = {
      // Prefer the transparent cutout when one exists: a white studio backdrop
      // otherwise gets modelled as a slab welded to the dish.
      image_url: await imageAsDataUri(cutoutFor(dish.image)),
      ai_model: process.env.MESHY_MODEL || 'meshy-7',
      topology: 'triangle',
      // Meshy's own guidance is that the highest-quality mesh comes from
      // should_remesh:false, but that returns ~1.9M faces. Remeshing to 200k
      // keeps the surface detail a dish needs while staying loadable; the
      // earlier 30k target was flattening penne into shards.
      should_remesh: true,
      target_polycount: Number(process.env.MESHY_POLYCOUNT || 200000),
      should_texture: true,
      enable_pbr: true,
      // Finer geometry on meshy-7. Costs 5 extra credits per dish.
      ultra_mode: true,
      // Defaults to "2k" — food reads far better with a denser base colour map.
      texture_resolution: process.env.MESHY_TEXTURE || '4k',
      // texture_prompt / texture_image_url each add 10 credits per task, and the
      // source photo already guides texturing, so the hint is not worth a third
      // more credits per dish.
      target_formats: ["glb", "usdz"],
    }
    const res = await fetch(this.base, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Meshy create failed ${res.status}: ${text}`)
    const json = JSON.parse(text)
    const id = json.result ?? json.id
    if (!id) throw new Error(`Meshy create returned no task id: ${text}`)
    return id
  },

  async getTask(id) {
    const res = await fetch(`${this.base}/${id}`, { headers: this.headers() })
    const text = await res.text()
    if (!res.ok) throw new Error(`Meshy poll failed ${res.status}: ${text}`)
    const t = JSON.parse(text)
    return {
      status: t.status, // PENDING | IN_PROGRESS | SUCCEEDED | FAILED | CANCELED
      progress: t.progress ?? 0,
      error: t.task_error?.message,
      urls: { glb: t.model_urls?.glb, usdz: t.model_urls?.usdz },
      thumbnail: t.thumbnail_url,
    }
  },
}

const tripo = {
  name: 'Tripo3D',
  envKey: 'TRIPO_API_KEY',
  base: 'https://api.tripo3d.ai/v2/openapi',

  headers() {
    return { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` }
  },

  async createTask(dish) {
    const abs = path.join(PHOTOS_DIR, dish.image)
    const ext = path.extname(abs).toLowerCase().replace('.', '')
    const form = new FormData()
    form.append('file', new Blob([await readFile(abs)]), path.basename(abs))
    const up = await fetch(`${this.base}/upload`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
    })
    const upText = await up.text()
    if (!up.ok) throw new Error(`Tripo upload failed ${up.status}: ${upText}`)
    const imageToken = JSON.parse(upText).data?.image_token
    if (!imageToken) throw new Error(`Tripo upload returned no image_token: ${upText}`)

    const res = await fetch(`${this.base}/task`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image_to_model',
        file: { type: ext === 'jpg' ? 'jpeg' : ext, file_token: imageToken },
        texture: true,
        pbr: true,
      }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Tripo create failed ${res.status}: ${text}`)
    const id = JSON.parse(text).data?.task_id
    if (!id) throw new Error(`Tripo create returned no task_id: ${text}`)
    return id
  },

  async getTask(id) {
    const res = await fetch(`${this.base}/task/${id}`, { headers: this.headers() })
    const text = await res.text()
    if (!res.ok) throw new Error(`Tripo poll failed ${res.status}: ${text}`)
    const d = JSON.parse(text).data ?? {}
    const map = { queued: 'PENDING', running: 'IN_PROGRESS', success: 'SUCCEEDED', failed: 'FAILED', cancelled: 'CANCELED', banned: 'FAILED', unknown: 'PENDING' }
    return {
      status: map[d.status] ?? 'PENDING',
      progress: d.progress ?? 0,
      error: d.status === 'failed' ? 'tripo task failed' : undefined,
      // Tripo returns GLB only here; USDZ needs a separate convert task, so iOS
      // falls back to the WebXR viewer rather than Quick Look.
      urls: { glb: d.output?.pbr_model || d.output?.model, usdz: undefined },
      thumbnail: d.output?.rendered_image,
    }
  },
}

const PROVIDERS = { meshy, tripo }

/* --------------------------------- main ---------------------------------- */

async function processDish(provider, dish, cache) {
  const glbPath = path.join(MODELS_DIR, `${dish.slug}.glb`)
  const usdzPath = path.join(MODELS_DIR, `${dish.slug}.usdz`)

  if (!FORCE && existsSync(glbPath)) {
    log(`  ✓ ${dish.slug} — model already downloaded, skipping`)
    return { slug: dish.slug, status: 'cached' }
  }

  let taskId = FORCE ? null : cache[dish.slug]?.taskId
  if (taskId) {
    log(`  ↻ ${dish.slug} — resuming task ${taskId}`)
  } else {
    log(`  → ${dish.slug} — uploading ${dish.image}`)
    taskId = await provider.createTask(dish)
    cache[dish.slug] = { taskId, provider: provider.name, image: dish.image }
    await saveCache(cache)
    log(`    task ${taskId}`)
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS
  let lastProgress = -1
  while (Date.now() < deadline) {
    const t = await provider.getTask(taskId)
    if (t.status === 'SUCCEEDED') {
      if (!t.urls.glb) throw new Error(`${dish.slug}: task succeeded but no glb url`)
      await download(t.urls.glb, glbPath)
      if (t.urls.usdz) await download(t.urls.usdz, usdzPath)
      log(`  ✓ ${dish.slug} — glb${t.urls.usdz ? ' + usdz' : ' (no usdz; iOS uses WebXR fallback)'}`)
      cache[dish.slug] = { ...cache[dish.slug], done: true }
      await saveCache(cache)
      return { slug: dish.slug, status: 'generated', usdz: Boolean(t.urls.usdz) }
    }
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      delete cache[dish.slug]
      await saveCache(cache)
      throw new Error(`${dish.slug}: task ${t.status}${t.error ? ` — ${t.error}` : ''}`)
    }
    if (t.progress !== lastProgress) {
      process.stdout.write(`\r    ${dish.slug}: ${t.status.toLowerCase()} ${t.progress}%   `)
      lastProgress = t.progress
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`${dish.slug}: timed out after ${POLL_TIMEOUT_MS / 60000} min (task ${taskId} still queued — rerun to resume)`)
}

async function main() {
  const provider = PROVIDERS[PROVIDER]
  if (!provider) {
    console.error(`Unknown MODEL_PROVIDER "${PROVIDER}". Use: ${Object.keys(PROVIDERS).join(', ')}`)
    process.exit(1)
  }
  if (!process.env[provider.envKey]) {
    console.error(`Missing ${provider.envKey}.\n\n  export ${provider.envKey}=...\n  pnpm models\n`)
    process.exit(1)
  }

  const menu = JSON.parse(await readFile(path.join(ROOT, 'menu.json'), 'utf8'))
  const dishes = menu.dishes.filter((d) => !ONLY || ONLY.has(d.slug))
  if (!dishes.length) {
    console.error('No dishes matched.')
    process.exit(1)
  }

  await mkdir(MODELS_DIR, { recursive: true })
  const cache = await loadCache()

  log(`\n${provider.name}: ${dishes.length} dish(es)\n`)
  const failures = []
  for (const dish of dishes) {
    try {
      await processDish(provider, dish, cache)
    } catch (err) {
      console.error(`\n  ✗ ${dish.slug} — ${err.message}`)
      failures.push(dish.slug)
    }
  }

  log(`\nDone. ${dishes.length - failures.length}/${dishes.length} succeeded.`)
  if (failures.length) {
    log(`Failed: ${failures.join(', ')}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

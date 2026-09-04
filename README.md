# AR Menu

Photo of a dish in → QR code out. Scanning the QR opens a page where the diner
can spin the dish in 3D and drop it life-size on their actual table — no app
install, it runs in the phone's browser.

## How the pieces fit

```
public/photos/burger.jpg
        │
        │  pnpm models        (image-to-3D API: Meshy or Tripo)
        ▼
public/models/burger.glb   → Android Scene Viewer / WebXR
public/models/burger.usdz  → iOS Quick Look
        │
        │  vercel --prod     (page must be HTTPS; AR refuses http)
        ▼
https://your-menu.app/dish/burger
        │
        │  pnpm qr           (encodes the live URL)
        ▼
public/qr/burger.png  +  /print  → table tents
```

A QR code cannot carry a 3D model — it carries the URL. Everything above exists
to make that URL worth scanning.

## Setup

```bash
pnpm install
cp .env.example .env        # add MESHY_API_KEY
```

Get a key at https://www.meshy.ai/api. Meshy is the default because it returns
`.glb` **and** `.usdz` from one job, so iOS needs no conversion step. Tripo works
too (`MODEL_PROVIDER=tripo`) but returns GLB only — iOS then falls back to the
in-browser WebXR viewer instead of Quick Look.

## Adding dishes

1. Drop the photo in `public/photos/`.
2. Add an entry to `menu.json`:

```json
{
  "slug": "smash-burger",
  "name": "Smash Burger",
  "description": "Double patty, aged cheddar, house sauce.",
  "price": "$14",
  "image": "smash-burger.jpg",
  "tags": ["beef", "contains dairy"]
}
```

3. Generate:

```bash
pnpm models                       # only dishes without a .glb are billed
pnpm models --only smash-burger   # one dish
pnpm models --force               # regenerate everything
```

Task ids land in `.model-cache.json`, so a killed run resumes the same paid job
rather than starting a new one.

### Photo quality drives model quality

- One dish, filling the frame, plain background.
- Shot from ~35–45° above, not straight down — a top-down photo gives the model
  no silhouette to work with and comes back flat.
- Even light, no hard shadow across the plate.
- Crop out cutlery, hands, and other dishes; the mesher will happily model a fork
  into the burger.

## Deploy, then QR

Order matters — the QR encodes the live URL, so generating codes before the
first deploy means reprinting every table tent.

```bash
vercel --prod                                   # note the URL it prints
SITE_URL=https://your-menu.vercel.app pnpm qr
git add public/qr && git commit -m "Add QR codes" && git push
```

Then open `https://your-menu.vercel.app/print` and press ⌘P for the table tents.
Print at 100% scale — scaling down a QR below ~2cm makes it unreliable at
arm's length.

Set `NEXT_PUBLIC_SITE_URL` in the Vercel project too, so Open Graph previews
resolve against the real domain.

## Local dev

```bash
pnpm dev     # https://ar-menu.localhost via portless
```

The 3D turntable works on desktop. The AR placement button only appears on a
phone — iOS Safari (Quick Look) or Android Chrome (Scene Viewer), and only over
HTTPS.

## Costs

Roughly $0.05–0.20 per dish at Meshy's paid tier; the free tier covers a handful.
Generation is one-time per dish — hosting the resulting files is free.

'use client'

import { useEffect, useState } from 'react'

type Props = {
  slug: string
  name: string
  poster: string
  /** False when the provider returned no .usdz — iOS then uses the WebXR path. */
  hasUsdz?: boolean
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
        Record<string, unknown>
    }
  }
}

export default function ArViewer({ slug, name, poster, hasUsdz = true }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // model-viewer registers a custom element and touches `window` at import
    // time, so it can only load in the browser.
    let cancelled = false
    import('@google/model-viewer').then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="viewer">
      {ready ? (
        <model-viewer
          src={`/models/${slug}.glb`}
          ios-src={hasUsdz ? `/models/${slug}.usdz` : undefined}
          alt={`3D model of ${name}`}
          poster={poster}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          camera-controls
          touch-action="pan-y"
          auto-rotate
          auto-rotate-delay={1500}
          rotation-per-second="18deg"
          shadow-intensity="1"
          exposure="1.1"
          environment-image="neutral"
          style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
        >
          <button slot="ar-button" className="ar-button">
            View on your table
          </button>
        </model-viewer>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={name} className="viewer-poster" />
      )}
    </div>
  )
}

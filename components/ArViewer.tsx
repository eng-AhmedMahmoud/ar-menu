"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Variant } from "@/lib/menu";

type Props = {
  dish: Dish;
  variant?: Variant;
  poster: string;
  hasModel: boolean;
  hasUsdz: boolean;
  /** Shown on the native iOS Quick Look banner alongside the dish name. */
  priceLabel: string;
  onOrder: () => void;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > &
        Record<string, unknown>;
    }
  }
}

/**
 * Quick Look is Apple's own viewer — the only UI we can inject is the native
 * bottom banner, configured through fragment params on the .usdz URL. The
 * callToAction tap fires a `ar-status`/message back into the page, which is how
 * "Add to order" can work from inside AR.
 */
function iosSrc(slug: string, name: string, price: string, subtitle: string) {
  const params = new URLSearchParams({
    callToAction: "Add to order",
    checkoutTitle: name,
    checkoutSubtitle: subtitle,
    price,
    // Diners pinch-zooming the dish defeats the point of showing true portion size.
    allowsContentScaling: "0",
  });
  return `/models/${slug}.usdz#${params.toString()}`;
}

export default function ArViewer({
  dish,
  variant,
  poster,
  hasModel,
  hasUsdz,
  priceLabel,
  onOrder,
}: Props) {
  const [ready, setReady] = useState(false);
  const [openSpot, setOpenSpot] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The USDZ banner's call-to-action surfaces as a `quick-look-button-tapped`
  // event on the element once Quick Look closes.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const handler = () => onOrder();
    el.addEventListener("quick-look-button-tapped", handler);
    return () => el.removeEventListener("quick-look-button-tapped", handler);
  }, [ready, onOrder]);

  // Anchors are fractions of the bounding box, so they must be converted to
  // metres once the model reports its real dimensions. Re-runs on dish swap.
  useEffect(() => {
    const el = viewerRef.current as
      | (HTMLElement & {
          getDimensions?: () => { x: number; y: number; z: number };
          getBoundingBoxCenter?: () => { x: number; y: number; z: number };
        })
      | null;
    if (!el || !ready) return;

    const place = () => {
      if (!el.getDimensions || !el.getBoundingBoxCenter) return;
      const dim = el.getDimensions();
      const mid = el.getBoundingBoxCenter();
      const next: Record<string, string> = {};
      for (const spot of dish.hotspots ?? []) {
        if (!spot.anchor) continue;
        const [fx, fy, fz] = spot.anchor.split(/\s+/).map(Number);
        next[spot.id] = [
          mid.x + (fx - 0.5) * dim.x,
          mid.y + (fy - 0.5) * dim.y,
          mid.z + (fz - 0.5) * dim.z,
        ]
          .map((n) => n.toFixed(4))
          .join(" ");
      }
      setResolved(next);
    };

    el.addEventListener("load", place);
    place();
    return () => el.removeEventListener("load", place);
  }, [ready, dish]);

  const scale = variant?.scale ?? 1;

  if (!ready || !hasModel) {
    return (
      <div className="viewer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt={dish.name} className="viewer-poster" />
        {!hasModel && ready ? (
          <p className="viewer-note">3D model not generated yet</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="viewer">
      <model-viewer
        ref={viewerRef as never}
        key={dish.slug}
        src={`/models/${dish.slug}.glb`}
        ios-src={
          hasUsdz
            ? iosSrc(dish.slug, dish.name, priceLabel, dish.description)
            : undefined
        }
        alt={`3D model of ${dish.name}`}
        poster={poster}
        scale={`${scale} ${scale} ${scale}`}
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        ar-placement="floor"
        camera-controls
        touch-action="pan-y"
        auto-rotate
        auto-rotate-delay={2000}
        rotation-per-second="16deg"
        interaction-prompt="none"
        min-camera-orbit="auto 25deg auto"
        max-camera-orbit="auto 95deg auto"
        shadow-intensity="1.1"
        shadow-softness="0.8"
        exposure="1.15"
        environment-image="neutral"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
        }}
      >
        {(dish.hotspots ?? [])
          .filter((spot) => resolved[spot.id] || spot.position)
          .map((spot) => (
            <button
              key={spot.id}
              slot={`hotspot-${spot.id}`}
              className={`hotspot${openSpot === spot.id ? " hotspot-open" : ""}`}
              data-position={resolved[spot.id] ?? spot.position ?? "0 0 0"}
              data-normal={spot.normal}
              data-visibility-attribute="visible"
              onClick={() => setOpenSpot(openSpot === spot.id ? null : spot.id)}
              aria-label={spot.label}
            >
              <span className="hotspot-dot" />
              <span className="hotspot-card">
                <strong>{spot.label}</strong>
                <em>{spot.detail}</em>
              </span>
            </button>
          ))}

        <button slot="ar-button" className="ar-button">
          View on your table
        </button>
      </model-viewer>
    </div>
  );
}

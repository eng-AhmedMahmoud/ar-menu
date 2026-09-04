"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Variant } from "@/lib/menu";
import { useSettings } from "./Settings";
import { dishDesc, dishName, spotDetail, spotLabel } from "@/lib/i18n";

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
function iosSrc(
  slug: string,
  name: string,
  price: string,
  subtitle: string,
  cta: string,
) {
  const params = new URLSearchParams({
    callToAction: cta,
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
  const { lang, s: txt } = useSettings()
  const [ready, setReady] = useState(false);
  const [openSpot, setOpenSpot] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [canAR, setCanAR] = useState(false);
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

  // Swapping dishes replaces the element, so the new model starts unloaded.
  useEffect(() => {
    setLoaded(false);
  }, [dish.slug, variant?.id]);

  // `loaded` gates the framing pass, and canActivateAR decides whether an AR
  // button is worth showing at all — it is false on desktop, where the button
  // would only mislead. Both settle asynchronously after model-viewer probes
  // the platform, so the flag is polled briefly rather than read once.
  useEffect(() => {
    const el = viewerRef.current as
      | (HTMLElement & { loaded?: boolean; canActivateAR?: boolean })
      | null;
    if (!el || !ready) return;

    const syncLoaded = () => setLoaded(true);
    const syncAR = () => setCanAR(Boolean(el.canActivateAR));

    if (el.loaded) syncLoaded();
    syncAR();
    el.addEventListener("load", syncLoaded);
    el.addEventListener("ar-status", syncAR);
    const probe = window.setInterval(syncAR, 400);
    const stop = window.setTimeout(() => window.clearInterval(probe), 5000);

    return () => {
      window.clearInterval(probe);
      window.clearTimeout(stop);
      el.removeEventListener("load", syncLoaded);
      el.removeEventListener("ar-status", syncAR);
    };
  }, [ready, dish.slug, variant?.id]);



  // Applied as an attribute at mount rather than mutated afterwards: changing
  // `scale` on a live model-viewer throws inside its own onUpdateScene and
  // leaves the canvas blank, so the element is keyed on the variant instead and
  // simply remounts with the correct size.
  const scale = variant?.scale ?? 1;

  // Auto-framing runs against the unscaled model, so a scaled-up variant ends
  // up clipped by a camera fitted to the smaller one. camera-orbit is safe to
  // mutate (unlike scale), so the radius is derived from the real dimensions
  // once the model reports them.
  useEffect(() => {
    const el = viewerRef.current as (HTMLElement & {
      getDimensions?: () => { x: number; y: number; z: number };
    }) | null;
    if (!el || !loaded || !el.getDimensions) return;
    const d = el.getDimensions();
    const reach = Math.max(d.x, d.y, d.z) * 1.9;
    el.setAttribute("camera-orbit", `0deg 72deg ${reach.toFixed(3)}m`);
    el.setAttribute("min-camera-orbit", `auto 25deg ${(reach * 0.55).toFixed(3)}m`);
    el.setAttribute("max-camera-orbit", `auto 95deg ${(reach * 2.2).toFixed(3)}m`);
  }, [loaded, scale]);

  if (!ready || !hasModel) {
    return (
      <div className="viewer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt={dish.name} className="viewer-poster" />
        {!hasModel && ready ? (
          <p className="viewer-note">{txt.noModel}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="viewer">
      <model-viewer
        ref={viewerRef as never}
        key={`${dish.slug}:${variant?.id ?? "base"}`}
        src={`/models/${dish.slug}.glb`}
        ios-src={
          hasUsdz
            ? iosSrc(dish.slug, dishName(dish, lang), priceLabel, dishDesc(dish, lang), txt.addToOrder)
            : undefined
        }
        scale={`${scale} ${scale} ${scale}`}
        alt={dishName(dish, lang)}
        poster={poster}
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
              aria-label={spotLabel(spot, lang)}
            >
              <span className="hotspot-dot" />
              <span className="hotspot-card">
                <strong>{spot.label}</strong>
                <em>{spot.detail}</em>
              </span>
            </button>
          ))}
      </model-viewer>

      {canAR ? (
        <button
          type="button"
          className="ar-button"
          onClick={() =>
            (
              viewerRef.current as unknown as { activateAR?: () => void } | null
            )?.activateAR?.()
          }
        >
          {txt.viewOnTable}
        </button>
      ) : null}
    </div>
  );
}

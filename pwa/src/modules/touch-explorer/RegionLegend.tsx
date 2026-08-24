/**
 * RegionLegend — Lists the explorable region types on the touch surface
 * (heading, link, button, image) with a colour chip, glyph, and live count.
 *
 * Rows are focusable buttons: activating one announces how many of that
 * region type exist and where the first one sits in reading order, so
 * keyboard users get a mental map before exploring. A polite live region
 * mirrors the summary for screen readers.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { countRegions, totalRegionCount } from "./regionStats";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { sectionCard } from "@/components/PageShell";

interface RegionLegendProps {
  /** The exploration container whose descendants are counted. */
  containerRef: React.RefObject<HTMLElement | null>;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

export function RegionLegend({ containerRef }: RegionLegendProps) {
  const announce = useAnnounce();
  const [counts, setCounts] = useState(() => countRegions(null));
  const countedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Wait one frame so the lazily-mounted TouchSurface is in the DOM.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root || root === countedRef.current) return;
      countedRef.current = root;
      setCounts(countRegions(root));
    });
    return () => cancelAnimationFrame(raf);
  }, [containerRef]);

  const total = useMemo(() => totalRegionCount(counts), [counts]);

  const handleSelect = (label: string, plural: string, count: number) => {
    const message =
      count === 0
        ? `No ${plural.toLowerCase()} on this page.`
        : `${count} ${count === 1 ? label.toLowerCase() : plural.toLowerCase()} on this page. Slide onto one to explore it.`;
    announce(message);
    speechEngine.speak(message);
  };

  return (
    <section
      aria-label="Region legend"
      className={`${sectionCard} mt-4`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
        Region legend
      </h2>

      <div aria-live="polite" className="sr-only">
        {total === 0
          ? "No explorable regions found yet."
          : `${total} explorable regions on this page.`}
      </div>

      {total === 0 ? (
        <p className="text-stone-400 text-sm">
          Nothing to explore yet — elements appear here once the page loads.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {counts.map(({ meta, count }) => (
            <li key={meta.role}>
              <button
                type="button"
                onClick={() => handleSelect(meta.label, meta.pluralLabel, count)}
                aria-label={`${meta.pluralLabel}: ${count}. Activate to hear more.`}
                className={`w-full min-h-touch flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-2 px-3 py-2 text-left hover:bg-surface-3 transition-colors ${focusRing}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.chipClass} text-surface-0 text-sm font-bold`}
                >
                  {meta.glyph}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-100 leading-tight">
                    {meta.pluralLabel}
                  </span>
                  <span className="block text-xs text-stone-400 leading-tight">
                    {count}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

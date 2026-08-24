/**
 * Skeleton — loading placeholder blocks for Phase 4 accessibility polish.
 *
 * Purely additive companion to LoadingSpinner: where a spinner already
 * announces "Loading" via role="status", skeletons render as decorative
 * shimmering bars (aria-hidden) so screen readers never hear the layout,
 * only the label. When used standalone it renders its own polite
 * role="status" with an sr-only label.
 *
 * Reduced motion: bars use Tailwind's motion-safe variant so the pulse
 * animation only runs when the user has NOT asked for reduced motion.
 * The global prefers-reduced-motion kill-switch in index.css is the
 * backstop for anything that slips through.
 */

interface SkeletonProps {
  /**
   * sr-only text announced while loading. Ignored when `decorative` is
   * true — use decorative mode when a nearby spinner already announces.
   */
  label?: string;
  /** Number of placeholder bars to render. */
  lines?: number;
  /** Render bars only (no role/status/sr-only text). */
  decorative?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
}

// Varied widths so the placeholder reads as "text is coming", not a grid.
const LINE_WIDTHS = ["100%", "94%", "86%", "97%", "72%"];

export function Skeleton({
  label = "Loading",
  lines = 3,
  decorative = false,
  className = "",
}: SkeletonProps) {
  const count = Math.max(1, Math.min(lines, LINE_WIDTHS.length));
  const bars = (
    <div aria-hidden="true" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-surface-3 motion-safe:animate-pulse"
          style={{ width: LINE_WIDTHS[i] }}
        />
      ))}
    </div>
  );

  if (decorative) return bars;

  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {bars}
    </div>
  );
}

/**
 * PageShell — Consistent layout wrapper for every module page.
 *
 * Provides a sticky header with back navigation, page title, and an optional
 * right-side slot (status text, action button, etc.). On desktop the content
 * expands to max-w-3xl by default; wide mode goes to max-w-5xl (useful for
 * tool pages with a 2-column layout).
 *
 * Every page that previously copy-pasted `bg-gray-900/95 backdrop-blur
 * border-b border-gray-700 max-w-lg mx-auto` should use this instead.
 */

import { useNavigate } from "react-router-dom";
import { IconArrowLeft } from "./Icons";
import type { ReactNode } from "react";

export type PageAccent = "orange" | "yellow" | "amber" | "emerald" | "rose";

interface PageShellProps {
  /** Page title shown in the header. */
  title: string;
  /** Optional module accent colour — drives the header accent line. */
  accent?: PageAccent;
  /** Override the back destination (default: "/"). */
  backTo?: string;
  /** Custom back handler (overrides backTo). */
  onBack?: () => void;
  /** Slot rendered on the right side of the header (status label, icon button…). */
  headerRight?: ReactNode;
  /** Main page content. */
  children: ReactNode;
  /** Max content width. "default" = 2xl, "wide" = 5xl, "full" = no cap. */
  width?: "default" | "wide" | "full";
  /** Extra className on the outer wrapper. */
  className?: string;
}

const accentLineColors: Record<PageAccent, string> = {
  orange: "from-orange-400/0 via-orange-400/60 to-orange-400/0",
  yellow: "from-yellow-400/0 via-yellow-400/60 to-yellow-400/0",
  amber: "from-amber-400/0 via-amber-400/60 to-amber-400/0",
  emerald: "from-emerald-400/0 via-emerald-400/60 to-emerald-400/0",
  rose: "from-rose-400/0 via-rose-400/60 to-rose-400/0",
};

const widthClasses = {
  default: "max-w-3xl",
  wide: "max-w-5xl",
  full: "",
};

export function PageShell({
  title,
  accent,
  backTo = "/",
  onBack,
  headerRight,
  children,
  width = "default",
  className = "",
}: PageShellProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(backTo));
  const maxW = widthClasses[width];

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface-0/95 backdrop-blur-lg border-b border-surface-border">
        {/* thin coloured accent line at the very top */}
        {accent && (
          <div
            aria-hidden="true"
            className={`h-[2px] w-full bg-gradient-to-r ${accentLineColors[accent]}`}
          />
        )}

        <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3 ${maxW} mx-auto`}>
          {/* Back */}
          <button
            type="button"
            onClick={handleBack}
            aria-label={`Go back to ${backTo === "/" ? "home" : "previous page"}`}
            className="
              inline-flex items-center gap-1.5
              text-sm font-medium text-stone-400
              hover:text-stone-100 transition-colors
              min-h-touch min-w-touch
              rounded-lg px-2 -ml-2
              focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
            "
          >
            <IconArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-base font-semibold text-stone-100 tracking-tight truncate">
            {title}
          </h1>

          {/* Right slot — match min width of back button for centering */}
          <div className="min-w-touch flex items-center justify-end">
            {headerRight ?? null}
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      {children}
    </div>
  );
}

/**
 * Reusable section label — "01 / HEADING" style divider used across module pages.
 */
export function SectionLabel({ label, className = "" }: { label: string; className?: string }) {
  return (
    <h2
      className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500 mb-3 ${className}`}
    >
      {label}
    </h2>
  );
}

/**
 * Shared style strings for toggle-button groups (mode selectors, format pickers…).
 * Usage:
 *   className={isActive ? toggleActive : toggleInactive}
 */
export const toggleActive =
  "min-h-touch rounded-lg border bg-primary-500/20 border-primary-400/60 text-primary-100 font-semibold focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";
export const toggleInactive =
  "min-h-touch rounded-lg border bg-surface-2 border-surface-border text-stone-400 hover:text-stone-200 hover:bg-surface-3 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

/** Shared textarea / readonly-output style. */
export const textareaClass =
  "w-full bg-surface-1 text-stone-100 border border-surface-border rounded-xl px-4 py-3 leading-relaxed placeholder:text-stone-600 focus:border-primary-400/60 focus:outline-none focus:ring-1 focus:ring-primary-400/40 transition-colors";

/** Shared section-card container. */
export const sectionCard = "bg-surface-1 border border-surface-border rounded-2xl p-4 sm:p-5";

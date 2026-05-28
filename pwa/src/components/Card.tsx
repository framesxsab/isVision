import type { ReactNode } from "react";

export type CardAccent = "cyan" | "violet" | "amber" | "emerald" | "rose" | "indigo";

interface CardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
  accent?: CardAccent;
  meta?: string;
}

// Per-accent class strings. Tailwind needs the full class name at build time,
// so we can't template the color into the class.
const accentStyles: Record<CardAccent, {
  iconWrap: string;
  iconColor: string;
  rail: string;
  ring: string;
  chevron: string;
  meta: string;
}> = {
  cyan: {
    iconWrap: "bg-cyan-500/10 border-cyan-400/30 group-hover:border-cyan-300/60 group-hover:bg-cyan-500/15",
    iconColor: "text-cyan-300",
    rail: "from-cyan-400/0 via-cyan-400/70 to-cyan-400/0",
    ring: "group-hover:ring-cyan-400/30",
    chevron: "text-cyan-300/60 group-hover:text-cyan-200 group-hover:translate-x-0.5",
    meta: "text-cyan-300/80",
  },
  violet: {
    iconWrap: "bg-violet-500/10 border-violet-400/30 group-hover:border-violet-300/60 group-hover:bg-violet-500/15",
    iconColor: "text-violet-300",
    rail: "from-violet-400/0 via-violet-400/70 to-violet-400/0",
    ring: "group-hover:ring-violet-400/30",
    chevron: "text-violet-300/60 group-hover:text-violet-200 group-hover:translate-x-0.5",
    meta: "text-violet-300/80",
  },
  amber: {
    iconWrap: "bg-amber-500/10 border-amber-400/30 group-hover:border-amber-300/60 group-hover:bg-amber-500/15",
    iconColor: "text-amber-300",
    rail: "from-amber-400/0 via-amber-400/70 to-amber-400/0",
    ring: "group-hover:ring-amber-400/30",
    chevron: "text-amber-300/60 group-hover:text-amber-200 group-hover:translate-x-0.5",
    meta: "text-amber-300/80",
  },
  emerald: {
    iconWrap: "bg-emerald-500/10 border-emerald-400/30 group-hover:border-emerald-300/60 group-hover:bg-emerald-500/15",
    iconColor: "text-emerald-300",
    rail: "from-emerald-400/0 via-emerald-400/70 to-emerald-400/0",
    ring: "group-hover:ring-emerald-400/30",
    chevron: "text-emerald-300/60 group-hover:text-emerald-200 group-hover:translate-x-0.5",
    meta: "text-emerald-300/80",
  },
  rose: {
    iconWrap: "bg-rose-500/10 border-rose-400/30 group-hover:border-rose-300/60 group-hover:bg-rose-500/15",
    iconColor: "text-rose-300",
    rail: "from-rose-400/0 via-rose-400/70 to-rose-400/0",
    ring: "group-hover:ring-rose-400/30",
    chevron: "text-rose-300/60 group-hover:text-rose-200 group-hover:translate-x-0.5",
    meta: "text-rose-300/80",
  },
  indigo: {
    iconWrap: "bg-indigo-500/10 border-indigo-400/30 group-hover:border-indigo-300/60 group-hover:bg-indigo-500/15",
    iconColor: "text-indigo-300",
    rail: "from-indigo-400/0 via-indigo-400/70 to-indigo-400/0",
    ring: "group-hover:ring-indigo-400/30",
    chevron: "text-indigo-300/60 group-hover:text-indigo-200 group-hover:translate-x-0.5",
    meta: "text-indigo-300/80",
  },
};

export function Card({
  title,
  description,
  icon,
  onClick,
  className = "",
  accent = "cyan",
  meta,
}: CardProps) {
  const a = accentStyles[accent];
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full min-h-touch p-4 sm:p-5
        surface-card border border-surface-border rounded-2xl
        text-left transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-card-hover
        ring-1 ring-white/5 ${a.ring}
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
        shadow-card overflow-hidden
        ${className}
      `}
      aria-label={`${title}. ${description}`}
    >
      {/* Accent rail along the left edge — purely decorative, signals module identity */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b ${a.rail} opacity-70 group-hover:opacity-100 transition-opacity`}
      />

      <div className="flex items-start gap-4">
        <div
          className={`
            flex-shrink-0 w-12 h-12 rounded-xl border
            flex items-center justify-center
            transition-colors duration-200
            ${a.iconWrap}
          `}
          aria-hidden="true"
        >
          <span className={a.iconColor}>{icon}</span>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-stone-50 tracking-tight">
              {title}
            </h3>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-5 h-5 shrink-0 transition-all duration-200 ${a.chevron}`}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
          <p className="text-sm text-stone-300/90 mt-1 leading-relaxed">
            {description}
          </p>
          {meta && (
            <p className={`text-[11px] uppercase tracking-[0.14em] font-semibold mt-2 ${a.meta}`}>
              {meta}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

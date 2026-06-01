import type { ReactNode } from "react";

export type CardAccent = "orange" | "yellow" | "amber" | "emerald" | "rose";

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
  orange: {
    iconWrap: "bg-orange-500/10 border-orange-400/30 group-hover:border-orange-300/60 group-hover:bg-orange-500/15",
    iconColor: "text-orange-300",
    rail: "from-orange-400/0 via-orange-400/70 to-orange-400/0",
    ring: "group-hover:ring-orange-400/30",
    chevron: "text-orange-300/60 group-hover:text-orange-200 group-hover:translate-x-0.5",
    meta: "text-orange-300/80",
  },
  yellow: {
    iconWrap: "bg-yellow-500/10 border-yellow-400/30 group-hover:border-yellow-300/60 group-hover:bg-yellow-500/15",
    iconColor: "text-yellow-300",
    rail: "from-yellow-400/0 via-yellow-400/70 to-yellow-400/0",
    ring: "group-hover:ring-yellow-400/30",
    chevron: "text-yellow-300/60 group-hover:text-yellow-200 group-hover:translate-x-0.5",
    meta: "text-yellow-300/80",
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
};

export function Card({
  title,
  description,
  icon,
  onClick,
  className = "",
  accent = "orange",
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

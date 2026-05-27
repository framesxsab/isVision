import type { ReactNode } from "react";

interface CardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Card({ title, description, icon, onClick, className = "" }: CardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group w-full min-h-touch p-3
        bg-stone-950/80 hover:bg-stone-900 active:bg-stone-800
        border border-stone-700/80 rounded-lg
        text-left transition-colors duration-150
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
        ${className}
      `}
      aria-label={`${title}. ${description}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-950 border border-primary-800 flex items-center justify-center text-2xl group-hover:border-primary-500"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-stone-50">{title}</h3>
          <p className="text-sm text-stone-300 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

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
        w-full min-h-touch p-5
        bg-gray-900 hover:bg-gray-800 active:bg-gray-700
        border border-gray-700 rounded-2xl
        text-left transition-colors duration-150
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
        ${className}
      `}
      aria-label={`${title}. ${description}`}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-900 flex items-center justify-center text-2xl"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

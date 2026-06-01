import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary: [
    "text-white font-semibold",
    "bg-gradient-to-b from-primary-400 to-primary-600",
    "hover:from-primary-300 hover:to-primary-500",
    "active:from-primary-500 active:to-primary-700",
    "shadow-[0_4px_14px_-4px_rgba(251,146,60,0.5),inset_0_1px_0_rgba(255,255,255,0.18)]",
    "ring-1 ring-primary-300/30",
  ].join(" "),
  secondary: [
    "text-stone-50 font-medium",
    "bg-surface-2 hover:bg-surface-3 active:bg-surface-4",
    "border border-surface-border",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  ].join(" "),
  ghost: [
    "bg-transparent hover:bg-white/5 active:bg-white/10",
    "text-stone-200 font-medium",
  ].join(" "),
  danger: [
    "text-white font-semibold",
    "bg-gradient-to-b from-rose-500 to-rose-700",
    "hover:from-rose-400 hover:to-rose-600",
    "shadow-[0_4px_14px_-4px_rgba(244,63,94,0.45),inset_0_1px_0_rgba(255,255,255,0.18)]",
    "ring-1 ring-rose-300/25",
  ].join(" "),
};

const sizes = {
  md: "px-4 py-3 text-base",
  lg: "px-6 py-4 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={`
        min-h-touch min-w-touch
        rounded-xl
        transition-all duration-150
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
});

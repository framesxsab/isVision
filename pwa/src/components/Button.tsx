import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary:
    "bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white shadow-sm shadow-cyan-950/40",
  secondary:
    "bg-stone-900 hover:bg-stone-800 active:bg-stone-700 text-stone-50 border border-stone-700",
  ghost: "bg-transparent hover:bg-stone-900 active:bg-stone-800 text-stone-200",
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
        rounded-lg font-semibold
        transition-colors duration-150
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
        disabled:opacity-50 disabled:cursor-not-allowed
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

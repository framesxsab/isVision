import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary:
    "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white",
  secondary:
    "bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white border border-gray-600",
  ghost: "bg-transparent hover:bg-gray-800 active:bg-gray-700 text-gray-200",
};

const sizes = {
  md: "px-4 py-3 text-base",
  lg: "px-6 py-4 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        min-h-touch min-w-touch
        rounded-xl font-semibold
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
}

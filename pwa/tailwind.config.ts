import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand cyan — used for primary actions and the wordmark accent.
        primary: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        // Neutral surface tokens — warmer than pure stone, easier on the eyes
        // in dark mode while still meeting AA contrast against white text.
        surface: {
          0: "#07090c",
          1: "#0c1117",
          2: "#121821",
          3: "#1a2230",
          4: "#232d3d",
          border: "#2a3445",
          divider: "#1f2937",
        },
      },
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
      boxShadow: {
        "glow-cyan": "0 0 0 1px rgba(34, 211, 238, 0.25), 0 12px 32px -12px rgba(34, 211, 238, 0.35)",
        "card": "0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 24px -12px rgba(0, 0, 0, 0.6)",
        "card-hover": "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 16px 40px -16px rgba(0, 0, 0, 0.8)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 280ms ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

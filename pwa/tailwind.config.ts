import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand orange — primary actions and wordmark accent. Bright warm hues
        // reflect the most light, the best signal for low-vision users on a
        // dark surface. Pair with `accent` (yellow) for secondary highlights.
        primary: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
        accent: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          950: "#422006",
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
        "glow-orange": "0 0 0 1px rgba(251, 146, 60, 0.25), 0 12px 32px -12px rgba(251, 146, 60, 0.35)",
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

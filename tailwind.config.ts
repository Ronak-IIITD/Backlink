import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        paper: "#f7f6f0",
        forest: "#234d3c",
        // Preserve existing utility names while applying the shared warm palette.
        slate: {
          50: "#f7f6f0",
          100: "#eeeee5",
          200: "#dddfd3",
          300: "#c4c8b9",
          400: "#6f7868",
          500: "#666f60",
          600: "#515c4d",
          700: "#3e493a",
          800: "#2d392c",
          900: "#202c22",
          950: "#152019",
        },
        indigo: {
          50: "#eef4ee",
          100: "#dceadd",
          200: "#bdd6c3",
          300: "#94bba1",
          400: "#6b9b7c",
          500: "#43815b",
          600: "#2d684a",
          700: "#234d3c",
          800: "#1d4033",
          900: "#19362b",
          950: "#10271e",
        },
        accent: {
          50: "#eef4ee",
          100: "#dceadd",
          600: "#2d684a",
          700: "#234d3c",
        },
      },
    },
  },
  plugins: [],
};
export default config;

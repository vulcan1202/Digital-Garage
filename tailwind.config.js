/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        garage: {
          bg: "#09090b",
          card: "#121215",
          elevated: "#18181b",
          subtle: "#27272a",
          border: "rgba(255, 255, 255, 0.08)",
          borderHighlight: "rgba(255, 255, 255, 0.16)",
        },
        racing: {
          orange: "#ff6b00",
          blue: "#007aff",
          green: "#10b981",
          red: "#ef4444",
          amber: "#f59e0b",
        },
        metal: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        }
      }
    },
  },
  plugins: [],
};

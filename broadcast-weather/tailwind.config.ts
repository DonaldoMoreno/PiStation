import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        broadcast: {
          orange: "#f28d35",
          violet: "#5f44d2",
          blue: "#1c8acf",
          panel: "rgba(10, 32, 79, 0.55)",
          ink: "#eff6ff"
        }
      },
      boxShadow: {
        glow: "0 14px 48px rgba(4, 8, 28, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;

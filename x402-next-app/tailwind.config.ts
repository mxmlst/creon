import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["\"Space Grotesk\"", "system-ui", "sans-serif"],
        mono: ["\"IBM Plex Mono\"", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        night: "#0b0f14",
        ember: "#ff6a3d",
        frost: "#9ad1ff",
        stone: "#141b22",
        sand: "#f7f1e3",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(154, 209, 255, 0.2), 0 15px 45px rgba(15, 23, 42, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;

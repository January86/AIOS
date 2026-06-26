import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        border: "#1e1e2e",
        muted: "#4a4a6a",
        text: "#e2e2f0",
      },
    },
  },
  plugins: [],
};

export default config;

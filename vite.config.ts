import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { target: "es2022" },
  server: { allowedHosts: ["terminal.local", "localhost", "127.0.0.1"] },
});

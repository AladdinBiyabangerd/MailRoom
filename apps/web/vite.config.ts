import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/admin/v1": { target: "http://localhost:8090", changeOrigin: true },
      "/public/v1": { target: "http://localhost:8090", changeOrigin: true },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

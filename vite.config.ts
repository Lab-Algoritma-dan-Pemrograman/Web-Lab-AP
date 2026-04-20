import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from '@vitejs/plugin-basic-ssl'; // <-- Import SSL
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    basicSsl(), // <-- Tambahkan di sini (di dalam array)
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
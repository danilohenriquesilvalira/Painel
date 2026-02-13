import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        panel: resolve(__dirname, 'src/panel.html'),
      }
    }
  },

  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

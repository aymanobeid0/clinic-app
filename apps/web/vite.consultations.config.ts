import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Task verification server; owner preview/API services remain untouched.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4187,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3187" },
  },
});

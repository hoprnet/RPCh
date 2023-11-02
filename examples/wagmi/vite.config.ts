import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // this is needed to get sdk to work with vite because of the monorepo
    // https://vitejs.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies
    include: ["@rpch/sdk"],
  },
});

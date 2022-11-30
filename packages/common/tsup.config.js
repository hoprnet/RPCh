import { defineConfig } from "tsup";

export default defineConfig({
  format: "cjs",
  dts: true,
  entry: ["src", "!src/**/*.spec.*"],
  outDir: "build",
});

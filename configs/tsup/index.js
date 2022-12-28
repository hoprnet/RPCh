/** @type {import('tsup').Options} */
module.exports = {
  format: "cjs",
  clean: true,
  dts: true,
  entry: ["src", "!src/**/*.spec.*"],
  outDir: "build",
};

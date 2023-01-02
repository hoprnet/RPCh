/** @type {import('tsup').Options} */
module.exports = {
  format: "cjs",
  clean: true,
  dts: true,
  bundle: false,
  entry: ["src", "!src/**/*.spec.*"],
  outDir: "build",
};

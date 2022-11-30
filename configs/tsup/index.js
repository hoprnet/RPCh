/** @type {import('tsup').Options} */
module.exports = {
  format: "cjs",
  dts: true,
  entry: ["src", "!src/**/*.spec.*"],
  outDir: "build",
};

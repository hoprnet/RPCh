const baseConfig = require("rpch-configs-tsup");

/** @type {import('tsup').Options} */
module.exports = {
  ...baseConfig,
  clean: false, // if this is true, it will remove all files in our directory
  outDir: "./",
  target: "es5",
};

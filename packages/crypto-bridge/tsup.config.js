const baseConfig = require("@rpch/configs-tsup");

/** @type {import('tsup').Options} */
module.exports = {
  ...baseConfig,
  // if this is true, it will remove all files in our directory
  // we use rimraf instead
  clean: false,
  outDir: "./",
  target: "es5",
};

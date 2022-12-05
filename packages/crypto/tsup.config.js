const baseConfig = require("rpch-configs-tsup");

/** @type {import('tsup').Options} */
module.exports = {
  ...baseConfig,
  entry: ["src", "!src/**/*.spec.*", "!src/lib"],
  target: "es5",
};

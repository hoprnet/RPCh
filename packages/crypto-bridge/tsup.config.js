const baseConfig = require("@rpch/configs-tsup");

/** @type {import('tsup').Options} */
module.exports = {
  ...baseConfig,
  target: "es5",
};

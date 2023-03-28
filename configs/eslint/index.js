/**
 * @typedef {Object} EslintConfig
 * @property {string[]} extends
 * @property {object} rules
 */

/**
 * @type {EslintConfig}
 */
module.exports = {
  extends: ["next", "turbo", "prettier"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "react/jsx-key": "off",
    "no-unused-vars": "error"
  },
};

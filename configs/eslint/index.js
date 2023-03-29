/**
 * @typedef {Object} EslintConfig
 * @property {string[]} extends
 * @property {object} rules
 */

/**
 * @type {EslintConfig}
 */
module.exports = {
  extends: ["turbo", "prettier"],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  },
};

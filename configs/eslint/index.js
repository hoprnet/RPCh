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
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "react/jsx-key": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  },
};

module.exports = {
    env: {
        es2020: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', '@stylistic'],
    root: true,
    rules: {
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_ignored' },
        ],
        '@typescript-eslint/no-explicit-any': ['off'],
        '@stylistic/quotes': [
            'warn',
            'single',
            { avoidEscape: true, allowTemplateLiterals: false },
        ],
    },
};

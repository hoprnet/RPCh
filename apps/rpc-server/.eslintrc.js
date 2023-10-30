module.exports = {
    env: {
        es2016: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,
    rules: {
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_ignored' },
        ],
        '@typescript-eslint/no-explicit-any': ['off'],
    },
};

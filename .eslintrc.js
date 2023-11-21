module.exports = {
    env: {
        es2020: true,
    },
    extends: ['eslint:recommended', 'prettier'],
    plugins: ['@stylistic'],
    root: true,
    rules: {
        '@stylistic/quotes': [
            'warn',
            'single',
            { avoidEscape: true, allowTemplateLiterals: false },
        ],
        '@stylistic/indent': ['warn', { SwitchCase: 0 }],
    },
    overrides: [
        {
            files: ['*.ts'],
            parser: '@typescript-eslint/parser',
            extends: ['plugin:@typescript-eslint/recommended'],
            plugins: ['@typescript-eslint'],

            rules: {
                '@typescript-eslint/no-unused-vars': [
                    'warn',
                    { argsIgnorePattern: '^_', varsIgnorePattern: '^_ignored' },
                ],
                '@typescript-eslint/no-explicit-any': ['off'],
            },
        },
        {
            files: ['*.js'],
            parserOptions: {
                sourceType: 'module',
            },
            rules: {
                'no-unused-vars': [
                    'warn',
                    { argsIgnorePattern: '^_', varsIgnorePattern: '^_ignored' },
                ],
            },
        },
    ],
};

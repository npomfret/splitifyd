import tsParser from '@typescript-eslint/parser';
import noInlineStyles from 'eslint-plugin-no-inline-styles';

export default [
    {
        files: ['webapp-v2/src/**/*.{ts,tsx,js,jsx}'],
        ignores: ['**/node_modules/**'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            'no-inline-styles': noInlineStyles,
        },
        rules: {
            'no-inline-styles/no-inline-styles': 'error',
        },
    },
];

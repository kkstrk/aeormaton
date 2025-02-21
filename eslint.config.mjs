// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.all,
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    {
        rules: {
            'capitalized-comments': 'off',
            'init-declarations': 'off',
            'max-lines-per-function': 'off',
            'max-statements': 'off',
            'no-await-in-loop': 'off',
            'no-console': 'off',
            'no-implicit-coercion': 'off',
            'no-magic-numbers': 'off',
            'no-ternary': 'off',
            'no-warning-comments': 'warn',
            'one-var': 'off',
            'require-atomic-updates': 'off',
            'sort-imports': 'off',
        },
    },
    {
        ignores: ['dist/*'],
    },
);

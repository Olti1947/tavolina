// One ESLint config for every TS workspace. Formatting is Prettier's job, so style rules are off.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/api/**',
      'apps/device/android/**',
      'apps/device/ios/**',
      // Generated from the OpenAPI spec; never edited by hand.
      'packages/api-client/src/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs', 'apps/device/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);

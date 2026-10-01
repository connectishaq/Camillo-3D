import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist*/', 'public/', 'preview/', 'node_modules/'] },
  js.configs.recommended,
  {
    // browser code
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, __GLB_MODELS__: 'readonly' },
    },
  },
  {
    // build tooling (runs in Node)
    files: ['vite.config.js', 'vite-plugins/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  prettier, // formatting is Prettier's job
];

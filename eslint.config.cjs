// eslint.config.cjs — flat config (ESLint v9+)
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  // Global ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'public/**',
      '.vscode/**',
      'vitest.config.*',
    ],
  },

  // TypeScript recommended rules (flat)
  ...tsPlugin.configs['flat/recommended'],
  // Enable extra type-checked rules from typescript-eslint (requires project)
  ...tsPlugin.configs['flat/recommended-type-checked'],

  // React plugin recommended (flat)
  reactPlugin.configs?.flat?.recommended,
  // React plugin JSX runtime config (auto React JSX runtime)
  reactPlugin.configs?.flat?.['jsx-runtime'],
  // React Hooks recommended (flat)
  reactHooksPlugin.configs?.flat?.recommended,
  // JSX accessibility plugin recommended (flat)
  jsxA11yPlugin.flatConfigs?.recommended,

  // Prettier as the last configuration to disable formatting-related rules
  // and enable the prettier/prettier rule
  prettierRecommended,

  // Custom base configuration overrides/rules that apply to all JS/TS files
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        // Enable typed rules (type-aware linting)
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
      // Basic TypeScript/React rules we want to enforce/override
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',
    },
  },
].filter(Boolean);

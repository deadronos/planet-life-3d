// eslint.config.cjs — flat config (ESLint v9+)
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const unusedImports = require('eslint-plugin-unused-imports');
const reactRefresh = require('eslint-plugin-react-refresh');
// Detect if the plugin exposes the optional rule (protects older/newer versions)
const reactRefreshHasRule = !!(reactRefresh && reactRefresh.rules && 'only-export-components' in reactRefresh.rules);

module.exports = [
  // Global ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'public/**',
      '.vscode/**',
      '.github/**',
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
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
      // Basic TypeScript/React rules we want to enforce/override
      '@typescript-eslint/no-unused-vars': 'off', // Off in favor of unused-imports
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',

      // Import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // React Refresh (only enable if rule exists in installed plugin)
      ...(reactRefreshHasRule
        ? { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] }
        : {}),
    },
  },
].filter(Boolean);

import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const config = [
  js.configs.recommended,
  ...compat.config({
    ignorePatterns: ['dist/**', 'node_modules/**', 'build/**'],
  }),
  {
    files: ['src/**/*.{js,ts}', 'test/**/*.{js,ts}'], // Добавлен test
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'no-type-imports',
        },
      ],

      // General rules
      'no-console': ['warn', { allow: ['warn', 'log', 'error'] }],
      'no-undef': 'off',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': 'off',
      quotes: 'off',
      indent: 'off',
      'max-len': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {},
      },
    },
  },
]

export default config

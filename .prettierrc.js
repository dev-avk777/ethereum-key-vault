module.exports = {
  trailingComma: 'es5',
  semi: false,
  singleQuote: true,
  endOfLine: 'auto',
  printWidth: 100,
  arrowParens: 'avoid',
  overrides: [
    {
      files: '{**/*,*}.{js,ts,json,md}',
      excludeFiles: [
        '**/node_modules/**',
        '**/dist/**', // Main build folder in Nest.js
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts', // Left exclusion for TypeScript declarations
      ],
      options: { requirePragma: false },
    },
  ],
}

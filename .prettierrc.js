module.exports = {
  trailingComma: 'es5',
  semi: false,
  singleQuote: true,
  endOfLine: 'auto',
  printWidth: 100,
  requirePragma: true,
  arrowParens: 'avoid',
  overrides: [
    {
      files: '{**/*,*}.{js,ts,json,md}',
      excludeFiles: [
        '**/node_modules/**',
        '**/dist/**', // Основная папка сборки в Nest.js
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts', // Оставил исключение для деклараций TypeScript
      ],
      options: { requirePragma: false },
    },
  ],
}

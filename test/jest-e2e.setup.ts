// test/jest-e2e.setup.ts

console.log('✅ E2E setup loaded')
process.env.VAULT_ADDR ||= 'http://127.0.0.1:8200'
process.env.VAULT_TOKEN ||= 'dev-only-token'
process.env.FRONTEND_URL ||= 'http://localhost:3000'

// Для тестов мы используем глобальные функции Jest
// Если setup запускается до импорта jest, эти функции уже должны быть определены в глобальном scope

/* eslint-env node */

/**
 * Скрипт для управления приложением Ethereum Key Vault
 * Этот скрипт автоматически:
 * 1. Проверяет, занят ли порт 3000
 * 2. Если порт занят, останавливает процесс, занимающий порт
 * 3. Запускает приложение с нужными параметрами
 */

const { execSync } = require('child_process')
const { spawn } = require('child_process')
require('dotenv').config()

const PORT = process.env.PORT || 3000

// Проверяем, определен ли порт
if (!PORT) {
  console.error('PORT is not defined in .env')
  process.exit(1)
}

console.log(`Starting Ethereum Key Vault on port ${PORT}...`)

/**
 * Получает PID процесса, использующего указанный порт
 * @param {number} port - Порт для проверки
 * @returns {number|null} - PID процесса или null, если порт свободен
 */
function getProcessIdByPort(port) {
  try {
    // Команда отличается для разных ОС
    const cmd =
      process.platform === 'win32'
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port} | grep LISTEN`

    const output = execSync(cmd, { encoding: 'utf-8' })

    if (!output) return null

    // Извлечение PID из вывода команды
    if (process.platform === 'win32') {
      const matches = output.match(/LISTENING\s+(\d+)/)
      return matches && matches[1] ? parseInt(matches[1], 10) : null
    } else {
      const lines = output.trim().split('\n')
      if (lines.length === 0) return null
      const cols = lines[0].trim().split(/\s+/)
      return cols.length > 1 ? parseInt(cols[1], 10) : null
    }
  } catch (error) {
    // Если команда завершилась с ошибкой, скорее всего, порт свободен
    return null
  }
}

/**
 * Останавливает процесс по его PID
 * @param {number} pid - PID процесса для остановки
 */
function killProcess(pid) {
  try {
    const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`

    execSync(cmd)
    console.log(`Process with PID ${pid} was terminated.`)
  } catch (error) {
    console.error(`Failed to kill process ${pid}:`, error.message)
  }
}

/**
 * Запускает приложение NestJS
 */
function startApplication() {
  console.log('Starting NestJS application...')

  // Проверяем, используется ли Windows
  const isWindows = process.platform === 'win32'

  // Команда для запуска приложения
  const nestBinary = isWindows ? 'node_modules\\.bin\\nest' : 'node_modules/.bin/nest'
  const command = isWindows ? nestBinary : 'npx'
  const args = isWindows ? ['start', '--watch'] : ['nest', 'start', '--watch']

  // Создаем процесс
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
  })

  // Обрабатываем события процесса
  child.on('error', error => {
    console.error('Failed to start application:', error)
  })

  child.on('exit', (code, signal) => {
    if (code) {
      console.log(`Application exited with code ${code}`)
    } else if (signal) {
      console.log(`Application was killed with signal ${signal}`)
    } else {
      console.log('Application exited')
    }
  })

  // Обрабатываем сигналы завершения для корректного закрытия дочернего процесса
  process.on('SIGINT', () => {
    console.log('Stopping application...')
    child.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    console.log('Stopping application...')
    child.kill('SIGTERM')
  })
}

// Основной код
const pid = getProcessIdByPort(PORT)

if (pid) {
  console.log(`Port ${PORT} is already in use by process ${pid}`)
  console.log('Trying to free the port...')
  killProcess(pid)
  // Даем время на освобождение порта
  setTimeout(startApplication, 1000)
} else {
  startApplication()
}

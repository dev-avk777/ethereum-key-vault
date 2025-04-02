/* eslint-env node */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Загружаем переменные окружения из .env
dotenv.config();

// Получаем порт из переменных окружения или используем 3000 по умолчанию
const PORT = process.env.PORT || 3000;

function killProcessOnPort(port) {
  try {
    // Находим PID процесса, который использует порт
    const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();
    const lines = output.trim().split('\n');

    if (lines.length > 0) {
      // Извлекаем PID из последнего столбца
      const pid = lines[0].trim().split(/\s+/).pop();
      
      if (pid) {
        console.log(`Found process with PID ${pid} using port ${port}. Killing process...`);
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Process with PID ${pid} terminated.`);
        return true;
      }
    }
    return false;
  } catch (err) {
    // Если произошла ошибка, скорее всего порт не занят
    console.log(`No process found using port ${port}.`);
    return false;
  }
}

function startApp() {
  try {
    console.log(`Starting application on port ${PORT}...`);
    // Используем spawn для сохранения вывода и возможности отменить процесс
    const { spawn } = require('child_process');
    const child = spawn('pnpm', ['start:dev'], {
      stdio: 'inherit',
      shell: true
    });

    // Обработка завершения процесса
    child.on('close', (code) => {
      if (code !== 0) {
        console.log(`Application process exited with code ${code}`);
      }
    });

    // Обработка CTRL+C
    process.on('SIGINT', () => {
      console.log('Received SIGINT. Stopping application...');
      child.kill('SIGINT');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start application:', error.message);
    process.exit(1);
  }
}

// Главная функция
function main() {
  console.log(`
======================================================
  Ethereum Key Vault - Application Manager
======================================================
`);
  
  console.log(`Checking if port ${PORT} is in use...`);
  
  // Пытаемся освободить порт если он занят
  const killed = killProcessOnPort(PORT);
  
  if (killed) {
    // Даем немного времени для освобождения порта
    console.log('Waiting for port to be released...');
    setTimeout(startApp, 1000);
  } else {
    // Порт свободен, запускаем приложение
    startApp();
  }
}

// Запускаем основную функцию
main();
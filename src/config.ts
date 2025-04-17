const config = {
  apiUrl:
    process.env.MODE === 'production'
      ? process.env.VITE_API_URL || 'https://api.tokenswallet.ru'
      : process.env.VITE_API_URL ||
        (process.env.HOSTNAME === 'localhost' ? 'http://localhost:5000' : 'http://app:5000'), // Используем app как имя сервиса в docker-compose

  // Добавляем baseUrl для консистентности
  baseUrl:
    process.env.MODE === 'production'
      ? process.env.VITE_FRONTEND_URL || 'https://tokenswallet.ru'
      : process.env.VITE_FRONTEND_URL || window.location.origin,

  // Флаг для определения продакшен-режима
  isProduction: process.env.MODE === 'production',

  // Для работы в Docker - автоматически определяем по hostname
  inDocker: window.location.hostname !== 'localhost',
}

export default config

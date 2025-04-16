const config = {
  apiUrl:
    import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_API_URL || 'https://api.tokenswallet.ru'
      : import.meta.env.VITE_API_URL ||
        (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'http://app:5000'), // Используем app как имя сервиса в docker-compose

  // Добавляем baseUrl для консистентности
  baseUrl:
    import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_FRONTEND_URL || 'https://tokenswallet.ru'
      : import.meta.env.VITE_FRONTEND_URL || window.location.origin,

  // Флаг для определения продакшен-режима
  isProduction: import.meta.env.MODE === 'production',

  // Для работы в Docker - автоматически определяем по hostname
  inDocker: window.location.hostname !== 'localhost',
}

export default config

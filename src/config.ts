const config = {
  apiUrl:
    process.env.MODE === 'production'
      ? process.env.VITE_API_URL || 'https://api.tokenswallet.ru'
      : process.env.VITE_API_URL ||
        (process.env.HOSTNAME === 'localhost' ? 'http://localhost:5000' : 'http://app:5000'), // Use app as service name in docker-compose

  // Add baseUrl for consistency
  baseUrl:
    process.env.MODE === 'production'
      ? process.env.VITE_FRONTEND_URL || 'https://tokenswallet.ru'
      : process.env.VITE_FRONTEND_URL || window.location.origin,

  // Flag to determine production mode
  isProduction: process.env.MODE === 'production',

  // For working in Docker - automatically determine by hostname
  inDocker: window.location.hostname !== 'localhost',
}

export default config

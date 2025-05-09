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

  // === Добавляем для Substrate (и в целом для бэкенда) ===
  SUBSTRATE_RPC_URL: process.env.SUBSTRATE_RPC_URL || 'ws://127.0.0.1:9944',
  SUBSTRATE_SS58_PREFIX: Number(process.env.SUBSTRATE_SS58_PREFIX) || 42,
  CHAIN_TYPE: process.env.CHAIN_TYPE || 'ethereum',
}

export default config

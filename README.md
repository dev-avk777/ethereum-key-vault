# Ethereum Key Vault

Secure system for storing and managing Ethereum private keys with Google OAuth authentication and HashiCorp Vault integration.

## Requirements

- Docker & Docker Compose
- Node.js v18+ and pnpm
- (Optional) Access to HashiCorp Vault for production environments

## Clone the repository

```bash
git clone https://github.com/yourusername/ethereum-key-vault.git
cd ethereum-key-vault
```

## Environment setup

1. Copy the template `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and configure the following variables:
   - `POSTGRES_HOST` (usually `localhost`)
   - `POSTGRES_PORT` (default: `5432`)
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `VAULT_ENDPOINT` and `VAULT_TOKEN` (for development or production Vault)
   - `PORT` (application port; default: `5000`)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
   - `FRONTEND_URL` and `VITE_AUTH_API_URL`

## Development startup

Start all services (Postgres, Vault, backend, and frontend) with a single command:

```bash
pnpm run dev
```

This will run:
1. `docker-compose up -d` — launches Postgres and Vault containers
2. `pnpm run backend:watch` — starts NestJS in watch mode
3. `pnpm run frontend:dev` — starts the frontend (http://localhost:3007)

### Running migrations

After cloning the repository, apply the database migrations once:

```bash
pnpm run migration:run
```

The Docker volume preserves your database state, so rerunning migrations is not required on subsequent startups.

## Production deployment

1. Create `.env.production` with your production settings.
2. Build the project:
   ```bash
   pnpm run build
   ```
3. Start the application:
   ```bash
   NODE_ENV=production pnpm start
   ```

## Useful commands

- `pnpm run lint` — run ESLint and Prettier
- `pnpm run test` — run unit tests
- `pnpm run test:e2e` — run end-to-end tests
- `pnpm run test:cov` — generate test coverage report

---

If you need additional details or further adjustments, let me know!
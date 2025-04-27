# Ethereum Key Vault

Secure system for storing and managing Ethereum private keys with Google OAuth authentication and HashiCorp Vault integration.

---

## Requirements

- Docker & Docker Compose
- Node.js v18+ and pnpm
- (Optional) Access to HashiCorp Vault for production environments

---

## Clone the repository

```bash
git clone https://github.com/yourusername/ethereum-key-vault.git
cd ethereum-key-vault
```

---

## Environment Setup

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

---

## Development Startup

Start all services (Postgres, Vault, backend, and frontend) with:

```bash
pnpm run dev
```

1. `docker-compose up -d` — launches Postgres and Vault in dev mode (KV v2 auto-mounted at `secret/`).
2. `pnpm run backend:watch` — starts NestJS in watch mode.
3. `pnpm run frontend:dev` — starts the front-end at `http://localhost:3007`.

---

### Running Migrations

Once after cloning:

```bash
pnpm run migration:run
```

The Docker volume preserves your database, so you don’t need to re-run migrations on every start.

---

## Production Deployment

1. **Create `vault/config/prod.hcl`** with the following content:

   ```hcl
   # Global settings
   api_addr     = "https://vault.your-domain.com:8200"
   cluster_addr = "https://vault.your-domain.com:8201"
   ui = true

   storage "file" {
     path = "/vault/data"
   }

   listener "tcp" {
     address     = "0.0.0.0:8200"
     tls_disable = true
   }

   # Optional: AWS KMS auto-unseal (uncomment and configure)
   # seal "awskms" {
   #   region     = "eu-west-1"
   #   kms_key_id = "arn:aws:kms:..."
   # }

   # Audit logging
   audit "file" {
     file_path = "/vault/logs/audit.log"
     log_raw   = true
   }

   # Telemetry for Prometheus
   telemetry {
     prometheus_retention_time = "24h"
   }

   # Mount KV version 2 at secret/ with versioning
   secrets "kv" {
     path    = "secret"
     version = 2
   }
   ```

2. **Mount the config** in `docker-compose.prod.yml`:

   ```yaml
   services:
     vault:
       volumes:
         - vault_data:/vault/data
         - ./vault/config/prod.hcl:/vault/config/prod.hcl:ro
       command: vault server -config=/vault/config/prod.hcl
   ```

3. Copy `.env.example` to `.env.production` and fill in production variables.
4. Build and run:
   ```bash
   pnpm run build
   NODE_ENV=production pnpm start
   ```

---

## Vault Production Configuration Reference

- **api_addr**: External address clients use (`https://vault.your-domain.com:8200`).
- **cluster_addr**: Internal HA address (`8201`).
- **ui**: Enable Vault UI.
- **storage**: Persists data in `/vault/data`.
- **listener**: TCP listener without TLS (for simplicity).
- **seal** _(optional)_: Auto-unseal with AWS KMS or other.
- **audit**: File-based audit logs of all API requests.
- **telemetry**: Prometheus metrics retention.
- **secrets "kv"**: KV v2 at `secret/`, enabling versioning.

---

## Useful Commands

- `pnpm run lint` — ESLint & Prettier
- `pnpm run test` — Unit tests
- `pnpm run test:e2e` — End-to-end tests
- `pnpm run test:cov` — Coverage report
- `vault status` — Vault health & status
- `vault secrets list -detailed` — List mounted engines (check `options.version=2` for `secret/`)
- `vault kv list secret/` — List keys in KV v2
- `vault kv get secret/<path>` — Retrieve a specific secret

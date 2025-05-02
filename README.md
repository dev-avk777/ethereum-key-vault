# Ethereum Key Vault

Secure system for storing and managing Ethereum private keys with Google OAuth authentication and HashiCorp Vault integration.

---

## Requirements

* Docker & Docker Compose
* Node.js v18+ and pnpm
* (Optional) Access to HashiCorp Vault for production environments

---

## Clone the Repository

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

   * `POSTGRES_HOST` (usually `localhost`)
   * `POSTGRES_PORT` (default: `5432`)
   * `POSTGRES_USER`
   * `POSTGRES_PASSWORD`
   * `POSTGRES_DB`
   * `VAULT_ENDPOINT` and `VAULT_TOKEN` (for development or production Vault)
   * `PORT` (application port; default: `5000`)
   * `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
   * `FRONTEND_URL` and `VITE_AUTH_API_URL`

---

## Development Startup

Start all services (Postgres, Vault, backend, and frontend) with:

```bash
pnpm run dev
```

1. `docker-compose up -d` — Launches Postgres and Vault in dev mode (KV-v2 mounted at `secret/`).
2. `pnpm run backend:watch` — Starts NestJS in watch mode.
3. `pnpm run frontend:dev` — Starts the frontend at `http://localhost:3007`.

---

## Running Migrations

Schema changes must be applied via migrations to ensure consistency across environments. Follow these universal steps using pnpm:

1. **Show pending migrations**

   ```bash
   pnpm run migration:show
   ```

   Displays all migrations that have not yet been applied.

2. **Create a new migration file**

   You have two options:

   * **Using pnpm script**:

     ```bash
     pnpm run migration:create src/migrations/YourMigrationName
     ```

     This uses the alias defined in `package.json` to invoke the CLI.

   * **Direct TypeORM CLI invocation**:

     ```bash
     npx ts-node -r tsconfig-paths/register \
       ./node_modules/typeorm/cli.js \
       migration:create \
       src/migrations/YourMigrationName
     ```

     This bypasses the npm script and calls the CLI directly.

3. **Edit the migration** Open the new file and implement both sides:

   ```ts
   export class <Timestamp>FileName implements MigrationInterface {
     public async up(qr: QueryRunner): Promise<void> {
       // Apply schema changes, e.g. add/drop columns or tables
     }

     public async down(qr: QueryRunner): Promise<void> {
       // Revert schema changes
     }
   }
   ```

4. **Run all pending migrations**

   ```bash
   pnpm run migration:run
   ```

   Creates the `migrations` table if needed and applies migrations in chronological order.

5. **Revert the last migration** (if necessary)

   ```bash
   pnpm run migration:revert
   ```

   Rolls back the most recently applied migration.

**Notes:**

* Always generate migrations via the CLI (`pnpm run migration:create` or `pnpm run migration:generate`) to maintain correct timestamp ordering.
* In development, you may temporarily enable automatic synchronization, but avoid it in production.
* If you encounter conflicts (e.g., existing tables or columns), you can reset the schema:

  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```

---

## Migration Best Practices

To avoid future migration issues, follow these best practices:

* **Prefer auto-generated diffs**: Use `pnpm run migration:generate -- src/migrations/YourMigrationName` to automatically detect schema changes from entities.
* **Reserve manual stubs for complex operations**: Only use `pnpm run migration:create` when you need custom DDL/DML that the auto-diff cannot cover.
* **Always specify the data source**: Include `--dataSource src/config/datasource.ts` (or the equivalent flag) for all non-`create` commands to ensure TypeORM picks up the correct configuration.
* **Maintain a clean timestamp order**: Let the CLI generate the timestamped filenames to preserve chronological execution order.
* **Reset schema in development**: If you encounter "already exists" errors, reset your local schema:

  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```

  Then rerun `pnpm run migration:run`.
* **Verify pending migrations**: Always run `pnpm run migration:show` before `migration:run` to confirm which migrations will be applied.

---

## Production Deployment

1. Copy `.env.example` to `.env.production` and fill production values.
2. Prepare Vault config `vault/config/prod.hcl` with KV-v2, auto-unseal, audit, etc.
3. Adjust `docker-compose.prod.yml` to mount `prod.hcl`:

   ```yaml
   services:
     vault:
       volumes:
         - vault_data:/vault/data
         - ./vault/config/prod.hcl:/vault/config/prod.hcl:ro
       command: vault server -config=/vault/config/prod.hcl
   ```
4. Build and start:

   ```bash
   pnpm run build
   NODE_ENV=production pnpm start
   ```

---

## Vault Production Configuration Reference

* **api\_addr**: Client API address (e.g. `https://vault.your-domain.com:8200`).
* **cluster\_addr**: HA cluster address (`8201`).
* **storage**: Persists data (e.g. file, Consul, AWS S3).
* **listener**: TCP listener settings.
* **seal**: Auto-unseal (e.g. AWS KMS).
* **audit**: File or syslog audit logs.
* **telemetry**: Prometheus metrics.
* **secrets "kv"**: Mount KV-v2 at `secret/` for versioned key-value.

---

## Useful Commands

* `pnpm run lint` — ESLint & Prettier
* `pnpm run test` — Unit tests
* `pnpm run test:e2e` — End-to-end tests
* `pnpm run test:cov` — Coverage report
* `vault status` — Vault health check
* `vault secrets list -detailed` — List mounted secret engines

---

## Manual Vault Key Verification (Developers)

1. Enter the Vault container:

   ```bash
   docker exec -it vault sh
   ```
2. Configure CLI:

   ```sh
   export VAULT_ADDR='http://127.0.0.1:8200'
   export VAULT_TOKEN=<your-root-token>
   ```
3. List and inspect secrets:

   ```sh
   vault kv list secret/ethereum
   vault kv get secret/ethereum/<user-id>
   ```

---

## Working with Vault via Docker

```bash
# List secret engines
docker exec -it vault vault secrets list -detailed

# Store a secret
docker exec -it vault vault kv put secret/ethereum/<id> privateKey=0x...

# Retrieve privateKey only
docker exec -it vault vault kv get -field=privateKey secret/ethereum/<id>

# Delete a secret
docker exec -it vault vault kv delete secret/ethereum/<id>

# Destroy specific versions
docker exec -it vault vault kv destroy -versions=1 secret/ethereum/<id>
```

---

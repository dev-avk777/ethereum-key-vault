
# Ethereum Key Vault

Secure system for storing and managing Ethereum private keys with Google OAuth authentication and HashiCorp Vault integration.

---

## Requirements

- Docker & Docker Compose (v2+)
- Node.js v18+ and pnpm
- (Optional) Access to HashiCorp Vault for production environments

---

## Clone the Repository

```bash
git clone https://github.com/yourusername/ethereum-key-vault.git
cd ethereum-key-vault
````

---

## Environment Setup

1. Copy the template `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and configure the following variables:

   ```dotenv
   # PostgreSQL
   POSTGRES_HOST=127.0.0.1
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=ethereum_key_vault

   # Vault (dev)
   VAULT_ADDR=http://127.0.0.1:8200
   VAULT_TOKEN=dev-only-token

   # Application
   PORT=5000
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   FRONTEND_URL=http://localhost:3007
   VITE_AUTH_API_URL=http://localhost:5000
   ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<YOUR_KEY>
   SUBSTRATE_RPC_URL=wss://rpc-opal.unique.network
   SUBSTRATE_SS58_PREFIX=42
   ```

---

## Development Startup

> **Note:** Remove the `version: '3.8'` line from `docker-compose.yml` to avoid deprecation warnings.

Start all services (Postgres, Vault, vault-init, backend, and frontend) with:

```bash
pnpm run dev
```

The `dev` script in `package.json` does:

1. **`docker-compose up -d`**

   * **`postgres`**: launches PostgreSQL
   * **`vault`**: runs Vault in dev mode on port 8200
   * **`vault-init`**: a one-shot service (depends on vault health) that waits 5 seconds, then runs:

     ```sh
     export VAULT_ADDR=http://vault:8200
     export VAULT_TOKEN=dev-only-token
     vault secrets disable secret/  || true
     vault secrets enable -path=secret -version=2 kv
     ```

     remounting `secret/` as KV v2.

2. **`wait-on tcp:127.0.0.1:5432 tcp:127.0.0.1:8200`**
   Waits until both PostgreSQL and Vault are accepting connections.

3. **`concurrently "pnpm run backend:watch" "pnpm run frontend:dev"`**

   * **backend**: runs NestJS in watch mode on port 5000
   * **frontend**: runs Vite on port 3007

---

## Running Migrations

Apply database schema changes via TypeORM migrations:

1. **Show pending migrations**

   ```bash
   pnpm run migration:show
   ```

2. **Generate a new migration**

   ```bash
   pnpm run migration:generate -- -n YourMigrationName
   ```

3. **Or create a blank stub**

   ```bash
   pnpm run migration:create src/migrations/YourMigrationName
   ```

   *Or via direct TypeORM CLI:*

   ```bash
   npx ts-node -r tsconfig-paths/register \
     ./node_modules/typeorm/cli.js \
     migration:create \
     src/migrations/YourMigrationName
   ```

4. **Edit the migration** to implement `up` and `down`:

   ```ts
   export class <Timestamp>FileName implements MigrationInterface {
     public async up(qr: QueryRunner): Promise<void> {
       // Apply DDL/DML changes
     }
     public async down(qr: QueryRunner): Promise<void> {
       // Revert changes
     }
   }
   ```

5. **Run all pending migrations**

   ```bash
   pnpm run migration:run
   ```

6. **Revert the last migration**

   ```bash
   pnpm run migration:revert
   ```

**Notes & Best Practices:**

* Prefer `migration:generate` for entity-driven diffs.
* Use `migration:create` only for custom DDL/DML.
* Always include `--dataSource src/config/datasource.ts` on non-create commands.
* To reset the local schema:

  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```

---

## Migration Best Practices

* **Auto-generated diffs**: Use `pnpm run migration:generate -- src/migrations/YourMigrationName`.
* **Manual stubs** for complex operations.
* **Specify data source** on all non-create commands.
* **Maintain chronological timestamps** for migration files.
* **Verify pending migrations** before applying.

---

## Production Deployment

1. Copy `.env.example` to `.env.production` and fill production values.

2. Create `vault/config/prod.hcl` with KV v2, auto-unseal, audit, telemetry, etc.

3. In `docker-compose.prod.yml`, mount it:

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

* **api\_addr**: client API address (e.g. `https://vault.your-domain.com:8200`)
* **cluster\_addr**: HA cluster address (`8201`)
* **storage**: backend (file, Consul, S3, etc.)
* **listener**: TCP listener settings
* **seal**: auto-unseal (AWS KMS, etc.)
* **audit**: logging (file, syslog)
* **telemetry**: Prometheus metrics
* **secrets "kv"**: mount KV v2 at `secret/`

---

## Useful Commands

* **Lint & Format**

  ```bash
  pnpm run lint
  pnpm run format
  ```
* **Tests & Coverage**

  ```bash
  pnpm run test
  pnpm run test:e2e
  pnpm run test:cov
  ```
* **Vault CLI (dev)**

  ```bash
  vault status
  vault secrets list -detailed
  ```
* **Vault via Docker**

  ```bash
  docker exec -it vault vault kv list secret/
  docker exec -it vault vault kv put secret/ethereum/<id> privateKey=0x...
  ```

---

## Manual Vault Key Verification

1. Exec into the Vault container:

   ```bash
   docker exec -it vault sh
   ```

2. Configure the Vault CLI:

   ```sh
   export VAULT_ADDR='http://127.0.0.1:8200'
   export VAULT_TOKEN='dev-only-token'
   ```

3. Inspect secrets:

   ```bash
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

Enjoy secure key management! 🚀

/**
 * @file      prod.hcl
 * @brief     Production configuration for HashiCorp Vault.
 */

/**
 * @section global
 * @description Global parameters for Vault runtime.
 */

# The API address clients will use to reach Vault
api_addr      = "https://vault.your-domain.com:8200"
# The cluster address for internal VAULT-VAULT communication (HA setups)
cluster_addr  = "https://vault.your-domain.com:8201"

# Enable the built‑in UI
ui = true

/**
 * @section storage
 * @description Defines where Vault persists its data on disk.
 */
storage "file" {
  path = "/vault/data"
}

/**
 * @section listener
 * @description Configures the HTTP listener for Vault (no TLS for simplicity).
 */
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

/**
 * @section seal
 * @description (Optional) Auto-unseal configuration using AWS KMS.
 * Uncomment and configure if you want Vault to auto-unseal in production.
 */
# seal "awskms" {
#   region     = "eu-west-1"
#   kms_key_id = "arn:aws:kms:..."
# }

/**
 * @section audit
 * @description Enable file-based audit logging of all Vault API requests.
 */
audit "file" {
  file_path = "/vault/logs/audit.log"
  log_raw   = true
}

/**
 * @section telemetry
 * @description Collect metrics for Prometheus.
 */
telemetry {
  prometheus_retention_time = "24h"
}

/**
 * @section secrets_kv
 * @description Mounts a KV v2 secrets engine at the `secret/` path,
 *              enabling versioning of stored secrets.
 *
 * @param path    The mount path in Vault.
 * @param version The schema version (must be 2 for KV-v2).
 */
secrets "kv" {
  path    = "secret"
  version = 2
}

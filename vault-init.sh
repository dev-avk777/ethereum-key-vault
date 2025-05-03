#!/bin/sh
export VAULT_ADDR=http://0.0.0.0:8200
export VAULT_TOKEN=dev-only-token
vault secrets disable secret/
vault secrets enable -path=secret -version=2 kv
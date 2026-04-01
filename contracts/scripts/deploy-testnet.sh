#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESSES_FILE="$ROOT_DIR/scripts/addresses.json"
NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE_ACCOUNT="${STELLAR_SOURCE_ACCOUNT:-${1:-}}"
POLICY_WASM="$ROOT_DIR/target/wasm32v1-none/release/xmpp_policy.wasm"
SESSION_REGISTRY_WASM="$ROOT_DIR/target/wasm32v1-none/release/xmpp_session_registry.wasm"

if ! command -v stellar >/dev/null 2>&1; then
  echo "[xMPP] stellar CLI is required but not installed." >&2
  exit 1
fi

if [[ -z "${SOURCE_ACCOUNT}" ]]; then
  echo "[xMPP] missing deploy identity." >&2
  echo "Set STELLAR_SOURCE_ACCOUNT or pass an identity/secret as the first argument." >&2
  exit 1
fi

echo "[xMPP] building Soroban contracts for ${NETWORK}"
stellar contract build --manifest-path "$ROOT_DIR/Cargo.toml"

echo "[xMPP] deploying xmpp-policy"
POLICY_ID="$(
  stellar contract deploy \
    --wasm "$POLICY_WASM" \
    --network "$NETWORK" \
    --source-account "$SOURCE_ACCOUNT"
)"

echo "[xMPP] deploying xmpp-session-registry"
SESSION_REGISTRY_ID="$(
  stellar contract deploy \
    --wasm "$SESSION_REGISTRY_WASM" \
    --network "$NETWORK" \
    --source-account "$SOURCE_ACCOUNT"
)"

node -e '
  const fs = require("node:fs");
  const path = process.argv[1];
  const policyId = process.argv[2];
  const sessionRegistryId = process.argv[3];
  const next = {
    policyContractId: policyId,
    sessionRegistryContractId: sessionRegistryId,
  };
  fs.writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
' "$ADDRESSES_FILE" "$POLICY_ID" "$SESSION_REGISTRY_ID"

echo "[xMPP] deployed contract ids"
echo "XMPP_POLICY_CONTRACT_ID=$POLICY_ID"
echo "XMPP_SESSION_REGISTRY_CONTRACT_ID=$SESSION_REGISTRY_ID"
echo "[xMPP] addresses written to $ADDRESSES_FILE"

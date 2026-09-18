#!/usr/bin/env bash
# Preview the committed checkout, or promote/rollback an explicit saved receipt.
# Existing service access controls are preserved. This script never chooses "latest".
# .env.local is copied into the temporary build source as in the original deployment.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --import tsx scripts/release-deploy.ts "$@"

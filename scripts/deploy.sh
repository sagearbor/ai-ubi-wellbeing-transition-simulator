#!/usr/bin/env bash
# Deploy the current checkout to the existing Cloud Run service.
#
# Defaults target the service AI Studio originally created (see CONFERENCE.md).
# By default the new revision receives NO traffic and is reachable at a tagged
# preview URL (https://<tag>---<service>-<hash>.<region>.run.app); promote it with:
#   gcloud run services update-traffic "$SERVICE" --region "$REGION" --project "$PROJECT" --to-latest
# or pass --promote to send 100% of traffic to the new revision immediately.
#
# Requires: gcloud authenticated, Cloud Build + Artifact Registry APIs enabled.
# The Gemini key is read by Vite from .env.local (uploaded with the source; not in git).
set -euo pipefail

PROJECT="${GCP_PROJECT:-gen-lang-client-0281141814}"
REGION="${GCP_REGION:-us-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-wellbeing-transition-simulator}"
TAG="${DEPLOY_TAG:-main}"
if ! grep -qE '^GEMINI_API_KEY=.+' .env.local 2>/dev/null; then
  echo "warning: no GEMINI_API_KEY in .env.local - the Analysis tab will be disabled in this build" >&2
fi

TRAFFIC_ARGS=(--no-traffic --tag "$TAG")
if [[ "${1:-}" == "--promote" ]]; then
  TRAFFIC_ARGS=()
fi

echo "Deploying $SERVICE to $PROJECT/$REGION (tag: $TAG, promote: ${1:-no})"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  "${TRAFFIC_ARGS[@]}"

#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="splitifyd"
DEFAULT_SA="firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com"
COMPUTE_SA="501123495201-compute@developer.gserviceaccount.com"

SERVICE_ACCOUNT="${1:-$DEFAULT_SA}"

if [[ "${SERVICE_ACCOUNT}" != *"@"* ]]; then
  echo "Usage: $0 [service-account-email]"
  echo "Supply a full service account email (default: ${DEFAULT_SA})."
  exit 1
fi

echo "🔧 Configuring IAM bindings for ${SERVICE_ACCOUNT} in project ${PROJECT_ID}"
echo

echo "➡️  Setting active project..."
gcloud config set project "${PROJECT_ID}"
echo

echo "➡️  Granting Firebase Admin..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/firebase.admin"
echo

echo "➡️  Granting Firebase Rules Admin..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/firebaserules.admin"
echo

echo "➡️  Granting Cloud Scheduler Admin..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudscheduler.admin"
echo

echo "➡️  Allowing deploys to impersonate ${COMPUTE_SA}..."
gcloud iam service-accounts add-iam-policy-binding \
  "${COMPUTE_SA}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"
echo

echo "✅ Completed IAM setup for ${SERVICE_ACCOUNT}"

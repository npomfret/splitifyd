#!/usr/bin/env bash
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required" >&2
  exit 1
fi

#PROJECT_ID=todo - get this from config
BUCKET_NAME="${THEME_BUCKET:-themes}"
#LOCATION=todo - get this from config
CORS_FILE="${THEME_CORS_FILE:-$(pwd)/scripts/theme-storage/cors.json}"

# WTF?? this is total bullshit - the origin is nonsense - what is this for???????
if [[ ! -f "$CORS_FILE" ]]; then
  cat <<'JSON' > "$CORS_FILE"
[
  {
    "origin": ["http://localhost:5173", "https://splitifyd.com"],
    "method": ["GET"],
    "responseHeader": ["Content-Type", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
JSON
fi

echo "Creating bucket gs://${BUCKET_NAME} in ${LOCATION} (project ${PROJECT_ID})"
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${LOCATION}" \
  --uniform-bucket-level-access \
  --public-access-prevention

echo "Applying CORS policy from ${CORS_FILE}"
gsutil cors set "$CORS_FILE" "gs://${BUCKET_NAME}"

echo "Granting Firebase service account read access"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectViewer" "gs://${BUCKET_NAME}"

echo "Theme bucket ready"

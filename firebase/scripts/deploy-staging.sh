#!/usr/bin/env bash
set -euo pipefail

# Deploy to staging-1 Firebase instance
# Usage: ./scripts/deploy-staging.sh [all|functions|hosting|rules|indexes]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREBASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$FIREBASE_DIR"

# Set service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"

# Verify service account key exists
if [[ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
    echo "❌ Error: Service account key not found at $GOOGLE_APPLICATION_CREDENTIALS"
    exit 1
fi

# Determine what to deploy
DEPLOY_TARGET="${1:-all}"

# Common setup: switch to staging-1 instance
echo "🔄 Switching to staging-1 instance..."
tsx scripts/switch-instance.ts staging-1

# Cleanup function to remove .env on exit
cleanup() {
    rm -f functions/.env
    echo "✅ Cleaned up functions/.env"
}
trap cleanup EXIT

case "$DEPLOY_TARGET" in
    all|staging-1)
        echo "🚀 Deploying all (functions, rules, hosting)..."
        export FUNCTIONS_SOURCE=".firebase/deploy/functions"
        export FUNCTIONS_PREDEPLOY="echo Build completed by prepare-functions-deploy.js"
        node scripts/prepare-functions-deploy.js
        firebase deploy --only functions,firestore:rules,hosting
        ;;

    functions)
        echo "🚀 Deploying functions only..."
        export FUNCTIONS_SOURCE=".firebase/deploy/functions"
        export FUNCTIONS_PREDEPLOY="echo Build completed by prepare-functions-deploy.js"
        node scripts/prepare-functions-deploy.js
        firebase deploy --only functions
        ;;

    hosting)
        echo "🚀 Deploying hosting only..."
        firebase deploy --only hosting
        ;;

    rules)
        echo "🚀 Deploying Firestore rules only..."
        firebase deploy --only firestore:rules
        ;;

    indexes)
        echo "🚀 Deploying Firestore indexes (with --force)..."
        firebase deploy --only firestore:indexes --force
        ;;

    *)
        echo "❌ Error: Unknown deployment target '$DEPLOY_TARGET'"
        echo "Usage: $0 [all|functions|hosting|rules|indexes]"
        exit 1
        ;;
esac

echo "✅ Deployment complete!"

# Additional staging operations can be run via:
# - download-indexes: Download Firestore indexes from staging
# - sync-tenant: Sync tenant configs to staging
# - seed-policies: Seed policy documents to staging

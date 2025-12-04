#!/usr/bin/env bash
set -euo pipefail

# Deploy to a staging Firebase instance
# Usage: ./scripts/deploy-staging.sh [all|functions|hosting|rules|indexes] [instance]
# Example: ./scripts/deploy-staging.sh functions staging-1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREBASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$FIREBASE_DIR"

# Set service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"

# Verify service account key exists
if [[ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
    echo "❌ Error: Service account key not found at $GOOGLE_APPLICATION_CREDENTIALS"
    exit 1
fi

# Determine what to deploy and which instance
DEPLOY_TARGET="${1:-all}"
INSTANCE="${2:-staging-1}"

# Validate instance is a staging instance
if [[ ! "$INSTANCE" =~ ^staging-[0-9]+$ ]]; then
    echo "❌ Error: Instance must be a staging instance (staging-1, staging-2, etc.)"
    echo "Got: $INSTANCE"
    exit 1
fi

# Check if .env exists and is a symlink (dev environment)
ENV_FILE="functions/.env"
RESTORE_SYMLINK=""
if [[ -L "$ENV_FILE" ]]; then
    RESTORE_SYMLINK="$(readlink "$ENV_FILE")"
    echo "📎 Preserving existing .env symlink: $RESTORE_SYMLINK"
fi

# Common setup: switch to staging instance
echo "🔄 Switching to $INSTANCE instance..."
tsx scripts/switch-instance.ts "$INSTANCE"

# Cleanup function to restore previous .env state on exit
cleanup() {
    if [[ -n "$RESTORE_SYMLINK" ]]; then
        rm -f "$ENV_FILE"
        ln -sf "$RESTORE_SYMLINK" "$ENV_FILE"
        echo "✅ Restored .env symlink to: $RESTORE_SYMLINK"
    else
        rm -f "$ENV_FILE"
        echo "✅ Cleaned up functions/.env"
    fi
}
trap cleanup EXIT

case "$DEPLOY_TARGET" in
    all)
        echo "🚀 Deploying all (functions, rules, hosting) to $INSTANCE..."
        node scripts/deployment/prepare-functions-deploy.js
        firebase deploy --only functions,firestore:rules,hosting
        ;;

    functions)
        echo "🚀 Deploying functions only to $INSTANCE..."
        node scripts/deployment/prepare-functions-deploy.js
        firebase deploy --only functions
        ;;

    hosting)
        echo "🚀 Deploying hosting only to $INSTANCE..."
        firebase deploy --only hosting
        ;;

    rules)
        echo "🚀 Deploying Firestore rules only to $INSTANCE..."
        firebase deploy --only firestore:rules
        ;;

    indexes)
        echo "🚀 Deploying Firestore indexes (with --force) to $INSTANCE..."
        firebase deploy --only firestore:indexes --force
        ;;

    *)
        echo "❌ Error: Unknown deployment target '$DEPLOY_TARGET'"
        echo "Usage: $0 [all|functions|hosting|rules|indexes] [instance]"
        echo "Example: $0 functions staging-1"
        exit 1
        ;;
esac

echo "✅ Deployment to $INSTANCE complete!"

# Additional staging operations can be run via:
# - download-indexes: Download Firestore indexes from staging
# - sync-tenant: Sync tenant configs to staging
# - seed-policies: Seed policy documents to staging

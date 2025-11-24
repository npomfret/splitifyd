#!/usr/bin/env bash
set -euo pipefail

# Staging-1 operations (post-deploy, maintenance, etc.)
# Usage: ./scripts/staging-operations.sh [download-indexes|sync-tenant|seed-policies]

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

# Determine operation
OPERATION="${1:-}"

if [[ -z "$OPERATION" ]]; then
    echo "❌ Error: No operation specified"
    echo "Usage: $0 [download-indexes|sync-tenant|seed-policies]"
    exit 1
fi

# Cleanup function to remove .env on exit
cleanup() {
    rm -f functions/.env
    echo "✅ Cleaned up functions/.env"
}
trap cleanup EXIT

case "$OPERATION" in
    download-indexes)
        echo "📥 Downloading Firestore indexes from staging..."
        firebase firestore:indexes --project splitifyd > firestore.indexes.json
        echo "✅ Indexes saved to firestore.indexes.json"
        ;;

    sync-tenant)
        echo "🔄 Syncing tenant configs to staging (default only)..."
        tsx scripts/switch-instance.ts staging-1
        tsx scripts/sync-tenant-configs.ts staging --default-only
        echo "✅ Tenant configs synced"
        ;;

    seed-policies)
        echo "🌱 Seeding policy documents to staging..."
        tsx scripts/switch-instance.ts staging-1
        tsx scripts/seed-policies.ts staging
        echo "✅ Policies seeded"
        ;;

    *)
        echo "❌ Error: Unknown operation '$OPERATION'"
        echo "Usage: $0 [download-indexes|sync-tenant|seed-policies]"
        exit 1
        ;;
esac

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
        echo "🔄 Syncing staging tenant to deployed Firebase..."
        tsx scripts/switch-instance.ts staging-1

        echo "  📦 Syncing staging-tenant (splitifyd.web.app)..."
        tsx scripts/publish-staging-themes.ts

        echo "✅ Tenant config synced and theme published"
        ;;

    seed-policies)
        echo "🌱 Seeding policy documents to staging..."
        tsx scripts/switch-instance.ts staging-1
        tsx scripts/seed-policies.ts staging
        echo "✅ Policies seeded"
        ;;

    list-admins)
        echo "📋 Listing admin users from staging..."
        tsx scripts/switch-instance.ts staging-1
        tsx scripts/list-admin-users.ts staging
        ;;

    promote-admin)
        if [[ -z "${2:-}" ]] || [[ -z "${3:-}" ]]; then
            echo "❌ Error: Email and role required for promote-admin"
            echo "Usage: $0 promote-admin <email> <role>"
            echo ""
            echo "Valid roles:"
            echo "  system_admin  - Can access admin panel, manage all users"
            echo "  tenant_admin  - Can manage tenant settings"
            echo ""
            echo "Example:"
            echo "  $0 promote-admin user@example.com system_admin"
            exit 1
        fi
        EMAIL="$2"
        ROLE="$3"
        echo "👑 Promoting user to admin in staging..."
        tsx scripts/switch-instance.ts staging-1
        tsx scripts/promote-user-to-admin.ts staging "$EMAIL" "$ROLE"
        ;;

    *)
        echo "❌ Error: Unknown operation '$OPERATION'"
        echo "Usage: $0 [download-indexes|sync-tenant|seed-policies|list-admins|promote-admin]"
        exit 1
        ;;
esac

#!/usr/bin/env bash
set -euo pipefail

# Staging-1 operations (post-deploy, maintenance, etc.)
# Usage: ./scripts/staging-operations.sh [download-indexes|sync-tenant|seed-policies]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREBASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$FIREBASE_DIR"

# Set service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/../../service-account-key.json"

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
        if [[ -z "${2:-}" ]] || [[ -z "${3:-}" ]]; then
            echo "❌ Error: Email and password required for sync-tenant"
            echo "Usage: $0 sync-tenant <email> <password> [tenant-id]"
            echo ""
            echo "Example:"
            echo "  GCLOUD_PROJECT=splitifyd $0 sync-tenant admin@example.com mypassword           # Sync all tenants"
            echo "  GCLOUD_PROJECT=splitifyd $0 sync-tenant admin@example.com mypassword staging-tenant  # Sync specific tenant"
            exit 1
        fi
        ADMIN_EMAIL="$2"
        ADMIN_PASSWORD="$3"
        TENANT_ID="${4:-}"

        echo "🔄 Syncing tenant configs to deployed Firebase..."
        tsx scripts/switch-instance.ts staging-1

        if [[ -n "$TENANT_ID" ]]; then
            echo "  📦 Syncing tenant: $TENANT_ID..."
            tsx scripts/sync-tenant-configs.ts https://splitifyd.web.app "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --tenant-id "$TENANT_ID"
        else
            echo "  📦 Syncing ALL tenants..."
            tsx scripts/sync-tenant-configs.ts https://splitifyd.web.app "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
        fi

        echo "✅ Tenant config(s) synced and theme(s) published"
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

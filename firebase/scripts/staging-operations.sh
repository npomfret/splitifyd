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
        # Check if credentials are provided via command line or environment variables
        if [[ -n "${2:-}" ]] && [[ -n "${3:-}" ]] && [[ -n "${4:-}" ]]; then
            ADMIN_EMAIL="$2"
            ADMIN_PASSWORD="$3"
            BASE_URL="$4"
        elif [[ -n "${STAGING_ADMIN_EMAIL:-}" ]] && [[ -n "${STAGING_ADMIN_PASSWORD:-}" ]] && [[ -n "${STAGING_BASE_URL:-}" ]]; then
            ADMIN_EMAIL="$STAGING_ADMIN_EMAIL"
            ADMIN_PASSWORD="$STAGING_ADMIN_PASSWORD"
            BASE_URL="$STAGING_BASE_URL"
        else
            echo "❌ Error: Admin credentials and base URL required for sync-tenant"
            echo ""
            echo "Option 1 - Command line arguments:"
            echo "  Usage: $0 sync-tenant <admin-email> <admin-password> <base-url>"
            echo ""
            echo "Option 2 - Environment variables:"
            echo "  export STAGING_ADMIN_EMAIL='admin@example.com'"
            echo "  export STAGING_ADMIN_PASSWORD='mypassword'"
            echo "  export STAGING_BASE_URL='https://us-central1-splitifyd.cloudfunctions.net/api'"
            echo "  $0 sync-tenant"
            echo ""
            echo "Example (command line):"
            echo "  $0 sync-tenant admin@example.com mypassword https://us-central1-splitifyd.cloudfunctions.net/api"
            exit 1
        fi

        echo "🔄 Syncing staging tenants to deployed Firebase..."
        tsx scripts/switch-instance.ts staging-1

        echo "  📦 Syncing staging-default-tenant (brutalist fallback)..."
        tsx scripts/sync-tenant-configs.ts staging --tenant-id staging-default-tenant

        echo "  📦 Syncing staging-tenant (splitifyd.web.app)..."
        tsx scripts/sync-tenant-configs.ts staging --tenant-id staging-tenant

        echo "  🎨 Publishing themes for both tenants..."
        tsx scripts/publish-staging-themes.ts "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$BASE_URL"

        echo "✅ Tenant configs synced (2 tenants) and themes published"
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

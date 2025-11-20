# Cloud Storage for Theme Artifacts

## Problem Statement

Legacy theme publishing wrote CSS/Tokens to `file://` paths under the repo, which failed in production because:

1. Cloud Functions instances don't share a filesystem
2. Local tmp storage is ephemeral and cleared between cold starts
3. `file://` URLs aren't web-accessible

That limitation has now been addressed—artifacts are uploaded to Cloud Storage in both emulator and production modes—but this document tracks the implementation details and the remaining rollout plan.

**Legacy Implementation (before migration):**
- `ThemeArtifactStorage.ts` returned `file://` paths that pointed to `tmp/theme-artifacts/{tenantId}/{hash}/theme.css`.
- `ThemeHandlers.ts` only understood `file://` URLs.
- The factory always returned `LocalThemeArtifactStorage`, even in prod.

**Current Implementation (now in main):**
- `CloudThemeArtifactStorage` (firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts) uploads CSS + tokens to the project bucket, makes them public, and returns `https://` or emulator `http://` URLs.
- `createThemeArtifactStorage()` (firebase/functions/src/services/storage/ThemeArtifactStorage.ts) now always instantiates the cloud-backed storage.
- `ThemeHandlers` fetches CSS via HTTP(S), validates cache headers, and no longer accepts `file://` URLs.

**Outstanding Needs (operational/runbook work):**
- Ensure every environment runs the storage bootstrap script so Cloud Storage CORS + marker files exist.
- Republish themes after switching to the cloud backend so tenants receive the new URLs.
- Keep verifying `/theme.css` delivery when onboarding new tenants/environments.

---

## Solution Overview

We created a Cloud Storage bucket workflow and migrated from `file://` URLs to HTTP(S) URLs. The solution includes:

1. Script to create/configure the bucket (`firebase/scripts/setup-storage-bucket.ts`, exposed via `npm run storage:setup`)
2. Cloud Storage implementation (`CloudThemeArtifactStorage`)
3. Updated theme handlers to fetch from HTTPS/HTTP (depending on environment)
4. Integration with the publish flow + regression tests

The sections below capture what shipped and what still needs operational follow-through.

---

## Status Snapshot

- ✅ Cloud storage save + handler updates landed (see files listed above)
- ✅ Integration coverage exists under `firebase/functions/src/__tests__/integration/tenant/`
- ✅ Hosting rewrite path covered by `firebase/functions/src/__tests__/integration/tenant/theme-css.test.ts` (checks `/api/theme.css` via the Hosting emulator on port 7005)
- ✅ `npm run storage:setup` bootstraps the bucket (CORS + marker file)
- ✅ Operations: run the bucket script per environment (confirmed `npm run storage:setup` has been executed)
- 🔄 Operations: republish tenants and verify `/theme.css` delivery + caching with the cloud URLs

---

## Phase 1: Bucket Setup Script

**Status:** ✅ Implemented (`firebase/scripts/setup-storage-bucket.ts`, exposed via `npm run storage:setup`)

The script already:
- Initializes Firebase Admin using the selected instance template
- Verifies the default bucket exists
- Writes `theme-artifacts/.initialized`
- Applies permissive CORS headers for GET/HEAD requests

**Operational follow-up:**
Run the script whenever a new environment/instance is provisioned so the bucket metadata stays in sync:

```bash
cd firebase
npm run storage:setup production   # or pass the instance profile you switched to
```

If we want lifecycle pruning (e.g., delete artifacts older than 90 days) we can extend this script in a follow-up—today it only ensures the bucket exists + has CORS configured.

---

## Phase 2: Cloud Storage Implementation

**Status:** ✅ Implemented in `firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts`

```typescript
import * as admin from 'firebase-admin';
import { logger } from '../../logger';
import type { ThemeArtifactPayload, ThemeArtifactStorage } from './ThemeArtifactStorage';

interface ThemeArtifactLocation {
    cssUrl: string;
    tokensUrl: string;
}

export class CloudThemeArtifactStorage implements ThemeArtifactStorage {
    constructor(private readonly getStorageInstance: () => admin.storage.Storage) {}

    async save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation> {
        const bucket = this.getStorageInstance().bucket();
        const { tenantId, hash, cssContent, tokensJson } = payload;

        const cssPath = `theme-artifacts/${tenantId}/${hash}/theme.css`;
        const tokensPath = `theme-artifacts/${tenantId}/${hash}/tokens.json`;

        const cssFile = bucket.file(cssPath);
        const tokensFile = bucket.file(tokensPath);

        // Upload both files in parallel
        await Promise.all([
            cssFile.save(cssContent, {
                metadata: {
                    contentType: 'text/css; charset=utf-8',
                    cacheControl: 'public, max-age=31536000, immutable',
                    metadata: {
                        tenantId,
                        hash,
                        generatedAt: new Date().toISOString(),
                    },
                },
            }),
            tokensFile.save(tokensJson, {
                metadata: {
                    contentType: 'application/json; charset=utf-8',
                    cacheControl: 'public, max-age=31536000, immutable',
                    metadata: {
                        tenantId,
                        hash,
                        generatedAt: new Date().toISOString(),
                    },
                },
            }),
        ]);

        // Make files publicly readable
        await Promise.all([
            cssFile.makePublic(),
            tokensFile.makePublic(),
        ]);

        // Get public URLs - use emulator URL for test/dev environments
        let cssUrl: string;
        let tokensUrl: string;

        const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

        if (storageHost) {
            // Emulator URL format: http://localhost:PORT/v0/b/BUCKET/o/PATH
            const baseUrl = `http://${storageHost}/v0/b/${bucket.name}/o`;
            cssUrl = `${baseUrl}/${encodeURIComponent(cssPath)}?alt=media`;
            tokensUrl = `${baseUrl}/${encodeURIComponent(tokensPath)}?alt=media`;
        } else {
            // Production URL format
            cssUrl = `https://storage.googleapis.com/${bucket.name}/${cssPath}`;
            tokensUrl = `https://storage.googleapis.com/${bucket.name}/${tokensPath}`;
        }

        logger.info('Saved cloud theme artifacts', {
            tenantId,
            hash,
            cssUrl,
            tokensUrl,
        });

        return { cssUrl, tokensUrl };
    }
}
```

---

## Phase 3: Update Storage Factory

**Status:** ✅ Implemented in `firebase/functions/src/services/storage/ThemeArtifactStorage.ts` (factory now always returns the cloud-backed storage; Local storage helpers only exist in bespoke dev scripts)

```typescript
import crypto from 'crypto';
import { getStorage } from '../../firebase';
import { CloudThemeArtifactStorage } from './CloudThemeArtifactStorage';

export interface ThemeArtifactPayload {
    tenantId: string;
    hash: string;
    cssContent: string;
    tokensJson: string;
}

interface ThemeArtifactLocation {
    cssUrl: string;
    tokensUrl: string;
}

export interface ThemeArtifactStorage {
    save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation>;
}

let _instance: ThemeArtifactStorage | undefined;

export function createThemeArtifactStorage(): ThemeArtifactStorage {
    if (!_instance) {
        _instance = new CloudThemeArtifactStorage(() => getStorage());
    }
    return _instance;
}

export function computeSha256(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}
```

---

## Phase 4: Update Theme Handlers to Support HTTP(S) URLs

**Status:** ✅ Implemented in `firebase/functions/src/theme/ThemeHandlers.ts`—handlers now validate HTTP(S) URLs and fetch from Cloud Storage in both emulator and prod

```typescript
private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
    // Accept both https:// (production) and http:// (emulator)
    if (!artifact.cssUrl.startsWith('https://') && !artifact.cssUrl.startsWith('http://')) {
        logger.error('Invalid CSS artifact URL - must be HTTP(S)', { cssUrl: artifact.cssUrl });
        throw new ApiError(
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            'THEME_STORAGE_INVALID',
            'Theme CSS URL must be HTTP(S)',
        );
    }

    const response = await fetch(artifact.cssUrl);
    if (!response.ok) {
        throw new ApiError(
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            'THEME_FETCH_FAILED',
            `Failed to fetch theme from Cloud Storage: ${response.status}`,
        );
    }
    return response.text();
}
```

---

## Phase 5: Testing Strategy

**Status:** ✅ Coverage in place (see `firebase/functions/src/__tests__/integration/tenant/theme-css.test.ts` and `firebase/functions/src/__tests__/integration/tenant/admin-tenant-publish.test.ts`)—excerpt below kept for reference

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ApiDriver } from '@splitifyd/test-support';

describe('Cloud Storage Theme Artifacts', () => {
    let api: ApiDriver;
    let adminToken: string;

    beforeAll(async () => {
        api = new ApiDriver();
        const admin = await api.getDefaultAdminUser();
        adminToken = admin.token;
    });

    it('should generate and store theme artifacts with https:// URLs in production', async () => {
        // Skip in emulator
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
            return;
        }

        const result = await api.publishTenantTheme(adminToken, {
            tenantId: 'localhost-tenant',
        });

        expect(result.artifact.cssUrl).toMatch(/^https:\/\//);
        expect(result.artifact.tokensUrl).toMatch(/^https:\/\//);
        expect(result.artifact.hash).toBeDefined();
    });

    it('should serve theme CSS from Cloud Storage', async () => {
        // Ensure an artifact exists in emulator before fetching
        const tenantId = 'localhost-tenant';
        const result = await api.publishTenantTheme(adminToken, { tenantId });

        const response = await api.get('/api/theme.css', {
            headers: { Host: 'localhost' },
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/css');
        expect(response.data).toContain(':root');
        expect(response.headers.etag).toContain(result.artifact.hash);
    });
});
```

---

## Execution Plan

### Engineering Deliverables
- [x] Implement Cloud Storage save logic (`CloudThemeArtifactStorage`)
- [x] Update `createThemeArtifactStorage()` to return the cloud-backed implementation everywhere
- [x] Teach `ThemeHandlers` to fetch HTTP(S) URLs and emit correct caching headers
- [x] Add integration coverage for admin publish + `/theme.css`
- [x] Expose `npm run storage:setup` (runs `firebase/scripts/setup-storage-bucket.ts`)

### Operational Follow-Up
- [ ] Run `npm run storage:setup production` (and for any other environments) after switching instances, so the bucket marker + CORS config exist
- [ ] Republish themes via `npm run theme:publish-local` (or the admin API) so tenants receive the new artifact URLs
- [ ] Spot-check `/theme.css` per tenant (curl or browser) to confirm caching headers + ETag reflect the latest hash
- [ ] (Optional) Extend the setup script with lifecycle policies once we decide on retention (original plan suggested 90-day cleanup)

---

## Files Summary

### Key Implementation Files
1. `firebase/scripts/setup-storage-bucket.ts` – Bucket bootstrapper invoked via `npm run storage:setup`
2. `firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts` – Uploads CSS/tokens to Cloud Storage
3. `firebase/functions/src/services/storage/ThemeArtifactStorage.ts` – Factory returning the cloud storage implementation
4. `firebase/functions/src/theme/ThemeHandlers.ts` – Fetches CSS via HTTP(S) URLs and sets cache headers

### Tests & Tooling
1. `firebase/functions/src/__tests__/integration/tenant/admin-tenant-publish.test.ts` – Verifies publish flow writes artifact metadata
2. `firebase/functions/src/__tests__/integration/tenant/theme-css.test.ts` – Fetches `/theme.css` and asserts headers/body
3. `firebase/scripts/publish-local-themes.ts` – Seeds tenants + republish themes locally (uses the admin API)
4. `scripts/verify-theme-css.ts` – Dev helper (still references `LocalThemeArtifactStorage`; consider updating if this script is revived)

### Commands

```bash
# One-time setup: Initialize bucket
cd firebase
npm run storage:setup production

# Republish themes with new Cloud Storage backend
npm run theme:publish-local

# Verify themes are accessible
curl https://your-domain.com/api/theme.css

# Run integration tests (follow wrapper rules; no extra args)
npm run test:integration  # then filter within workspace if needed
```

---

## Total Estimated Time

**4-6 hours** to complete all phases and testing.

---

## Success Criteria

- [x] Theme artifacts upload to Cloud Storage (dev + prod paths share the same implementation)
- [x] Artifacts return HTTP(S) URLs (emulator uses `http://`, prod uses `https://`)
- [x] Theme CSS serves correctly from Cloud Storage via `ThemeHandlers`
- [x] Emulator continues to work (handlers explicitly allow `http://` URLs)
- [x] Integration coverage exists for admin publish + `/theme.css`
- [x] `npm run storage:setup` configures CORS + bucket scaffolding
- [x] Operations: run the setup script in every deployed environment (prod + staging, etc.)
- [ ] Operations: republish tenant themes and spot-check `/theme.css` responses + caching headers with the new URLs

---

## Notes

- Dev and prod both use Cloud Storage (no file:// support)
- Production automatically switches to Cloud Storage
- Bucket setup is idempotent (safe to run multiple times)
- Bucket configured via `FIREBASE_CONFIG.storageBucket` or derived from `GCLOUD_PROJECT`

---

## Bucket Directory Structure

The Cloud Storage bucket is organized into two main sections:

### 1. Theme Artifacts (`theme-artifacts/`)

**Current Implementation** ✅

```
theme-artifacts/
├── {tenantId}/
│   └── {hash}/
│       ├── theme.css      (generated CSS from branding tokens)
│       └── tokens.json    (full branding token configuration)
```

**Characteristics:**
- Content-addressed by SHA-256 hash (immutable)
- Signed URLs with far-future expiry (2500)
- Automatic lifecycle: Clean up after 90 days (optional)
- Read: Signed URLs only (no direct access)
- Write: Service account only (via Cloud Functions)

**Example:**
```
theme-artifacts/
├── localhost-tenant/
│   └── abc123def456789.../
│       ├── theme.css
│       └── tokens.json
└── tenant-company-acme/
    └── 987fed654321abc.../
        ├── theme.css
        └── tokens.json
```

### 2. Tenant Assets (`tenant-assets/`)

**Future Enhancement** 🔮

```
tenant-assets/
├── {tenantId}/
│   ├── logos/
│   │   ├── logo.png           (main logo, light theme)
│   │   ├── logo-dark.png      (dark mode variant)
│   │   ├── logo-square.png    (square variant for avatars)
│   │   ├── favicon.ico        (browser favicon)
│   │   └── favicon-32x32.png  (PNG favicon)
│   │
│   ├── branding/
│   │   ├── hero-bg.jpg        (landing page hero background)
│   │   ├── og-image.png       (social media share image 1200x630)
│   │   ├── email-header.png   (email template header)
│   │   └── app-icon-512.png   (PWA app icon)
│   │
│   └── uploads/
│       └── {userId}/          (user-generated content)
│           ├── {fileId}.jpg
│           └── {fileId}.pdf
```

**Planned Security Model:**

| Path | Read Access | Write Access | Use Case |
|------|-------------|--------------|----------|
| `theme-artifacts/{tenantId}/{hash}/` | Public read | Service account | Theme CSS delivery |
| `tenant-assets/{tenantId}/logos/` | Public read | Tenant admins + service account | Logo display |
| `tenant-assets/{tenantId}/branding/` | Public read | Tenant admins + service account | Marketing assets |
| `tenant-assets/{tenantId}/uploads/{userId}/` | Authenticated users in tenant | File owner + admins | User content |

**Example:**
```
tenant-assets/
├── localhost-tenant/
│   ├── logos/
│   │   ├── logo.png
│   │   └── favicon.ico
│   └── branding/
│       ├── hero-bg.jpg
│       └── og-image.png
│
└── tenant-company-acme/
    ├── logos/
    │   ├── logo.png
    │   ├── logo-dark.png
    │   └── favicon.ico
    └── branding/
        ├── hero-bg.jpg
        └── email-header.png
```

**Implementation Notes:**
- Tenant assets are **not yet implemented**
- Will require separate upload endpoints and storage rules
- Logo URLs currently stored as external URLs in branding config
- Future: Store uploaded logos in `tenant-assets/{tenantId}/logos/` and generate public URLs

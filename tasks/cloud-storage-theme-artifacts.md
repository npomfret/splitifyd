# Cloud Storage for Theme Artifacts

## Problem Statement

Theme CSS files are currently stored using `file://` URLs, which works in the emulator but **won't work in production** because:

1. Cloud Functions instances don't share a filesystem
2. Local tmp storage is ephemeral and cleared between cold starts
3. `file://` URLs aren't web-accessible

**Current Implementation (actual):**
- `ThemeArtifactStorage.ts` returns `file://` paths that point to `tmp/theme-artifacts/{tenantId}/{hash}/theme.css` under the repo (`process.cwd()`), not `/tmp`.
- `ThemeHandlers.ts` only supports `file://` URLs and will 503 for any other scheme.
- Factory always uses `LocalThemeArtifactStorage`, even in prod.

**Needed:**
- Upload artifacts to Cloud Storage
- Return `https://` URLs instead of `file://` URLs
- Support both emulator (file://) and production (https://)

---

## Solution Overview

We'll create a Cloud Storage bucket for theme artifacts and migrate from `file://` URLs to `https://` URLs. The solution includes:

1. Script to create/configure the bucket
2. Cloud Storage implementation
3. Updated theme handlers to fetch from HTTPS
4. Integration with existing publish flow

---

## Phase 1: Bucket Setup Script

**Create: `firebase/scripts/setup-theme-storage.ts`**

```typescript
#!/usr/bin/env npx tsx

import * as admin from 'firebase-admin';
import { initializeFirebase, getEnvironment } from './firebase-init';
import { logger } from './logger';

const BUCKET_NAME = 'theme-artifacts';

async function setupThemeStorageBucket(): Promise<void> {
    const env = getEnvironment();
    initializeFirebase(env);

    if (env.isEmulator) {
        logger.info('⚠️  Running in emulator mode - bucket creation skipped');
        logger.info('   Emulator uses in-memory storage automatically');
        return;
    }

    logger.info('🪣 Setting up Cloud Storage bucket for theme artifacts...');

    const storage = admin.storage();
    const bucket = storage.bucket();

    logger.info(`   Project bucket: ${bucket.name}`);

    // Check if bucket exists
    const [exists] = await bucket.exists();

    if (!exists) {
        logger.error('❌ Default bucket does not exist');
        logger.error('   Create it in Firebase Console: Storage > Get Started');
        process.exit(1);
    }

    // Create theme-artifacts directory structure (metadata marker)
    const markerFile = bucket.file('theme-artifacts/.initialized');
    const [markerExists] = await markerFile.exists();

    if (!markerExists) {
        await markerFile.save('Theme artifacts storage initialized', {
            metadata: {
                contentType: 'text/plain',
                cacheControl: 'public, max-age=31536000',
            },
        });
        logger.info('   ✓ Created theme-artifacts directory structure');
    } else {
        logger.info('   ✓ theme-artifacts directory already exists');
    }

    // Set CORS configuration for theme CSS delivery
    // Allow all origins since files are publicly readable
    await bucket.setCorsConfiguration([
        {
            origin: ['*'],
            method: ['GET', 'HEAD'],
            responseHeader: ['Content-Type', 'Cache-Control', 'ETag'],
            maxAgeSeconds: 3600,
        },
    ]);
    logger.info('   ✓ CORS configuration updated (allows all origins)');

    // Set lifecycle rule to clean up old theme artifacts (optional)
    await bucket.setMetadata({
        lifecycle: {
            rule: [
                {
                    action: { type: 'Delete' },
                    condition: {
                        age: 90, // Delete artifacts older than 90 days
                        matchesPrefix: ['theme-artifacts/'],
                    },
                },
            ],
        },
    });
    logger.info('   ✓ Lifecycle rules configured (90-day retention)');

    logger.info('✅ Theme storage bucket ready!');
    logger.info(`   Bucket: ${bucket.name}`);
    logger.info('   Path: theme-artifacts/{tenantId}/{hash}/theme.css');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Usage: setup-theme-storage.ts <emulator|production>');
        process.exit(1);
    }

    await setupThemeStorageBucket();
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Bucket setup failed:', error);
        process.exit(1);
    });
}
```

**Add npm script to `firebase/package.json`:**
```json
"storage:setup": "tsx scripts/setup-theme-storage.ts"
```

---

## Phase 2: Cloud Storage Implementation

**Create: `firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts`**

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

**Update: `firebase/functions/src/services/storage/ThemeArtifactStorage.ts`**

Changes needed:
1. Import `CloudThemeArtifactStorage` and `getStorage`
2. Update `createThemeArtifactStorage()` to use Cloud Storage everywhere (dev and prod)
3. Remove `LocalThemeArtifactStorage` (no longer needed)

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

**Update: `firebase/functions/src/theme/ThemeHandlers.ts`**

Update the `readCssContent` method to support both `http://` (emulator) and `https://` (production) URLs:

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

**Create: `firebase/functions/src/__tests__/integration/theme-storage.test.ts`**

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

### Step 1: Create Cloud Storage Implementation (1-2 hours)
- [ ] Create `firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts`
- [ ] Update `firebase/functions/src/services/storage/ThemeArtifactStorage.ts` factory
- [ ] Update `firebase/functions/src/theme/ThemeHandlers.ts` to fetch from HTTPS URLs

### Step 2: Create Bucket Setup Script (1 hour)
- [ ] Create `firebase/scripts/setup-theme-storage.ts`
- [ ] Add npm script `storage:setup` to `firebase/package.json`
- [ ] Test in production: `npm run storage:setup production`

### Step 3: Test & Validate (1-2 hours)
- [ ] Run bucket setup script
- [ ] Republish themes: `npm run theme:publish-local`
- [ ] Verify URLs in Firestore are `https://` not `file://`
- [ ] Test theme delivery endpoint
- [ ] Check browser Network tab for successful CSS loads

### Step 4: Add Integration Tests (1 hour)
- [ ] Create `firebase/functions/src/__tests__/integration/theme-storage.test.ts`
- [ ] Run tests in both emulator and production

---

## Files Summary

### Files to Create
1. `firebase/scripts/setup-theme-storage.ts` - Bucket initialization script
2. `firebase/functions/src/services/storage/CloudThemeArtifactStorage.ts` - Cloud Storage implementation
3. `firebase/functions/src/__tests__/integration/theme-storage.test.ts` - Integration tests

### Files to Update
1. `firebase/functions/src/services/storage/ThemeArtifactStorage.ts` - Factory to use Cloud Storage in prod
2. `firebase/functions/src/theme/ThemeHandlers.ts` - Support HTTPS URLs
3. `firebase/package.json` - Add `storage:setup` script

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

- [ ] Cloud Storage bucket created and configured
- [ ] Theme artifacts upload to Cloud Storage in production
- [ ] Artifacts return `https://` URLs, not `file://` URLs
- [ ] Theme CSS serves correctly from Cloud Storage
- [ ] Emulator still works with `file://` URLs (no regression)
- [ ] Integration tests pass in both emulator and production
- [ ] Browser successfully loads theme CSS with proper caching headers
- [ ] CORS configured correctly for cross-origin CSS delivery

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

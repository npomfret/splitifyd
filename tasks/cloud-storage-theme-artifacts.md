# Cloud Storage for Theme Artifacts

## Problem Statement

Theme CSS files are currently stored using `file://` URLs, which works in the emulator but **won't work in production** because:

1. Cloud Functions instances don't share a filesystem
2. The `/tmp` directory is ephemeral and cleared between cold starts
3. `file://` URLs aren't web-accessible

**Current Implementation:**
- `ThemeArtifactStorage.ts` (line 43): Returns `file://${cssPath}`
- `ThemeHandlers.ts` (line 54): Reads from `file://` URLs using `fileURLToPath()`
- Artifacts stored in `/tmp/theme-artifacts/{tenantId}/{hash}/theme.css`

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
    await bucket.setCorsConfiguration([
        {
            origin: ['*'], // Allow all origins for theme CSS
            method: ['GET', 'HEAD'],
            responseHeader: ['Content-Type', 'Cache-Control', 'ETag'],
            maxAgeSeconds: 3600,
        },
    ]);
    logger.info('   ✓ CORS configuration updated');

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
    private bucket: admin.storage.Bucket;

    constructor() {
        this.bucket = admin.storage().bucket();
    }

    async save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation> {
        const { tenantId, hash, cssContent, tokensJson } = payload;

        const cssPath = `theme-artifacts/${tenantId}/${hash}/theme.css`;
        const tokensPath = `theme-artifacts/${tenantId}/${hash}/tokens.json`;

        const cssFile = this.bucket.file(cssPath);
        const tokensFile = this.bucket.file(tokensPath);

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

        // Get public URLs
        const cssUrl = `https://storage.googleapis.com/${this.bucket.name}/${cssPath}`;
        const tokensUrl = `https://storage.googleapis.com/${this.bucket.name}/${tokensPath}`;

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
1. Import `CloudThemeArtifactStorage`
2. Update `createThemeArtifactStorage()` to use Cloud Storage in production
3. Keep `LocalThemeArtifactStorage` for emulator

```typescript
import crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { isEmulator } from '../../firebase';
import { logger } from '../../logger';
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

const LOCAL_ROOT = path.join(process.cwd(), 'tmp', 'theme-artifacts');

export class LocalThemeArtifactStorage implements ThemeArtifactStorage {
    async save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation> {
        const { tenantId, hash, cssContent, tokensJson } = payload;
        const tenantDir = path.join(LOCAL_ROOT, tenantId, hash);
        await fs.mkdir(tenantDir, { recursive: true });

        const cssPath = path.join(tenantDir, 'theme.css');
        const tokensPath = path.join(tenantDir, 'tokens.json');

        await Promise.all([
            fs.writeFile(cssPath, cssContent, 'utf8'),
            fs.writeFile(tokensPath, tokensJson, 'utf8'),
        ]);

        logger.info('Saved local theme artifacts', { tenantId, hash, tenantDir });

        // Return file:// URLs for emulator compatibility
        return {
            cssUrl: `file://${cssPath}`,
            tokensUrl: `file://${tokensPath}`,
        };
    }
}

export function createThemeArtifactStorage(): ThemeArtifactStorage {
    if (isEmulator()) {
        return new LocalThemeArtifactStorage();
    }

    // Production uses Cloud Storage
    return new CloudThemeArtifactStorage();
}

export function computeSha256(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}
```

---

## Phase 4: Update Theme Handlers to Support HTTPS URLs

**Update: `firebase/functions/src/theme/ThemeHandlers.ts`**

Update the `readCssContent` method to support both `file://` (emulator) and `https://` (production) URLs:

```typescript
import { BrandingArtifactMetadata } from '@splitifyd/shared';
import type { RequestHandler } from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import { ApiError } from '../utils/errors';

export class ThemeHandlers {
    constructor(private readonly firestoreReader: IFirestoreReader) {}

    serveThemeCss: RequestHandler = async (req, res) => {
        const tenantContext = req.tenant;

        if (!tenantContext) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Unable to resolve tenant for this request');
        }

        const record = await this.firestoreReader.getTenantById(tenantContext.tenantId);
        const artifact = record?.brandingTokens?.artifact;

        if (!artifact) {
            logger.warn('theme-artifact-missing', { tenantId: tenantContext.tenantId });
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.status(HTTP_STATUS.OK).send('/* No theme published for this tenant */\n');
            return;
        }

        const cssContent = await this.readCssContent(artifact);

        res.setHeader('Content-Type', 'text/css; charset=utf-8');

        // Content-addressed caching: when ?v=hash is present, cache aggressively since content is immutable
        // Otherwise, use no-cache to ensure browsers check for updates
        const requestedVersion = req.query.v;
        if (requestedVersion) {
            // Version parameter present - enable aggressive caching
            // The presence of ?v= indicates the client is requesting a specific immutable version
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            // No version - use no-cache so browsers always check for updates
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.setHeader('ETag', `"${artifact.hash}"`);
        res.setHeader('Last-Modified', new Date(artifact.generatedAtEpochMs).toUTCString());

        res.status(HTTP_STATUS.OK).send(cssContent);
    };

    private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
        // Support file:// URLs (emulator)
        if (artifact.cssUrl.startsWith('file://')) {
            const path = fileURLToPath(artifact.cssUrl);
            return fs.readFile(path, 'utf8');
        }

        // Support https:// URLs (production Cloud Storage)
        if (artifact.cssUrl.startsWith('https://')) {
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

        logger.error('Unsupported CSS artifact URL scheme', { cssUrl: artifact.cssUrl });
        throw new ApiError(
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            'THEME_STORAGE_UNSUPPORTED',
            'Theme storage backend not supported',
        );
    }
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
        const response = await api.get('/api/theme.css', {
            headers: { Host: 'localhost' },
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/css');
        expect(response.data).toContain(':root');
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

# Run integration tests
npm run test:integration -- theme-storage.test.ts
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

- Emulator continues to use `file://` URLs (no Cloud Storage needed locally)
- Production automatically switches to Cloud Storage
- Old artifacts auto-deleted after 90 days (configurable)
- Public URLs enable CDN caching and global distribution
- Bucket setup is idempotent (safe to run multiple times)

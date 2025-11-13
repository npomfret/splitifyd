import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { logger } from '../../logger';
import { isEmulator } from '../../firebase';

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

        // Return file:// URLs for compatibility with URL schema validation
        return {
            cssUrl: `file://${cssPath}`,
            tokensUrl: `file://${tokensPath}`,
        };
    }
}

export function createThemeArtifactStorage(): ThemeArtifactStorage {
    // TODO: Implement Cloud Storage for production when bucket wiring is ready.
    // Currently uses local file storage for both emulator and production.
    // Production URLs will be file paths (not public URLs) until Cloud Storage is implemented.
    // This is a known limitation - artifacts are generated and stored but not yet web-accessible.
    if (isEmulator()) {
        return new LocalThemeArtifactStorage();
    }

    // Production currently uses same local storage - replace with CloudThemeArtifactStorage when ready
    return new LocalThemeArtifactStorage();
}

export function computeSha256(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

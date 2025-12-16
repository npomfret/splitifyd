import crypto from 'crypto';

export interface ThemeArtifactPayload {
    tenantId: string;
    hash: string;
    cssContent: string;
    tokensJson: string;
}

export interface ThemeArtifactLocation {
    cssUrl: string;
    tokensUrl: string;
}

export interface ThemeArtifactStorage {
    save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation>;
}

export function computeSha256(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

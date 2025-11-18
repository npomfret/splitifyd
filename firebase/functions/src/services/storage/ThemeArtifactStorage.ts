import crypto from 'crypto';
import { getStorage } from '../../firebase';
import { CloudThemeArtifactStorage } from './CloudThemeArtifactStorage';

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

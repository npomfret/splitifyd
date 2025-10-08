import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let cachedTranslation: any = null;

/**
 * Loads translation file by finding project root and caching the result
 */
export function loadTranslation(): any {
    if (cachedTranslation) {
        return cachedTranslation;
    }

    // Find translation file by checking multiple possible locations
    let currentDir = process.cwd();
    let translationPath = '';

    // First check if we're already in webapp-v2
    if (existsSync(join(currentDir, 'src/locales/en/translation.json'))) {
        translationPath = join(currentDir, 'src/locales/en/translation.json');
    } else {
        // Look for webapp-v2 directory going up
        while (currentDir !== '/' && !translationPath) {
            if (existsSync(join(currentDir, 'webapp-v2/src/locales/en/translation.json'))) {
                translationPath = join(currentDir, 'webapp-v2/src/locales/en/translation.json');
                break;
            }
            currentDir = join(currentDir, '..');
        }
    }

    cachedTranslation = JSON.parse(readFileSync(translationPath, 'utf-8'));
    return cachedTranslation;
}

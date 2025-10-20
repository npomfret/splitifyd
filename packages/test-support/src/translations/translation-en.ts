import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type translationSchema from '../../../../webapp-v2/src/locales/en/translation.json';

// We have to root around for the webapp translations because this package is used from
// both Playwright (runs under e2e-tests/) and Firebase functions tests (runs under firebase/),
// each with a different cwd and module system. Walking a few candidate roots keeps the page
// objects happy without relying on `import.meta` or JSON import attributes.
const CANDIDATE_ROOTS = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(process.cwd(), '../../..'),
    path.resolve(process.cwd(), '../../../..'),
];

function resolveTranslationPath(): string {
    for (const root of CANDIDATE_ROOTS) {
        const candidate = path.resolve(root, 'webapp-v2/src/locales/en/translation.json');
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error('display-name translation: unable to locate webapp-v2/src/locales/en/translation.json');
}

const translationPath = resolveTranslationPath();

export const translationEn = JSON.parse(readFileSync(translationPath, 'utf-8')) as typeof translationSchema;

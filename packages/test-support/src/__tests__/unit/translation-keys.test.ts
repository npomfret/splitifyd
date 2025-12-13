import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { translationEn } from '../../translations/translation-en';

// =============================================================================
// Types
// =============================================================================

interface TranslationFile {
    code: string;
    name: string;
    path: string;
    data: Record<string, unknown>;
}

interface FlattenedEntry {
    key: string;
    value: string;
}

interface FlattenedEntryWithType {
    key: string;
    value: unknown;
    type: 'string' | 'array' | 'object' | 'null' | 'other';
}

interface TranslationAccess {
    key: string;
    file: string;
    source: 'code' | 'test';
}

// =============================================================================
// Constants
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Unicode ranges for detecting script types
const SCRIPT_RANGES: Record<string, RegExp> = {
    ar: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/,  // Arabic
    uk: /[\u0400-\u04FF]/,                             // Cyrillic (Ukrainian)
    he: /[\u0590-\u05FF]/,                             // Hebrew
    zh: /[\u4E00-\u9FFF]/,                             // Chinese
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,               // Japanese (Hiragana + Katakana)
    ko: /[\uAC00-\uD7AF]/,                             // Korean
    th: /[\u0E00-\u0E7F]/,                             // Thai
    hi: /[\u0900-\u097F]/,                             // Hindi (Devanagari)
};

// Languages that use Latin script (no untranslated detection possible)
const LATIN_SCRIPT_LANGUAGES = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ro', 'vi']);

// Strings that are legitimately in English/Latin across all translations
const ALLOWED_ENGLISH_PATTERNS = [
    /^\{\{.*\}\}$/, // Format strings
    /^{{.*}}$/, // Template placeholders
    /^(Airbnb|Firestore|Google|Firebase|PayPal|Venmo|Zelle|Array Buffers?)$/i,
    /^#[A-Fa-f0-9]{6}$/, // Hex colors
    /^#RRGGBB$/, // Color format
    /^.{1,3}$/, // Very short strings
    /^https?:\/\//, // URLs
    /^mailto:/, // Email links
    /^\/[a-zA-Z0-9._/-]+$/, // File paths
    /^[\s\-–—:,./()|\u2192]*$/, // Separators only
    /^[\s\-–—|]*\{\{[^}]+\}\}[\s\-–—|]*$/,
    /^[A-Z]{3}$/, // Currency codes
    /^\d+([.,]\d+)?$/, // Numbers
    /^[\s]*[→←↑↓][\s]*$/, // Arrows
];

// JavaScript/TypeScript string methods that might appear after translation key access
const STRING_METHODS = new Set([
    'replace',
    'replaceAll',
    'split',
    'slice',
    'substring',
    'substr',
    'trim',
    'trimStart',
    'trimEnd',
    'toLowerCase',
    'toUpperCase',
    'charAt',
    'charCodeAt',
    'concat',
    'includes',
    'indexOf',
    'lastIndexOf',
    'match',
    'padStart',
    'padEnd',
    'repeat',
    'search',
    'startsWith',
    'endsWith',
    'normalize',
    'localeCompare',
    'toString',
    'valueOf',
    'length',
]);

// i18next pluralization suffixes
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

// Keys that are dynamically constructed at runtime and can't be statically detected
const DYNAMIC_KEY_PATTERNS = [
    /_plural$/,
    /_one$/,
    /_other$/,
    /^apiErrors\./,
    /^authErrors\./,
    /^roles\./,
    /^activityFeed\.events\./,
    /^securitySettingsModal\.permissionOptions\./,
    /^admin\.tenants\.types\./,
    /^admin\.users\.roles\./,
    /^validation\./,
];

// Regex to extract placeholders like {{name}}, {{count}}, etc.
const PLACEHOLDER_PATTERN = /\{\{([^}]+)\}\}/g;

// Regex to extract HTML tags like <strong>, <em>, <br/>, etc.
const HTML_TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;

// =============================================================================
// Utility Functions
// =============================================================================

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function flattenWithValues(obj: Record<string, unknown>, prefix = ''): FlattenedEntry[] {
    const entries: FlattenedEntry[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            entries.push(...flattenWithValues(value as Record<string, unknown>, fullKey));
        } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'string') {
                    entries.push({ key: `${fullKey}[${index}]`, value: item });
                }
            });
        } else if (typeof value === 'string') {
            entries.push({ key: fullKey, value });
        }
    }
    return entries;
}

function flattenWithTypes(obj: Record<string, unknown>, prefix = ''): FlattenedEntryWithType[] {
    const entries: FlattenedEntryWithType[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value === null) {
            entries.push({ key: fullKey, value, type: 'null' });
        } else if (Array.isArray(value)) {
            entries.push({ key: fullKey, value, type: 'array' });
        } else if (typeof value === 'object') {
            entries.push(...flattenWithTypes(value as Record<string, unknown>, fullKey));
        } else if (typeof value === 'string') {
            entries.push({ key: fullKey, value, type: 'string' });
        } else {
            entries.push({ key: fullKey, value, type: 'other' });
        }
    }
    return entries;
}

function cleanKeyPath(rawPath: string): string {
    const parts = rawPath.split('.');
    while (parts.length > 0 && STRING_METHODS.has(parts[parts.length - 1])) {
        parts.pop();
    }
    return parts.join('.');
}

function loadAllTranslationFiles(projectRoot: string): TranslationFile[] {
    const localesDir = path.join(projectRoot, 'webapp-v2/src/locales');
    const files: TranslationFile[] = [];

    const languageDirs = fs.readdirSync(localesDir).filter((dir) => {
        const dirPath = path.join(localesDir, dir);
        return fs.statSync(dirPath).isDirectory();
    });

    for (const langCode of languageDirs) {
        const translationPath = path.join(localesDir, langCode, 'translation.json');
        if (fs.existsSync(translationPath)) {
            const data = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
            files.push({ code: langCode, name: langCode.toUpperCase(), path: translationPath, data });
        }
    }

    return files;
}

function isAllowedEnglishString(value: string): boolean {
    return ALLOWED_ENGLISH_PATTERNS.some((pattern) => pattern.test(value));
}

function containsTargetScript(value: string, langCode: string): boolean {
    const scriptRange = SCRIPT_RANGES[langCode];
    if (scriptRange) {
        return scriptRange.test(value);
    }
    // For languages without a defined script range, assume OK
    return true;
}

function isLikelyUntranslatedEnglish(value: string, langCode: string): boolean {
    // Skip if it matches allowed patterns
    if (isAllowedEnglishString(value)) return false;

    // Skip Latin-script languages (can't detect untranslated)
    if (LATIN_SCRIPT_LANGUAGES.has(langCode)) return false;

    // For languages with distinct scripts, check if the value contains any of that script
    const scriptRange = SCRIPT_RANGES[langCode];
    if (scriptRange) {
        // If the string is long enough and contains NO target script characters, likely untranslated
        return value.length > 3 && !scriptRange.test(value);
    }

    return false;
}

function extractPlaceholders(value: string): Set<string> {
    const placeholders = new Set<string>();
    let match;
    while ((match = PLACEHOLDER_PATTERN.exec(value)) !== null) {
        placeholders.add(match[1]);
    }
    // Reset regex lastIndex for reuse
    PLACEHOLDER_PATTERN.lastIndex = 0;
    return placeholders;
}

function extractHtmlTags(value: string): Set<string> {
    const tags = new Set<string>();
    let match;
    while ((match = HTML_TAG_PATTERN.exec(value)) !== null) {
        tags.add(match[1].toLowerCase());
    }
    // Reset regex lastIndex for reuse
    HTML_TAG_PATTERN.lastIndex = 0;
    return tags;
}

function getGitFiles(dir: string, cwd: string): string[] {
    try {
        return execSync(`git ls-files -- "${dir}"`, { cwd, encoding: 'utf8' })
            .trim()
            .split('\n')
            .filter(Boolean)
            .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
    } catch {
        return [];
    }
}

// =============================================================================
// Translation Key Extraction
// =============================================================================

/**
 * Extracts translation keys from production code using t() function calls.
 * Example: t('dashboard.title') -> 'dashboard.title'
 */
function extractKeysFromProductionCode(projectRoot: string): TranslationAccess[] {
    const webappSrcPath = path.join(projectRoot, 'webapp-v2/src');
    const accesses: TranslationAccess[] = [];
    const tFunctionPattern = /\bt\(\s*['"`]([^'"`$]+)/g;

    const gitFiles = getGitFiles('.', webappSrcPath);

    for (const file of gitFiles) {
        const filePath = path.join(webappSrcPath, file);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let match;
            while ((match = tFunctionPattern.exec(content)) !== null) {
                const key = match[1].trim();
                if (key) {
                    accesses.push({ key, file, source: 'code' });
                }
            }
        } catch {
            // Skip unreadable files
        }
    }

    return accesses;
}

/**
 * Parses a file to find all translation object aliases and their prefixes.
 */
function parseTranslationAliases(content: string): Map<string, string> {
    const aliases = new Map<string, string>();

    // Pattern 1: const <name> = translationEn[.path.to.object]
    const assignmentPattern = /const\s+(\w+)\s*=\s*translationEn(?:\.([a-zA-Z0-9_.]+))?(?:\s*;|\s*$)/gm;
    let match;
    while ((match = assignmentPattern.exec(content)) !== null) {
        const aliasName = match[1];
        const prefix = match[2] || '';
        aliases.set(aliasName, prefix);
    }

    // Pattern 2: const { <name> } = translationEn (destructuring)
    const destructurePattern = /const\s*\{\s*([^}]+)\s*\}\s*=\s*translationEn/gm;
    while ((match = destructurePattern.exec(content)) !== null) {
        const destructuredNames = match[1].split(',').map((s) => s.trim());
        for (const name of destructuredNames) {
            const renameMatch = name.match(/^(\w+)\s*:\s*(\w+)$/);
            if (renameMatch) {
                aliases.set(renameMatch[2], renameMatch[1]);
            } else if (/^\w+$/.test(name)) {
                aliases.set(name, name);
            }
        }
    }

    return aliases;
}

/**
 * Extracts translation keys from test files that access translations directly.
 */
function extractKeysFromTestFiles(projectRoot: string): TranslationAccess[] {
    const accesses: TranslationAccess[] = [];

    const testDirs = [
        'webapp-v2/src/__tests__',
        'e2e-tests/src',
        'packages/test-support/src',
    ];

    for (const testDir of testDirs) {
        const fullPath = path.join(projectRoot, testDir);
        if (!fs.existsSync(fullPath)) continue;

        const gitFiles = getGitFiles(testDir, projectRoot)
            .filter((file) => !file.includes('translation-keys.test.ts'));

        for (const file of gitFiles) {
            const filePath = path.join(projectRoot, file);
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const aliases = parseTranslationAliases(content);

                // Always check for direct translationEn access
                const directPattern = /translationEn\.([a-zA-Z0-9_.]+)/g;
                let match;
                while ((match = directPattern.exec(content)) !== null) {
                    const keyPath = cleanKeyPath(match[1]);
                    if (keyPath) {
                        accesses.push({ key: keyPath, file, source: 'test' });
                    }
                }

                // Check for each alias used in the file
                for (const [aliasName, prefix] of aliases) {
                    if (aliasName === 'translationEn') continue;

                    const aliasPattern = new RegExp(`\\b${aliasName}\\.([a-zA-Z0-9_.]+)`, 'g');

                    while ((match = aliasPattern.exec(content)) !== null) {
                        const keyPath = cleanKeyPath(match[1]);
                        if (keyPath) {
                            const fullKey = prefix ? `${prefix}.${keyPath}` : keyPath;
                            accesses.push({ key: fullKey, file, source: 'test' });
                        }
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }
    }

    return accesses;
}

// =============================================================================
// Test Suite: Translation Keys Validation
// =============================================================================

describe('Translation Keys Validation', () => {
    const projectRoot = path.join(__dirname, '../../../../..');
    const allTranslationKeys = new Set(flattenKeys(translationEn as Record<string, unknown>));

    function hasPluralizedKey(baseKey: string): boolean {
        return PLURAL_SUFFIXES.some((suffix) => allTranslationKeys.has(baseKey + suffix));
    }

    function isValidKeyOrPrefix(key: string): boolean {
        if (allTranslationKeys.has(key)) return true;
        if ([...allTranslationKeys].some((tk) => tk.startsWith(key + '.'))) return true;
        if (hasPluralizedKey(key)) return true;
        return false;
    }

    it('should not have missing translation keys (used in code but not in translation file)', () => {
        const codeAccesses = extractKeysFromProductionCode(projectRoot);
        const testAccesses = extractKeysFromTestFiles(projectRoot);

        const missingKeys: string[] = [];

        for (const access of codeAccesses) {
            const key = access.key;
            if (key.endsWith('.')) continue;

            if (!isValidKeyOrPrefix(key)) {
                missingKeys.push(key);
            }
        }

        for (const access of testAccesses) {
            const key = access.key;
            if (key.includes('.') && !isValidKeyOrPrefix(key)) {
                missingKeys.push(`[test] ${key}`);
            }
        }

        if (missingKeys.length > 0) {
            throw new Error(
                `Found ${missingKeys.length} missing translation keys (used in code but not defined):\n\n`
                    + [...new Set(missingKeys)].sort().map((k) => `  - ${k}`).join('\n'),
            );
        }
    });

    it('should not have redundant translation keys (defined but never used)', () => {
        const codeAccesses = extractKeysFromProductionCode(projectRoot);
        const testAccesses = extractKeysFromTestFiles(projectRoot);

        const usedKeys = new Set<string>();
        const dynamicPrefixes = new Set<string>();

        for (const access of codeAccesses) {
            const key = access.key;
            if (key.endsWith('.')) {
                dynamicPrefixes.add(key.slice(0, -1));
            } else {
                usedKeys.add(key);
            }
        }

        for (const access of testAccesses) {
            usedKeys.add(access.key);
            const parts = access.key.split('.');
            for (let i = 1; i <= parts.length; i++) {
                usedKeys.add(parts.slice(0, i).join('.'));
            }
        }

        const redundantKeys: string[] = [];

        for (const key of allTranslationKeys) {
            if (DYNAMIC_KEY_PATTERNS.some((pattern) => pattern.test(key))) continue;
            if ([...dynamicPrefixes].some((prefix) => key.startsWith(prefix + '.'))) continue;

            let isUsed = usedKeys.has(key);
            if (!isUsed) {
                const parts = key.split('.');
                for (let i = 1; i < parts.length && !isUsed; i++) {
                    if (usedKeys.has(parts.slice(0, i).join('.'))) {
                        isUsed = true;
                    }
                }
            }

            if (!isUsed) {
                redundantKeys.push(key);
            }
        }

        if (redundantKeys.length > 0) {
            const byNamespace = new Map<string, number>();
            for (const key of redundantKeys) {
                const namespace = key.split('.')[0];
                byNamespace.set(namespace, (byNamespace.get(namespace) || 0) + 1);
            }
            const namespaceSummary = [...byNamespace.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([ns, count]) => `  ${ns}: ${count}`)
                .join('\n');

            throw new Error(
                `Found ${redundantKeys.length} redundant translation keys (defined but never used).\n\n`
                    + `Summary by namespace:\n${namespaceSummary}\n\n`
                    + `All redundant keys:\n`
                    + redundantKeys.sort().map((k) => `  - ${k}`).join('\n')
                    + '\n\n'
                    + 'To fix:\n'
                    + '  1. Remove unused keys from webapp-v2/src/locales/*/translation.json\n'
                    + '  2. If keys ARE used dynamically, add the pattern to DYNAMIC_KEY_PATTERNS.',
            );
        }
    });

    it('should have all translation keys present (sanity check)', () => {
        expect(allTranslationKeys.size).toBeGreaterThan(100);
    });
});

// =============================================================================
// Test Suite: Multi-Language Translation Validation
// =============================================================================

describe('Multi-Language Translation Validation', () => {
    const projectRoot = path.join(__dirname, '../../../../..');
    const translationFiles = loadAllTranslationFiles(projectRoot);
    const englishFile = translationFiles.find((f) => f.code === 'en');

    if (!englishFile) {
        throw new Error('English translation file not found');
    }

    const englishKeys = new Set(flattenKeys(englishFile.data as Record<string, unknown>));
    const englishEntries = flattenWithValues(englishFile.data as Record<string, unknown>);
    const englishEntriesMap = new Map(englishEntries.map((e) => [e.key, e.value]));
    const nonEnglishFiles = translationFiles.filter((f) => f.code !== 'en');

    it('should have at least one non-English translation file', () => {
        expect(nonEnglishFiles.length).toBeGreaterThan(0);
    });

    it('should have all translation files with the same keys as English', () => {
        const errors: string[] = [];

        for (const file of nonEnglishFiles) {
            const fileKeys = new Set(flattenKeys(file.data as Record<string, unknown>));

            const missingKeys = [...englishKeys].filter((k) => !fileKeys.has(k));
            const extraKeys = [...fileKeys].filter((k) => !englishKeys.has(k));

            if (missingKeys.length > 0) {
                errors.push(
                    `${file.name} is missing ${missingKeys.length} keys:\n`
                        + missingKeys.slice(0, 20).map((k) => `    - ${k}`).join('\n')
                        + (missingKeys.length > 20 ? `\n    ... and ${missingKeys.length - 20} more` : ''),
                );
            }

            if (extraKeys.length > 0) {
                errors.push(
                    `${file.name} has ${extraKeys.length} extra keys not in English:\n`
                        + extraKeys.slice(0, 20).map((k) => `    - ${k}`).join('\n')
                        + (extraKeys.length > 20 ? `\n    ... and ${extraKeys.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`Translation key mismatches found:\n\n${errors.join('\n\n')}`);
        }
    });

    it('should not have empty translation values', () => {
        const errors: string[] = [];

        for (const file of translationFiles) {
            const entries = flattenWithValues(file.data as Record<string, unknown>);
            const emptyEntries = entries.filter((e) => e.value === '');

            if (emptyEntries.length > 0) {
                errors.push(
                    `${file.name} has ${emptyEntries.length} empty values:\n`
                        + emptyEntries.slice(0, 20).map((e) => `    - ${e.key}`).join('\n')
                        + (emptyEntries.length > 20 ? `\n    ... and ${emptyEntries.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`Empty translation values found:\n\n${errors.join('\n\n')}`);
        }
    });

    it('should have consistent placeholders across all languages', () => {
        const errors: string[] = [];

        for (const file of nonEnglishFiles) {
            const entries = flattenWithValues(file.data as Record<string, unknown>);
            const inconsistencies: string[] = [];

            for (const entry of entries) {
                const englishValue = englishEntriesMap.get(entry.key);
                if (!englishValue) continue;

                const englishPlaceholders = extractPlaceholders(englishValue);
                const translatedPlaceholders = extractPlaceholders(entry.value);

                // Check for missing placeholders
                const missing = [...englishPlaceholders].filter((p) => !translatedPlaceholders.has(p));
                const extra = [...translatedPlaceholders].filter((p) => !englishPlaceholders.has(p));

                if (missing.length > 0 || extra.length > 0) {
                    let msg = `    - ${entry.key}:`;
                    if (missing.length > 0) msg += ` missing {{${missing.join('}}, {{')}}}`;
                    if (extra.length > 0) msg += ` extra {{${extra.join('}}, {{')}}}`;
                    inconsistencies.push(msg);
                }
            }

            if (inconsistencies.length > 0) {
                errors.push(
                    `${file.name} has ${inconsistencies.length} placeholder inconsistencies:\n`
                        + inconsistencies.slice(0, 20).join('\n')
                        + (inconsistencies.length > 20 ? `\n    ... and ${inconsistencies.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`Placeholder inconsistencies found:\n\n${errors.join('\n\n')}`);
        }
    });

    it('should have consistent HTML tags across all languages', () => {
        const errors: string[] = [];

        for (const file of nonEnglishFiles) {
            const entries = flattenWithValues(file.data as Record<string, unknown>);
            const inconsistencies: string[] = [];

            for (const entry of entries) {
                const englishValue = englishEntriesMap.get(entry.key);
                if (!englishValue) continue;

                const englishTags = extractHtmlTags(englishValue);
                const translatedTags = extractHtmlTags(entry.value);

                // Only check if English has HTML tags
                if (englishTags.size === 0) continue;

                const missing = [...englishTags].filter((t) => !translatedTags.has(t));
                const extra = [...translatedTags].filter((t) => !englishTags.has(t));

                if (missing.length > 0 || extra.length > 0) {
                    let msg = `    - ${entry.key}:`;
                    if (missing.length > 0) msg += ` missing <${missing.join('>, <')}>`;
                    if (extra.length > 0) msg += ` extra <${extra.join('>, <')}>`;
                    inconsistencies.push(msg);
                }
            }

            if (inconsistencies.length > 0) {
                errors.push(
                    `${file.name} has ${inconsistencies.length} HTML tag inconsistencies:\n`
                        + inconsistencies.slice(0, 20).join('\n')
                        + (inconsistencies.length > 20 ? `\n    ... and ${inconsistencies.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`HTML tag inconsistencies found:\n\n${errors.join('\n\n')}`);
        }
    });

    it('should have consistent value types across all languages', () => {
        const errors: string[] = [];
        const englishTyped = flattenWithTypes(englishFile.data as Record<string, unknown>);
        const englishTypesMap = new Map(englishTyped.map((e) => [e.key, e.type]));

        for (const file of nonEnglishFiles) {
            const fileTyped = flattenWithTypes(file.data as Record<string, unknown>);
            const inconsistencies: string[] = [];

            for (const entry of fileTyped) {
                const englishType = englishTypesMap.get(entry.key);
                if (!englishType) continue;

                if (entry.type !== englishType) {
                    inconsistencies.push(
                        `    - ${entry.key}: expected ${englishType}, got ${entry.type}`,
                    );
                }
            }

            if (inconsistencies.length > 0) {
                errors.push(
                    `${file.name} has ${inconsistencies.length} type mismatches:\n`
                        + inconsistencies.slice(0, 20).join('\n')
                        + (inconsistencies.length > 20 ? `\n    ... and ${inconsistencies.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`Value type inconsistencies found:\n\n${errors.join('\n\n')}`);
        }
    });

    it('should not have untranslated English strings in non-English files', () => {
        const errors: string[] = [];

        for (const file of nonEnglishFiles) {
            const entries = flattenWithValues(file.data as Record<string, unknown>);
            const untranslated = entries.filter((e) => isLikelyUntranslatedEnglish(e.value, file.code));

            if (untranslated.length > 0) {
                errors.push(
                    `${file.name} has ${untranslated.length} potentially untranslated strings:\n`
                        + untranslated.slice(0, 20).map((e) => `    - ${e.key}: "${e.value}"`).join('\n')
                        + (untranslated.length > 20 ? `\n    ... and ${untranslated.length - 20} more` : ''),
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(
                `Untranslated strings found:\n\n${errors.join('\n\n')}\n\n`
                    + 'If intentionally in English, add to ALLOWED_ENGLISH_PATTERNS.',
            );
        }
    });
});

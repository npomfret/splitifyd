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
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Strings that are legitimately in English/Latin across all translations
const ALLOWED_ENGLISH_PATTERNS = [
    /^\{\{.*\}\}$/,           // Format strings
    /^{{.*}}$/,               // Template placeholders
    /^(Airbnb|Firestore|Google|Firebase|PayPal|Venmo|Zelle|Array Buffers?)$/i,
    /^#[A-Fa-f0-9]{6}$/,      // Hex colors
    /^#RRGGBB$/,              // Color format
    /^.{1,3}$/,               // Very short strings
    /^https?:\/\//,           // URLs
    /^mailto:/,               // Email links
    /^\/[a-zA-Z0-9._/-]+$/,   // File paths
    /^[\s\-–—:,./()|\u2192]*$/,  // Separators only
    /^[\s\-–—|]*\{\{[^}]+\}\}[\s\-–—|]*$/,
    /^[A-Z]{3}$/,             // Currency codes
    /^\d+([.,]\d+)?$/,        // Numbers
    /^[\s]*[→←↑↓][\s]*$/,    // Arrows
];

// JavaScript/TypeScript string methods that might appear after translation key access
const STRING_METHODS = new Set([
    'replace', 'replaceAll', 'split', 'slice', 'substring', 'substr',
    'trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase',
    'charAt', 'charCodeAt', 'concat', 'includes', 'indexOf', 'lastIndexOf',
    'match', 'padStart', 'padEnd', 'repeat', 'search', 'startsWith', 'endsWith',
    'normalize', 'localeCompare', 'toString', 'valueOf', 'length',
]);

// i18next pluralization suffixes
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

// Keys that are dynamically constructed at runtime and can't be statically detected
const DYNAMIC_KEY_PATTERNS = [
    /_plural$/, /_one$/, /_other$/,
    /^apiErrors\./, /^authErrors\./,
    /^roles\./, /^activityFeed\.events\./,
    /^securitySettingsModal\.permissionOptions\./,
    /^admin\.tenants\.types\./, /^admin\.users\.roles\./,
    /^validation\./,
];

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
    if (langCode === 'ar') {
        return ARABIC_RANGE.test(value);
    }
    return true;
}

function isLikelyUntranslatedEnglish(value: string, langCode: string): boolean {
    if (isAllowedEnglishString(value)) return false;
    if (langCode === 'ar') {
        return !containsTargetScript(value, langCode) && value.length > 2;
    }
    return false;
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
 *
 * Supports patterns like:
 * - const translation = translationEn                    -> prefix: ''
 * - const translation = translationEn.admin              -> prefix: 'admin'
 * - const translation = translationEn.admin.users        -> prefix: 'admin.users'
 * - const { admin } = translationEn                      -> alias 'admin' with prefix 'admin'
 * - const t = translationEn.securitySettingsModal        -> alias 't' with prefix 'securitySettingsModal'
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
            // Handle renaming: { foo: bar } means bar is an alias for translationEn.foo
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
 *
 * Handles:
 * - translationEn.path.to.key (direct access)
 * - translation.path.to.key (aliased access with prefix resolution)
 * - t.path.to.key (short alias)
 * - admin.users.actions.edit (destructured access)
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
                    // Skip 'translationEn' itself since we already handled it
                    if (aliasName === 'translationEn') continue;

                    // Build pattern for this alias: aliasName.key.path
                    // Use word boundary to avoid matching substrings
                    const aliasPattern = new RegExp(`\\b${aliasName}\\.([a-zA-Z0-9_.]+)`, 'g');

                    while ((match = aliasPattern.exec(content)) !== null) {
                        const keyPath = cleanKeyPath(match[1]);
                        if (keyPath) {
                            // Prepend the prefix from the alias declaration
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
        // Exact match
        if (allTranslationKeys.has(key)) return true;
        // Is a valid prefix (parent object access)
        if ([...allTranslationKeys].some((tk) => tk.startsWith(key + '.'))) return true;
        // Has pluralized versions
        if (hasPluralizedKey(key)) return true;
        return false;
    }

    it('should not have missing translation keys (used in code but not in translation file)', () => {
        const codeAccesses = extractKeysFromProductionCode(projectRoot);
        const testAccesses = extractKeysFromTestFiles(projectRoot);

        const missingKeys: string[] = [];

        // Check production code keys
        for (const access of codeAccesses) {
            const key = access.key;
            // Skip dynamic prefixes (end with .)
            if (key.endsWith('.')) continue;

            if (!isValidKeyOrPrefix(key)) {
                missingKeys.push(key);
            }
        }

        // Check test file keys (only full paths with dots)
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

        // Collect all used keys and prefixes
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
            // Also mark all parent paths as used (object access)
            const parts = access.key.split('.');
            for (let i = 1; i <= parts.length; i++) {
                usedKeys.add(parts.slice(0, i).join('.'));
            }
        }

        const redundantKeys: string[] = [];

        for (const key of allTranslationKeys) {
            // Skip dynamic keys
            if (DYNAMIC_KEY_PATTERNS.some((pattern) => pattern.test(key))) continue;
            // Skip keys under dynamic prefixes
            if ([...dynamicPrefixes].some((prefix) => key.startsWith(prefix + '.'))) continue;

            // Check if key or any parent is used
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

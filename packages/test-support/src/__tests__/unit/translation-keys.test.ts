import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { translationEn } from '../../translations/translation-en';

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

// Unicode ranges for detecting script types
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Strings that are legitimately in English/Latin across all translations
const ALLOWED_ENGLISH_PATTERNS = [
    // Format strings and placeholders
    /^\{\{.*\}\}$/,
    /^{{.*}}$/,
    // Single words that are universal (brands, technical terms)
    /^(Airbnb|Firestore|Google|Firebase|PayPal|Venmo|Zelle|Array Buffers?)$/i,
    // Technical formats
    /^#[A-Fa-f0-9]{6}$/,
    /^#RRGGBB$/,
    // Very short strings (1-3 chars) - likely symbols or abbreviations
    /^.{1,3}$/,
    // URLs and email patterns
    /^https?:\/\//,
    /^mailto:/,
    // File paths
    /^\/[a-zA-Z0-9._/-]+$/,
    // Template literals with only placeholders and separators
    /^[\s\-–—:,./()|\u2192]*$/,
    /^[\s\-–—|]*\{\{[^}]+\}\}[\s\-–—|]*$/,
    // Currency codes
    /^[A-Z]{3}$/,
    // Number formats (like "0.00")
    /^\d+([.,]\d+)?$/,
    // Arrow symbols
    /^[\s]*[→←↑↓][\s]*$/,
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
            files.push({
                code: langCode,
                name: langCode.toUpperCase(),
                path: translationPath,
                data,
            });
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
    // For other languages (like Ukrainian), they use Latin-compatible scripts
    // so we can't easily detect untranslated strings
    return true;
}

function isLikelyUntranslatedEnglish(value: string, langCode: string): boolean {
    // Skip if it matches allowed patterns
    if (isAllowedEnglishString(value)) {
        return false;
    }

    // For Arabic, check if the string contains any Arabic characters
    // If it's all Latin and longer than 2 chars, it's likely untranslated
    if (langCode === 'ar') {
        return !containsTargetScript(value, langCode) && value.length > 2;
    }

    // For other languages, we can't easily detect (they may use Latin script)
    return false;
}

function extractTranslationKeysFromCode(projectRoot: string): Set<string> {
    const webappSrcPath = path.join(projectRoot, 'webapp-v2/src');
    const usedKeys = new Set<string>();

    // Patterns to match translation key usage:
    // - t('key.path') or t("key.path")
    // - t('key.path', { ... })
    // - t(`key.prefix.${dynamic}`) - captures the static prefix
    const tFunctionPattern = /\bt\(\s*['"`]([^'"`$]+)/g;

    const gitFiles = execSync('git ls-files', {
        cwd: webappSrcPath,
        encoding: 'utf8',
    })
        .trim()
        .split('\n')
        .filter(Boolean)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));

    for (const file of gitFiles) {
        const filePath = path.join(webappSrcPath, file);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let match;
            while ((match = tFunctionPattern.exec(content)) !== null) {
                const key = match[1].trim();
                if (key) {
                    usedKeys.add(key);
                }
            }
        } catch {
            // Skip files that can't be read
        }
    }

    return usedKeys;
}

function extractTranslationKeysFromTestFiles(projectRoot: string): Set<string> {
    const usedKeys = new Set<string>();

    // Check test files that access translations via:
    // - translationEn.key.path (direct access)
    // - translation.key.path (aliased access - most page objects use `const translation = translationEn`)
    const testDirs = [
        path.join(projectRoot, 'webapp-v2/src/__tests__'),
        path.join(projectRoot, 'e2e-tests/src'),
        path.join(projectRoot, 'packages/test-support/src'),
    ];

    // Match both direct and aliased access patterns
    const directAccessPattern = /translationEn\.([a-zA-Z0-9_.]+)/g;
    const aliasedAccessPattern = /\btranslation\.([a-zA-Z0-9_.]+)/g;

    for (const testDir of testDirs) {
        if (!fs.existsSync(testDir)) continue;

        try {
            const gitFiles = execSync(`git ls-files -- "${testDir}"`, {
                cwd: projectRoot,
                encoding: 'utf8',
            })
                .trim()
                .split('\n')
                .filter(Boolean)
                .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
                // Exclude this test file itself to avoid false positives from comments
                .filter((file) => !file.includes('translation-keys.test.ts'));

            for (const file of gitFiles) {
                const filePath = path.join(projectRoot, file);
                if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                    continue;
                }

                try {
                    const content = fs.readFileSync(filePath, 'utf8');

                    // Check if file uses the translation alias pattern
                    const usesAlias = /const translation\s*=\s*translationEn/.test(content);

                    // Extract keys from direct translationEn access
                    let match;
                    while ((match = directAccessPattern.exec(content)) !== null) {
                        const keyPath = cleanKeyPath(match[1]);
                        if (keyPath) {
                            usedKeys.add(keyPath);
                        }
                    }

                    // Extract keys from aliased translation access (only if alias is defined)
                    if (usesAlias) {
                        while ((match = aliasedAccessPattern.exec(content)) !== null) {
                            const keyPath = cleanKeyPath(match[1]);
                            if (keyPath) {
                                usedKeys.add(keyPath);
                            }
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }
        } catch {
            // Skip directories that don't exist in git
        }
    }

    return usedKeys;
}

function cleanKeyPath(rawPath: string): string {
    // Remove trailing string methods (e.g., ".replace" from "key.path.replace")
    const parts = rawPath.split('.');
    while (parts.length > 0 && STRING_METHODS.has(parts[parts.length - 1])) {
        parts.pop();
    }
    return parts.join('.');
}

describe('Translation Keys Validation', () => {
    const projectRoot = path.join(__dirname, '../../../../..');
    const allTranslationKeys = new Set(flattenKeys(translationEn as Record<string, unknown>));

    // i18next pluralization suffixes - a key like 'foo' can be satisfied by 'foo_one', 'foo_other', etc.
    const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

    function hasPluralizedKey(baseKey: string): boolean {
        return PLURAL_SUFFIXES.some((suffix) => allTranslationKeys.has(baseKey + suffix));
    }

    it('should not have missing translation keys (used in code but not in translation file)', () => {
        const usedInCode = extractTranslationKeysFromCode(projectRoot);
        const usedInTests = extractTranslationKeysFromTestFiles(projectRoot);

        const missingKeys: string[] = [];

        for (const key of usedInCode) {
            // Skip keys that are dynamic prefixes (end with .) - these are template string patterns
            if (key.endsWith('.')) {
                continue;
            }

            if (!allTranslationKeys.has(key)) {
                // Check if this is a prefix for existing keys (dynamic key usage)
                const isPrefix = [...allTranslationKeys].some((tk) => tk.startsWith(key + '.'));
                // Check if pluralized versions exist (i18next uses _one, _other, etc.)
                const hasPluralForm = hasPluralizedKey(key);
                if (!isPrefix && !hasPluralForm) {
                    missingKeys.push(key);
                }
            }
        }

        // Also check test file keys but only report them if they're actual translation paths
        // (ignoring partial paths like just "createGroupModal" which might be object access)
        for (const key of usedInTests) {
            if (key.includes('.') && !allTranslationKeys.has(key)) {
                // Verify it's not a partial path by checking if any key starts with it
                const isPartialPath = [...allTranslationKeys].some((tk) => tk.startsWith(key + '.'));
                if (!isPartialPath) {
                    missingKeys.push(`[test] ${key}`);
                }
            }
        }

        if (missingKeys.length > 0) {
            throw new Error(
                `Found ${missingKeys.length} missing translation keys (used in code but not defined):\n\n`
                    + missingKeys.sort().map((k) => `  - ${k}`).join('\n'),
            );
        }
    });

    it('should not have redundant translation keys (defined but never used)', () => {
        const usedInCode = extractTranslationKeysFromCode(projectRoot);
        const usedInTests = extractTranslationKeysFromTestFiles(projectRoot);

        // Collect prefixes from dynamic key patterns (keys ending with .)
        const dynamicPrefixes = new Set<string>();
        for (const key of usedInCode) {
            if (key.endsWith('.')) {
                dynamicPrefixes.add(key.slice(0, -1)); // Remove trailing dot
            }
        }

        // Combine used keys and also consider partial paths from test files
        const allUsedKeys = new Set<string>();
        for (const key of usedInCode) {
            if (!key.endsWith('.')) {
                allUsedKeys.add(key);
            }
        }
        for (const key of usedInTests) {
            allUsedKeys.add(key);
            // Also add all parent paths for test file access patterns
            const parts = key.split('.');
            for (let i = 1; i <= parts.length; i++) {
                allUsedKeys.add(parts.slice(0, i).join('.'));
            }
        }

        // Keys that are TRULY used dynamically and cannot be statically detected.
        // Static analysis cannot detect keys used via:
        // - Template strings: t(`prefix.${variable}`)
        // - Object lookups: t(translations[key])
        // - Dynamic construction: t(errorCode)
        //
        // IMPORTANT: Only add patterns here for keys that are genuinely constructed
        // at runtime. Do NOT add entire namespaces just because the test fails -
        // that defeats the purpose of detecting unused keys.
        const dynamicKeyPatterns = [
            // Pluralization keys (used with count interpolation)
            /_plural$/,
            /_one$/,
            /_other$/,
            // API error codes - looked up dynamically via error code strings
            /^apiErrors\./,
            /^authErrors\./,
            // Role labels/descriptions - looked up via role string
            /^roles\./,
            // Activity feed event types - looked up via event type string
            /^activityFeed\.events\./,
            // Permission options - looked up via permission level string
            /^securitySettingsModal\.permissionOptions\./,
            // Admin tenant/user type lookups
            /^admin\.tenants\.types\./,
            /^admin\.users\.roles\./,
            // Validation messages - field names interpolated
            /^validation\./,
        ];

        const redundantKeys: string[] = [];

        for (const key of allTranslationKeys) {
            // Check if key matches any dynamic pattern
            const isDynamicKey = dynamicKeyPatterns.some((pattern) => pattern.test(key));
            if (isDynamicKey) {
                continue;
            }

            // Check if key starts with any dynamic prefix (from template string patterns)
            const matchesDynamicPrefix = [...dynamicPrefixes].some((prefix) => key.startsWith(prefix + '.'));
            if (matchesDynamicPrefix) {
                continue;
            }

            // Check if key or any parent is used
            let isUsed = allUsedKeys.has(key);
            if (!isUsed) {
                // Check if any parent path is used (for object access patterns)
                const parts = key.split('.');
                for (let i = 1; i < parts.length && !isUsed; i++) {
                    const parentPath = parts.slice(0, i).join('.');
                    if (allUsedKeys.has(parentPath)) {
                        isUsed = true;
                    }
                }
            }

            if (!isUsed) {
                redundantKeys.push(key);
            }
        }

        if (redundantKeys.length > 0) {
            // Group by top-level namespace for summary
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
                    + '  2. If keys ARE used dynamically (via template strings or runtime lookups),\n'
                    + '     add the pattern to dynamicKeyPatterns in this test file.',
            );
        }
    });

    it('should have all translation keys present (sanity check)', () => {
        expect(allTranslationKeys.size).toBeGreaterThan(100);
    });
});

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

            // Find keys missing from this translation
            const missingKeys: string[] = [];
            for (const key of englishKeys) {
                if (!fileKeys.has(key)) {
                    missingKeys.push(key);
                }
            }

            // Find extra keys in this translation
            const extraKeys: string[] = [];
            for (const key of fileKeys) {
                if (!englishKeys.has(key)) {
                    extraKeys.push(key);
                }
            }

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
            throw new Error(
                `Translation key mismatches found:\n\n${errors.join('\n\n')}`,
            );
        }
    });

    it('should not have untranslated English strings in non-English files', () => {
        const errors: string[] = [];

        for (const file of nonEnglishFiles) {
            const entries = flattenWithValues(file.data as Record<string, unknown>);
            const untranslated: Array<{ key: string; value: string }> = [];

            for (const entry of entries) {
                if (isLikelyUntranslatedEnglish(entry.value, file.code)) {
                    untranslated.push(entry);
                }
            }

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
                    + 'If these strings are intentionally in English (brand names, technical terms), '
                    + 'add them to ALLOWED_ENGLISH_PATTERNS in the test.',
            );
        }
    });
});

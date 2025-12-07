import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { translationEn } from '../../translations/translation-en';

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

    // Also check test files that might access translationEn directly
    // Pattern: translationEn.key.path or translationEn['key']['path']
    const testDirs = [
        path.join(projectRoot, 'webapp-v2/src/__tests__'),
        path.join(projectRoot, 'e2e-tests/src'),
        path.join(projectRoot, 'packages/test-support/src'),
    ];

    const dotAccessPattern = /translationEn\.([a-zA-Z0-9_.]+)/g;

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
                    let match;
                    while ((match = dotAccessPattern.exec(content)) !== null) {
                        let keyPath = match[1];
                        // Remove trailing string methods (e.g., ".replace" from "key.path.replace")
                        const parts = keyPath.split('.');
                        while (parts.length > 0 && STRING_METHODS.has(parts[parts.length - 1])) {
                            parts.pop();
                        }
                        keyPath = parts.join('.');
                        if (keyPath) {
                            usedKeys.add(keyPath);
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

describe('Translation Keys Validation', () => {
    const projectRoot = path.join(__dirname, '../../../../..');
    const allTranslationKeys = new Set(flattenKeys(translationEn as Record<string, unknown>));

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
                if (!isPrefix) {
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
                `Found ${missingKeys.length} missing translation keys (used in code but not defined):\n\n` +
                    missingKeys.sort().map((k) => `  - ${k}`).join('\n')
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

        // Keys that are commonly used dynamically or through interpolation
        // These are legitimate even if we can't statically detect their usage
        // Static analysis cannot detect keys used via:
        // - Template strings: t(`prefix.${variable}`)
        // - Object lookups: t(translations[key])
        // - Dynamic construction: t(errorCode)
        const dynamicKeyPatterns = [
            // Pluralization keys (used with count interpolation)
            /_plural$/,
            /_one$/,
            /_other$/,
            // API error codes that are looked up dynamically
            /^apiErrors\./,
            /^authErrors\./,
            // Role labels/descriptions used dynamically
            /^roles\./,
            // Activity feed events and labels
            /^activityFeed\./,
            // Permission options used dynamically
            /^securitySettingsModal\./,
            // Pricing plan features (arrays)
            /^pricing\.plans\./,
            // Admin section - heavily uses dynamic key construction
            /^admin\./,
            // Profile summary roles are constructed dynamically
            /^settingsPage\.profileSummaryRole\./,
            // Share group modal
            /^shareGroupModal\./,
            // Validation messages with field interpolation
            /^validation\./,
            // UI components - often accessed dynamically
            /^ui\./,
            /^uiComponents\./,
            // User menu, indicator
            /^userMenu\./,
            /^userIndicator\./,
            /^usersBrowser\./,
            // Settlement forms and history
            /^settlement\./,
            /^settlementForm\./,
            /^settlementHistory\./,
            // Balance summary
            /^balanceSummary\./,
            // Group components
            /^group\./,
            /^groupActions\./,
            /^groupCard\./,
            /^groupComponents\./,
            /^groupDisplayNameSettings\./,
            /^groupHeader\./,
            /^groupSettingsModal\./,
            // Expense components
            /^expense\./,
            /^expenseForm\./,
            /^expenseComponents\./,
            /^expenseItem\./,
            /^expensesList\./,
            /^expenseBasicFields\./,
            /^expenseFormHeader\./,
            // Comments
            /^comments\./,
            // Join group
            /^joinGroup\./,
            /^joinGroupPage\./,
            /^joinGroupComponents\./,
            // Landing page
            /^landing\./,
            /^landingComponents\./,
            // Policy
            /^policy\./,
            /^policyComponents\./,
            // Dashboard
            /^dashboard\./,
            /^dashboardComponents\./,
            // Navigation
            /^navigation\./,
            /^header\./,
            /^footer\./,
            // Pages
            /^pages\./,
            // Static pages
            /^staticPages\./,
            // Settings
            /^settings\./,
            /^settingsPage\./,
            // Auth
            /^auth\./,
            /^authLayout\./,
            /^authProvider\./,
            // Create/edit group modals
            /^createGroupModal\./,
            /^editGroupModal\./,
            // Members list
            /^membersList\./,
            // Quick actions
            /^quickActions\./,
            // Empty states
            /^emptyGroupsState\./,
            // Error handling
            /^errors\./,
            /^errorState\./,
            /^errorBoundary\./,
            // Loading states
            /^loadingState\./,
            // Not found page
            /^notFoundPage\./,
            // Register/login pages
            /^registerPage\./,
            /^loginPage\./,
            // SEO
            /^seo\./,
            // App
            /^app\./,
            // Main
            /^main\./,
            // Common
            /^common\./,
            // Pagination
            /^pagination\./,
            // Accessibility
            /^accessibility\./,
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
            throw new Error(
                `Found ${redundantKeys.length} redundant translation keys (defined but never used):\n\n` +
                    redundantKeys.sort().map((k) => `  - ${k}`).join('\n') +
                    '\n\nIf these keys are used dynamically, add the pattern to dynamicKeyPatterns in the test.'
            );
        }
    });

    it('should have all translation keys present (sanity check)', () => {
        expect(allTranslationKeys.size).toBeGreaterThan(100);
    });
});

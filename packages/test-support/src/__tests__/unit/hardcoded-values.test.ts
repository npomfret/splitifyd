import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Hardcoded Values Validation', () => {
    it('should not contain hardcoded brand names in any git tracked files', () => {
        const projectRoot = path.join(__dirname, '../../../../..');
        const hardcodedBrandName = 'splitifyd'; // The old brand name to detect

        // Exceptions: this test file (contains the search string as a variable)
        const testFilePath = path.relative(projectRoot, __filename);
        const exceptions = [
            testFilePath,
            'packages/test-support/src/__tests__/unit/hardcoded-values.test.ts',
            'firebase/.firebaserc',
            'firebase/package.json',
            'firebase/service-account-key.json',
            'firebase/functions/vitest.config.ts', // todo
            // Deployment scripts contain example commands with real URLs
            'firebase/scripts/deployment/deploy-from-fresh-checkout.ts',
            'firebase/scripts/deployment/staging-operations.sh',
            'firebase/scripts/seed-policies.ts',
            'firebase/scripts/sync-tenant-configs.ts',
            'scripts/theme-storage/setup.sh',
            // Firebase init contains comments showing env var format
            'firebase/functions/src/firebase.ts',
        ];

        // Directories to exclude from checking
        const excludeDirectories = [
            'docs/',
            '.idea/',
            'tasks',
            // Tenant configs are example/template configs with placeholder domains
            'firebase/docs/tenants/',
        ];

        // Get all git tracked files
        const gitFiles = execSync('git ls-files', {
            cwd: projectRoot,
            encoding: 'utf8',
        })
            .trim()
            .split('\n')
            .filter(Boolean);

        const violations: { file: string; matches: string[]; }[] = [];

        gitFiles.forEach((file) => {
            // Skip exceptions and excluded directories
            if (exceptions.includes(file) || excludeDirectories.some((dir) => file.startsWith(dir))) {
                return;
            }

            const filePath = path.join(projectRoot, file);

            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                return;
            }

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const matches: string[] = [];

                lines.forEach((line, index) => {
                    if (line.includes(hardcodedBrandName)) {
                        matches.push(`Line ${index + 1}: ${line.trim()}`);
                    }
                });

                if (matches.length > 0) {
                    violations.push({ file, matches });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        });

        if (violations.length > 0) {
            const errorMessage = violations.map(({ file, matches }) => `${file}:\n${matches.map((match) => `  ${match}`).join('\n')}`).join('\n\n');

            throw new Error(`Found hardcoded "${hardcodedBrandName}" references in ${violations.length} files:\n\n${errorMessage}`);
        }
    });
});

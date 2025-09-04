import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Hardcoded Values Validation', () => {
    // TODO: Work in progress - needs configuration update
    it.skip('should not contain "splitifyd" in any git tracked files', () => {
        const projectRoot = path.join(__dirname, '../../..');

        // Exceptions: this test file and documentation/IDE files
        const exceptions = [
            'e2e-tests/src/__tests__/hardcoded-values.test.ts',
            'firebase/.firebaserc',
            'webapp/esbuild.config.js',
            'package.json',
            'package-lock.json',
            'test-support/package.json',
            'e2e-tests/package.json',
            'firebase/functions/__tests__/support/ApiDriver.ts',
            'e2e-tests/helpers/emulator-utils.ts',
            'e2e-tests/tests/homepage.e2e.test.ts',
            'e2e-tests/tests/run-mcp-debug.ts',
            'mcp-browser-tests/lib/browser-test-base.ts',
            'webapp-v2/src/__tests__/setup.ts',
            'webapp-v2/src/components/__tests__/SEOHead.test.tsx',
            'webapp-v2/src/components/__tests__/StaticPageLayout.seo.test.tsx',
            'webapp-v2/src/pages/static/TermsOfServicePage.tsx',
            'webapp-v2/src/pages/static/__tests__/TermsOfServicePage.test.tsx',
        ];

        const excludeDirectories = ['docs/', '.idea/'];

        // Get all git tracked files
        const gitFiles = execSync('git ls-files', {
            cwd: projectRoot,
            encoding: 'utf8',
        })
            .trim()
            .split('\n')
            .filter(Boolean);

        const violations: { file: string; matches: string[] }[] = [];

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
                    if (line.includes('splitifyd')) {
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

            throw new Error(`Found "splitifyd" references in ${violations.length} files:\n\n${errorMessage}`);
        }
    });
});
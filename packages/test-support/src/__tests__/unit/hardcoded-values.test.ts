import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Hardcoded Values Validation', () => {
    it('should not contain "splitifyd" in any git tracked files', () => {
        const projectRoot = path.join(__dirname, '../../..');

        // Exceptions: this test file and documentation/IDE files
        const exceptions = [
            'package.json',
            'run-test.sh',
            'e2e-tests/src/__tests__/hardcoded-values.test.ts',
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

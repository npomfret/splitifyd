#!/usr/bin/env node

/**
 * Test wrapper script that prevents incorrect test command usage
 * Blocks any arguments passed to test commands
 * Only allows: npm run test (with no arguments)
 */

const { spawn } = require('child_process');
const path = require('path');

// Check if any arguments are being passed
const args = process.argv.slice(2);
const hasArguments = args.length > 0;

if (hasArguments) {
    console.error('\n❌ ERROR: Test commands do not accept arguments!');
    console.error(`You used: npm test ${args.join(' ')}`);
    console.error('\n✅ CORRECT USAGE:');
    console.error('\nThe only valid command is: npm run test');
    console.error('\nFor running individual test files, read docs/guides/*.md');
    console.error('See docs/guides/building-and-testing.md for more details.\n');
    process.exit(1);
}

// Get the original script name from environment or default
const originalScript = process.env.ORIGINAL_TEST_SCRIPT || 'test';
const isMonorepoRoot = process.cwd() === path.resolve(__dirname, '..');

// Test command mappings based on project type and script
function getTestCommand(scriptType, packageName) {
    const commands = {
        functions: {
            test: 'npm run test:unit && npm run test:integration',
            'test:unit': 'vitest run src/__tests__/unit/',
            'test:integration':
                'BUILD_MODE=test npm run build && vitest run src/__tests__/integration/ --reporter=default --reporter=json --outputFile=integration-test-results.json && node ../../scripts/analyze-test-performance.js integration-test-results.json',
        },
        'webapp-v2': {
            test: 'npm run test:unit && npm run test:integration',
            'test:unit': 'vitest run src/__tests__/unit/vitest',
            'test:integration': 'playwright test',
        },
        '@billsplit-wl/e2e-tests': {
            test: 'npm run test:integration',
            'test:unit': 'echo \'No unit tests for e2e-tests package\'',
            'test:integration':
                'BUILD_MODE=test npm run build && mkdir -p playwright-output/integration/report playwright-output/integration/data && JAVA_TOOL_OPTIONS="-Xmx4g" PLAYWRIGHT_HTML_REPORT=playwright-output/integration/report PLAYWRIGHT_TEST_OUTPUT_DIR=playwright-output/integration/data PLAYWRIGHT_HTML_OPEN=never npx playwright test --workers=1 --project=chromium --reporter=html src/__tests__/integration',
        },
        '@billsplit-wl/shared': {
            test: 'npm run test:unit && npm run test:integration',
            'test:unit': 'vitest run src/__tests__/',
            'test:integration': 'echo \'No integration tests for shared package\'',
        },
        '@billsplit-wl/test-support': {
            test: 'npm run test:unit && npm run test:integration',
            'test:unit': 'echo \'No unit tests for shared package\'',
            'test:integration': 'echo \'No integration tests for test-support package\'',
        },
        '@billsplit-wl/firebase-simulator': {
            test: 'npm run test:unit && npm run test:integration',
            'test:unit': 'vitest run --config vitest.config.ts src/__tests__/unit/',
            'test:integration': 'vitest run --config vitest.config.ts src/__tests__/integration/ --test-timeout 5000 --hook-timeout 5000 --teardown-timeout 5000',
        },
        backend: {
            test: 'cd functions && npm test',
            'test:unit': 'cd functions && npm run test:unit',
            'test:integration': 'cd functions && npm run test:integration',
        },
    };

    return commands[packageName]?.[scriptType];
}

// Determine the actual command to run
let actualCommand;
let actualArgs;

if (isMonorepoRoot) {
    // At monorepo root, we need to manually call each workspace
    // For now, we'll map to the specific commands that make sense at root level
    const rootCommands = {
        test: 'npm run test:unit -ws --if-present && npm run test:integration -ws --if-present',
        'test:unit': 'npm run test:unit -ws --if-present',
        'test:integration': 'npm run test:integration -ws --if-present',
    };

    actualCommand = rootCommands[originalScript];
    actualArgs = [];

    if (!actualCommand) {
        console.error(`No root command mapping found for "${originalScript}"`);
        process.exit(1);
    }
} else {
    // In a specific workspace, execute the command directly
    const packageJson = require(path.join(process.cwd(), 'package.json'));
    const packageName = packageJson.name;
    const command = getTestCommand(originalScript, packageName);

    if (!command) {
        console.error(`No command mapping found for "${originalScript}" in package "${packageName}"`);
        process.exit(1);
    }

    // Execute the command directly using shell
    actualCommand = command;
    actualArgs = [];
}

// Execute the actual test command
const child = spawn(actualCommand, [], {
    stdio: 'inherit',
    shell: true,
});

child.on('exit', (code) => {
    process.exit(code);
});

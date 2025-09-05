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

// Determine the actual command to run
let actualCommand;
let actualArgs;

if (isMonorepoRoot) {
  // At monorepo root, delegate to workspaces using the direct scripts
  actualCommand = 'npm';
  actualArgs = ['run', `${originalScript}:direct`, '-ws', '--if-present'];
} else {
  // In a specific workspace, run the direct script to avoid recursion
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const directScript = `${originalScript}:direct`;
  const testScript = packageJson.scripts?.[directScript];
  
  if (!testScript) {
    console.error(`No "${directScript}" script found in package.json`);
    process.exit(1);
  }
  
  // Run the direct script
  actualCommand = 'npm';
  actualArgs = ['run', directScript];
}

// Execute the actual test command
const child = spawn(actualCommand, actualArgs, {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});
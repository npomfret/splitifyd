#!/usr/bin/env npx tsx

/**
 * MCP Browser Test Runner
 * 
 * This file provides instructions for running browser tests through Claude Code's MCP integration.
 * When executed through Claude Code, it will use real browser automation.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Get firebase config for URLs
const firebaseConfig = JSON.parse(readFileSync(join(process.cwd(), 'firebase/firebase.json'), 'utf-8'));
const HOSTING_PORT = firebaseConfig.emulators?.hosting?.port || 5002;
const BASE_URL = `http://localhost:${HOSTING_PORT}`;

console.log(`
====================================================================
🧪 MCP BROWSER TEST RUNNER
====================================================================

This test suite uses Claude Code's MCP (Model Context Protocol) 
browser automation integration to test the Splitifyd webapp-v2.

Prerequisites:
✓ Firebase emulator must be running (npm run dev)
✓ Claude Desktop must be configured with MCP
✓ Run these tests through Claude Code CLI

Base URL: ${BASE_URL}/v2

Available test suites:
1. Homepage Tests (npm run test:browser:homepage)
   - Tests landing page elements
   - Verifies responsive design
   - Checks for console errors

2. Login Tests (npm run test:browser:login)
   - Tests authentication flows
   - Form validation
   - Login/logout functionality
   - Protected route access

3. Expense Tests (npm run test:browser:expenses)
   - Tests expense creation
   - Custom splits
   - Editing and deletion
   - History tracking

To run a specific test through Claude Code:
1. Ask Claude to run the browser tests
2. Claude will use MCP tools to control the browser
3. Screenshots will be taken for verification
4. Test results will be reported

Example Claude Code command:
"Run the homepage browser tests using MCP"

====================================================================
`);

// Instructions for Claude Code when this script is run
console.log(`
INSTRUCTIONS FOR CLAUDE CODE:

When asked to run browser tests, use the MCP browser automation tools:

1. Use mcp__playwright__browser_navigate to go to pages
2. Use mcp__playwright__browser_snapshot to check page state
3. Use mcp__playwright__browser_click to interact with elements
4. Use mcp__playwright__browser_type for form inputs
5. Use mcp__playwright__browser_take_screenshot for visual verification
6. Use mcp__playwright__browser_console_messages to check for errors
7. Use mcp__playwright__browser_evaluate to run custom JavaScript

The test files in this directory contain detailed instructions
for each test scenario. Follow them step by step using the MCP tools.

Report results back to the user with:
- Pass/fail status for each test
- Screenshots of key states
- Any console errors found
- Performance observations
`);
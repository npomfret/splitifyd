# MCP Browser Tests

This directory contains real browser automation tests using Claude Code's MCP (Model Context Protocol) integration with Playwright.

## Prerequisites

1. Claude Desktop must be running with MCP configured
2. Firebase emulator must be running (`npm run dev`)
3. Webapp-v2 must be built and served

## Test Structure

- `test-homepage.ts` - Tests the webapp-v2 landing page
- `test-login.ts` - Tests authentication flow
- `test-expenses.ts` - Tests expense creation and management
- `test-groups.ts` - Tests group functionality
- `lib/` - Shared test utilities and helpers

## Running Tests

These tests are designed to be run through Claude Code using MCP browser automation tools.

```bash
# Run all browser tests
npm run test:browser

# Run specific test suite
npm run test:browser:homepage
npm run test:browser:login
npm run test:browser:expenses
```

## How These Tests Work

Unlike traditional Playwright tests, these use Claude Code's MCP integration to control the browser. The tests:

1. Use MCP browser navigation and interaction tools
2. Take screenshots for visual verification
3. Check for console errors
4. Validate page state and user flows
5. Can set up test data using the ApiDriver

## Writing New Tests

1. Import test utilities from `lib/`
2. Use MCP browser tools for all interactions
3. Always clean up test data after tests
4. Include visual verification with screenshots
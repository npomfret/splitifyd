# MCP Integration for E2E Tests

## Overview

This integration allows failed Playwright e2e tests to be debugged using Claude Code's MCP (Model Context Protocol) browser automation tools.

## How It Works

1. **Automatic Detection**: When a Playwright e2e test fails, it logs MCP debug instructions
2. **MCP Tools**: Claude Code can use MCP browser tools to investigate the failure
3. **Visual Debugging**: Screenshots and console logs are captured for analysis

## Setup

### 1. Enable MCP Debugging in Tests

Add to your test file:

```typescript
import { setupMCPDebugOnFailure } from './helpers';

// Enable MCP debugging for all tests in this file
setupMCPDebugOnFailure();
```

### 2. Debug Failed Tests

When a test fails, you'll see output like:

```
================================================================================
❌ TEST FAILED - MCP DEBUG INSTRUCTIONS
================================================================================
Test: should show form fields on login page
File: auth-flow.e2e.test.ts
URL: http://localhost:6002/v2/login

To debug this test with Claude Code MCP:
1. Ask Claude: "Debug the failed test using MCP browser tools"
2. Claude will navigate to the page and check for issues
3. Screenshots and console logs will be captured
================================================================================
```

### 3. Run MCP Debug

You can also manually trigger MCP debugging:

```bash
# Debug a specific test
npx tsx e2e/run-mcp-debug.ts --test "login form test" --url "http://localhost:6002/v2/login"

# Debug with error details
npx tsx e2e/run-mcp-debug.ts --test "navigation test" --error "Button not found" --file "nav.test.ts"
```

## Available MCP Tools

When debugging, Claude Code can use these MCP tools:

- `mcp__puppeteer__puppeteer_navigate` - Navigate to URLs
- `mcp__puppeteer__puppeteer_screenshot` - Capture screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill form fields
- `mcp__puppeteer__puppeteer_evaluate` - Run JavaScript in the browser
- `mcp__puppeteer__puppeteer_select` - Select dropdown options
- `mcp__puppeteer__puppeteer_hover` - Hover over elements

## Example Debug Session

1. **Test Fails**:
   ```
   ❌ auth-flow.e2e.test.ts > should show form fields on login page
   Error: Expected element to be visible
   ```

2. **Ask Claude**:
   ```
   "Debug the 'should show form fields on login page' test failure using MCP browser tools"
   ```

3. **Claude Investigates**:
   - Navigates to the login page
   - Takes screenshots
   - Checks for console errors
   - Verifies element presence
   - Reports findings

## Best Practices

1. **Always Enable MCP Debug**: Add `setupMCPDebugOnFailure()` to test files
2. **Clear Test Names**: Use descriptive test names for easier debugging
3. **Check Console**: Most UI issues show console errors
4. **Visual Verification**: Screenshots help identify layout issues

## Integration with Existing MCP Tests

The MCP browser tests in `/mcp-browser-tests/` can be used for:

- Manual testing of specific flows
- Creating debug scenarios
- Visual regression testing
- Cross-browser verification

## Troubleshooting

### MCP Not Available
- Ensure Claude Desktop config includes Puppeteer MCP server
- Restart Claude Desktop after config changes
- Check `~/Library/Application Support/Claude/claude_desktop_config.json`

### Tests Can't Connect
- Verify Firebase emulator is running: `npm run dev`
- Check correct port: `npm run get-webapp-url`
- Ensure webapp-v2 is built: `npm run webapp-v2:build`

### Debug Output Not Showing
- Make sure `setupMCPDebugOnFailure()` is called
- Check test is actually failing (not skipped)
- Look for the "TEST FAILED - MCP DEBUG INSTRUCTIONS" banner
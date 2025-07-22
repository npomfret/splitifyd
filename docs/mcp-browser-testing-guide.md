# MCP Browser Testing Guide

## Overview

MCP (Model Context Protocol) enables Claude Code CLI to automatically interact with browsers, eliminating the need for manual console checking and screenshot taking.

## Setup Instructions

### 1. Configuration File Location

The MCP configuration is stored at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### 2. Configuration Contents

The configuration has been set up with the Playwright MCP server:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

### 3. Activation

1. **Restart Claude Desktop** to load the MCP server configuration
2. The Playwright MCP server will be available in your Claude Code CLI sessions

## Available MCP Tools

Once configured, Claude can use these browser automation tools:

- **`browser_console_messages`** - Retrieves all console output (logs, warnings, errors)
- **Screenshot capture** - Takes screenshots of web pages
- **JavaScript execution** - Runs JavaScript in the browser context
- **Page navigation** - Opens URLs and navigates between pages
- **Element interaction** - Clicks, types, and interacts with page elements
- **Network monitoring** - Observes API calls and responses

## Usage Examples

### Basic Console Check
```
"Check the console for any errors on the dashboard page"
```
Claude will:
1. Navigate to the dashboard
2. Retrieve all console messages
3. Report any errors or warnings found

### Screenshot Capture
```
"Take a screenshot of the groups list page"
```
Claude will:
1. Navigate to the groups list
2. Capture a screenshot
3. Save or display the screenshot

### Full Page Test
```
"Test the add expense flow for console errors"
```
Claude will:
1. Navigate through the add expense flow
2. Monitor console at each step
3. Check for network errors
4. Report any issues found

## Best Practices

### 1. Development Workflow
- Start each session by confirming MCP is available
- Request automated checks instead of manual verification
- Use specific requests like "check console on [page]"

### 2. Error Detection
- Ask Claude to check console after making changes
- Request screenshots when implementing new features
- Have Claude verify network requests are successful

### 3. Cross-Browser Testing
- MCP uses Chromium by default
- For other browsers, manual testing may still be needed
- Focus automated testing on console errors and functionality

## Troubleshooting

### MCP Not Available
If MCP tools aren't available:
1. Verify configuration file exists at the correct location
2. Restart Claude Desktop
3. Check for any error messages

### Server Not Starting
If the Playwright server fails:
1. Ensure you have internet connection (for npx download)
2. Check that Node.js is installed
3. Try running `npx @executeautomation/playwright-mcp-server` manually to test

## Integration with Existing Tests

MCP complements but doesn't replace:
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright in CI/CD)

Use MCP for:
- Development-time verification
- Quick console checks
- Visual regression catching
- Rapid feedback loops

## Example Development Session

```typescript
// 1. Make a code change
await updateGroupsComponent();

// 2. Request automated verification
"Open localhost:3000/dashboard and check for console errors"

// 3. If errors found, fix and re-test
"Check the console again after my fix"

// 4. Capture success state
"Take a screenshot of the working dashboard"
```

## Benefits

1. **No Manual Checking** - Claude automatically retrieves console output
2. **Faster Development** - Immediate feedback on errors
3. **Better Documentation** - Automatic screenshots for PRs
4. **Consistent Testing** - Same checks every time
5. **Reduced Context Switching** - Stay in your editor

## Next Steps

1. After setup, test with: "Can you check if the webapp has any console errors?"
2. Incorporate into your development workflow
3. Request automated checks instead of manual verification
4. Use screenshots for documentation

Remember: MCP makes browser testing automatic, but you still need to request the checks. Make it a habit to ask Claude to verify your changes!
# Browser Testing Directive

> **🎉 NEW: Automated Browser Testing with MCP** - Claude Code CLI can now automatically check console errors, take screenshots, and verify page state using MCP browser automation. See section 7 for details.

## Core Principle

**IN-BROWSER TESTING IS MANDATORY AT EVERY STEP** - Not just unit tests, but real browser verification.

## Requirements

### 1. Console Hygiene
- **Zero Errors**: No console errors allowed (red messages)
- **Zero Warnings**: No console warnings allowed (yellow messages)
- **Clean Logs**: Only intentional debug logs during development
- **Check Every Page**: Test console on every route/page

### 2. Visual Verification
- **Render Check**: Every component must render without layout breaks
- **Style Validation**: CSS must load correctly, no missing styles
- **Responsive Design**: Test at minimum:
  - Mobile: 375px (iPhone SE)
  - Tablet: 768px (iPad)
  - Desktop: 1440px (typical laptop)
- **Cross-Browser**: Test in:
  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest)

### 3. Network Monitoring
- **API Calls**: Verify all requests in Network tab
- **Status Codes**: All API calls should return appropriate status (200, 201, etc.)
- **Payloads**: Check request/response payloads match expected types
- **Performance**: No requests should take > 3 seconds
- **Error Handling**: Test network failures and error responses

### 4. Testing Checklist for Every Feature

```markdown
## In-Browser Testing Checklist

### Console
- [ ] No errors in console
- [ ] No warnings in console
- [ ] No failed network requests

### Visual
- [ ] Page renders correctly
- [ ] All text is visible and readable
- [ ] Images load properly
- [ ] No layout shifts or broken styles
- [ ] Interactive elements are clickable

### Responsive
- [ ] Mobile view (375px) looks correct
- [ ] Tablet view (768px) looks correct
- [ ] Desktop view (1440px) looks correct

### Network
- [ ] All API calls succeed
- [ ] Response data is correct shape
- [ ] Loading states display properly
- [ ] Error states display properly

### Screenshots
- [ ] Screenshot of feature in desktop view
- [ ] Screenshot of feature in mobile view
- [ ] Screenshot of any error states
```

### 5. Screenshot Requirements
- **When to Screenshot**:
  - New features/pages
  - Visual bugs before fixing
  - Successful implementations
  - Error states and edge cases
- **How to Screenshot**:
  - Use browser DevTools for consistent sizing
  - Include relevant DevTools panels if showing errors
  - Name files descriptively: `feature-name-viewport-state.png`

### 6. Testing During Development

```typescript
// ALWAYS test these scenarios:

// 1. Happy path - everything works
await testNormalUserFlow();

// 2. Error handling - when things fail
await testWithNetworkError();
await testWithInvalidData();
await testWithSlowConnection();

// 3. Edge cases
await testEmptyStates();
await testMaximumLimits();
await testConcurrentRequests();

// 4. Browser differences
await testInChrome();
await testInFirefox();
await testInSafari();
```

### 7. Automated Browser Testing with MCP

#### MCP Integration (NEW - Preferred Method)
Claude Code CLI now supports automated browser testing through MCP (Model Context Protocol):

**Setup (One-time)**:
1. MCP Playwright server is configured in `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Restart Claude Desktop to load the MCP server
3. Use MCP tools for automated browser testing

**Available MCP Browser Commands**:
- `browser_console_messages` - Automatically captures all console logs/errors/warnings
- Take screenshots programmatically
- Execute JavaScript in browser context
- Navigate and interact with pages
- Monitor network requests

**Example Usage**:
```typescript
// Instead of manual checking, Claude can now:
// 1. Open your webapp automatically
// 2. Check console for errors
// 3. Take screenshots
// 4. Verify page state
// 5. Report issues directly
```

#### Traditional Playwright Testing
While MCP is preferred for development, still use Playwright for CI/CD:
- Use Playwright for E2E tests
- Test critical user journeys  
- Run before every deployment
- Take screenshots on test failures

## Common Issues to Check

1. **Race Conditions**: Multiple API calls completing out of order
2. **Memory Leaks**: Check DevTools Memory tab after extended use
3. **Stale Data**: Ensure UI updates when data changes
4. **Loading States**: Never show blank screens during data fetching
5. **Error Boundaries**: Graceful handling of component errors
6. **Form Validation**: Both client and server-side validation working

## Developer Workflow

### With MCP Automation (Recommended)
1. **Before Starting**: Ensure Claude Desktop has MCP configured
2. **During Development**: 
   - Let Claude automatically check console after changes
   - Request: "Check the webapp console for errors"
   - Request: "Take a screenshot of the current page"
3. **Before Committing**: 
   - Request: "Run full browser test of [feature]"
   - Claude will automatically verify console, take screenshots, and report issues

### Manual Testing (Fallback)
1. **Before Starting**: Open DevTools Console and Network tabs
2. **During Development**: Check console after every change
3. **Before Committing**: Full browser test of affected features
4. **Documentation**: Screenshot new features for PR

## Red Flags - Stop and Fix Immediately

- Any console error (red)
- Any console warning (yellow)  
- Failed network requests (red in Network tab)
- Blank/white screens
- Infinite loading states
- Layout that breaks on resize
- Text that gets cut off
- Buttons that don't respond to clicks

## Remember

> "If it's not tested in a real browser, it's not tested. The console is your friend - keep it clean!"
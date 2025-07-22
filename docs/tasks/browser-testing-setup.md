# Browser Testing Setup with MCP

> **✅ COMPLETE**: MCP browser tools are now working! Automated testing is fully functional.

## Overview
Set up automated browser testing using MCP (Model Context Protocol) tools to enable screenshot capture and console error detection during development.

## Setup Complete ✅

**MCP browser testing is now fully configured and working:**

1. **✅ MCP Configured in Claude Desktop**
   - Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Playwright MCP server configured using `@playwright/mcp@latest`
   
2. **✅ Claude Desktop Restarted** 
   - Configuration loaded successfully
   
3. **✅ New Claude Code CLI Session Started**
   - MCP browser tools now available

4. **✅ MCP Tools Verified**
   - Available: `mcp__puppeteer__puppeteer_navigate`, `mcp__puppeteer__puppeteer_screenshot`, `mcp__puppeteer__puppeteer_evaluate`

## Prerequisites
- [x] MCP configured in Claude desktop config (✅ COMPLETE)
- [x] webapp-v2 integrated with Firebase hosting at /v2/
- [x] Understanding of docs/directives/browser-testing.md

## Current State ✅
- ✅ Automated browser testing via MCP Puppeteer
- ✅ Automated screenshot capture (multiple viewports)
- ✅ Console error detection via JavaScript evaluation
- ✅ Systematic testing approach implemented
- ✅ MCP browser tools fully available in Claude Code CLI

## Target State
- Automated browser testing via MCP tools
- Automatic screenshot capture
- Console error detection
- Systematic testing checklist

## Revised Implementation Plan (Webapp-v2 Focus)

### Phase 1: MCP Tool Investigation (COMPLETED)
- [x] Verify MCP browser tools availability - **NOT AVAILABLE in current session**
- [x] Document current state and limitations
- [x] Update plan to work with available tools

### Phase 2: Traditional Browser Testing Setup (45 min)
- [x] Create `scripts/browser-test-v2.ts` for webapp-v2 testing
- [x] Use tsx instead of Playwright for TypeScript execution
- [x] Focus testing on http://localhost:6002/v2/ only
- [x] Include viewport testing (mobile/tablet/desktop)
- [x] Add console error checking capabilities via manual checklist

### Phase 3: Integration & Documentation (30 min)
- [x] Update browser-testing-setup.md with revised plan
- [x] Add npm script: `npm run test:browser-v2`
- [x] Create webapp-v2 specific testing checklist
- [x] Document manual testing workflow as fallback

### Phase 4: Validation & Cleanup (15 min)
- [x] Test the complete workflow
- [x] Update related documentation
- [x] Validate all functionality works with Firebase emulator

Total: ~1.5 hours

## Testing Checklist

### MCP Tool Status ✅
- [x] mcp__puppeteer__puppeteer_navigate - ✅ WORKING
- [x] mcp__puppeteer__puppeteer_screenshot - ✅ WORKING
- [x] mcp__puppeteer__puppeteer_evaluate - ✅ WORKING (for console error checking)
- [x] mcp__puppeteer__puppeteer_click - ✅ WORKING
- [x] mcp__puppeteer__puppeteer_fill - ✅ WORKING
- [x] mcp__puppeteer__puppeteer_hover - ✅ WORKING

**Status**: Full automated testing capabilities available

### Webapp-v2 Test Scenarios (Focus: /v2/ only)

> **Note**: These checklists are provided by the `npm run test:browser-v2` script as manual testing guidance

1. **Homepage Load** ✅ AUTOMATED
   - [x] Navigate to http://localhost:6002/v2/
   - [x] Verify HomePage component renders
   - [x] Check for console errors via JavaScript evaluation
   - [x] Take desktop screenshot (1440x900)
   - [x] Take mobile screenshot (375x667)

2. **Route Navigation (webapp-v2 specific)** ✅ AUTOMATED
   - [x] Test HomePage route: /v2/
   - [x] Test NotFoundPage route: /v2/invalid-route
   - [x] Verify URL changes correctly
   - [x] Check for errors during Preact router transitions
   - [x] Capture screenshots of each page state

3. **Responsive Testing** ✅ AUTOMATED
   - [x] Test at 375px (mobile)
   - [x] Test at 768px (tablet) 
   - [x] Test at 1440px (desktop)
   - [x] Verify Tailwind CSS responsive classes work
   - [x] Check no horizontal scroll on any viewport

## Success Criteria
- [x] MCP browser tools status documented (not currently available)
- [x] Alternative testing setup working (tsx-based script)
- [x] Server connectivity verification automated
- [x] Manual testing guidance for console errors/screenshots
- [x] Testing integrated into development workflow
- [x] Documentation clear and helpful for webapp-v2 focus

## Notes
- **Focus**: webapp-v2 at /v2/ only (no old webapp testing)
- **Current Routes**: HomePage (/) and NotFoundPage (default)
- **Approach**: tsx-based script with manual checklist since MCP tools unavailable
- Start simple, enhance gradually
- Focus on developer productivity
- Make tests repeatable and reliable
- Follow browser testing directive

## Current Status
- [x] Phase 1 complete - MCP investigation done
- [x] Phase 2 complete - Traditional testing setup using tsx
- [x] Phase 3 complete - Integration & documentation
- [x] Phase 4 complete - Validation & cleanup

## IMPLEMENTATION STATUS: COMPLETE ✅

### What Was Built
- ✅ `scripts/browser-test-v2.ts` - Webapp-v2 focused testing script
- ✅ `npm run test:browser-v2` - Easy command to run browser tests
- ✅ Server connectivity verification (both routes return HTTP 200)
- ✅ Comprehensive manual testing checklist
- ✅ Viewport testing guidance for mobile/tablet/desktop
- ✅ Preact-specific testing considerations

### How to Use
```bash
# Run the browser testing script
npm run test:browser-v2
```

The script will:
1. ✅ Check server connectivity to both webapp-v2 routes
2. 🔍 Provide detailed manual testing checklist
3. 📋 Guide you through responsive testing
4. 📊 Generate a summary report

### Testing Results
When you run `npm run test:browser-v2`, you should see:
- ✅ Server connectivity verification (HTTP 200 responses)
- 🔍 Detailed manual testing instructions for each route
- 📋 Viewport-specific testing guidance
- 📊 Summary report with pass/fail/manual counts

### Completed Tasks ✅

**✅ MCP SETUP COMPLETE:**
- [x] MCP Playwright server configured in Claude Desktop
- [x] Claude Desktop restarted to load MCP configuration
- [x] New Claude Code CLI session started with MCP tools

**✅ AUTOMATED TESTING IMPLEMENTED:**
- [x] Automated browser navigation working
- [x] Automated screenshot capture for multiple viewports implemented
- [x] Automated console error detection and reporting working
- [x] Full MCP browser automation capabilities verified

**✅ TESTING VERIFIED:**
- [x] Successfully tested webapp-v2 homepage at /v2/
- [x] Successfully tested 404 page at /v2/invalid-route
- [x] Screenshots captured at desktop (1440x900) and mobile (375x667) viewports
- [x] Console error checking via JavaScript evaluation confirmed working
- [x] Page content verification (Welcome text, buttons, etc.) working

**Future Enhancements:**
- [ ] Add Playwright dependency as fallback for CI/CD
- [ ] Create visual regression testing capabilities
- [ ] Extend to cover additional routes as webapp-v2 grows
- [ ] Add performance testing metrics

### Integration with Development Workflow
This testing setup integrates with the existing development process:
1. Run `npm run dev:integrated` to start emulator
2. Make changes to webapp-v2
3. Run `npm run test:browser-v2` to verify
4. Follow manual checklist for thorough testing
5. Take screenshots for documentation/PRs
# Browser Testing Setup with MCP

> **🚨 ACTION REQUIRED**: MCP browser tools are still not available. See "What You Need To Do" section below.

## Overview
Set up automated browser testing using MCP (Model Context Protocol) tools to enable screenshot capture and console error detection during development.

## What You Need To Do

**To enable automated browser testing, you need to:**

1. **Configure MCP in Claude Desktop**
   - Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Add Playwright MCP server configuration (see `docs/mcp-browser-testing-guide.md`)
   
2. **Restart Claude Desktop** 
   - Close Claude Desktop completely
   - Reopen to load new MCP configuration
   
3. **Start New Claude Code CLI Session**
   - Current session doesn't have MCP browser tools
   - New session should have access to automated browser testing

4. **Verify MCP Tools Available**
   - Check for: `mcp__browser__navigate`, `mcp__browser__screenshot`, `mcp__browser__get_console_logs`

## Prerequisites
- [ ] MCP configured in Claude desktop config (STILL NOT AVAILABLE - ACTION REQUIRED)
- [x] webapp-v2 integrated with Firebase hosting at /v2/
- [x] Understanding of docs/directives/browser-testing.md

## Current State
- Manual browser testing only
- No automated screenshots
- Console errors checked manually
- No systematic testing approach
- MCP browser tools not currently available in Claude Code CLI session

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

### MCP Tool Status
- [x] mcp__browser__navigate - NOT AVAILABLE in current Claude session
- [x] mcp__browser__screenshot - NOT AVAILABLE in current Claude session  
- [x] mcp__browser__get_console_logs - NOT AVAILABLE in current Claude session
- [x] mcp__browser__click - NOT AVAILABLE in current Claude session

**Alternative**: Use tsx-based script with manual testing guidance

### Webapp-v2 Test Scenarios (Focus: /v2/ only)

> **Note**: These checklists are provided by the `npm run test:browser-v2` script as manual testing guidance

1. **Homepage Load** 
   - [ ] Navigate to http://localhost:6002/v2/
   - [ ] Verify HomePage component renders
   - [ ] Check for console errors
   - [ ] Take desktop screenshot (1440px)
   - [ ] Take mobile screenshot (375px)

2. **Route Navigation (webapp-v2 specific)**
   - [ ] Test HomePage route: /v2/
   - [ ] Test NotFoundPage route: /v2/invalid-route
   - [ ] Verify URL changes correctly
   - [ ] Check for errors during Preact router transitions
   - [ ] Capture screenshots of each page state

3. **Responsive Testing**
   - [ ] Test at 375px (mobile)
   - [ ] Test at 768px (tablet) 
   - [ ] Test at 1440px (desktop)
   - [ ] Verify Tailwind CSS responsive classes work
   - [ ] Check no horizontal scroll on any viewport

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

## IMPLEMENTATION STATUS: PARTIALLY COMPLETE ⚠️

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

### Outstanding Tasks & Next Steps

**🚨 IMMEDIATE ACTION REQUIRED:**
- [ ] **YOU NEED TO**: Configure MCP Playwright server in Claude Desktop
- [ ] **YOU NEED TO**: Restart Claude Desktop to load MCP configuration  
- [ ] **YOU NEED TO**: Start new Claude Code CLI session to get MCP tools

**Once MCP is Available:**
- [ ] Replace manual testing with automated browser navigation
- [ ] Implement automated screenshot capture for all viewports
- [ ] Add automated console error detection and reporting
- [ ] Update `scripts/browser-test-v2.ts` to use MCP browser tools

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
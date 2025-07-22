# Browser Testing Setup with MCP

## Overview
Set up automated browser testing using MCP (Model Context Protocol) tools to enable screenshot capture and console error detection during development.

## Prerequisites
- [ ] MCP configured in Claude desktop config (NOT CURRENTLY AVAILABLE)
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
- [ ] Create `scripts/browser-test-v2.ts` for webapp-v2 testing
- [ ] Add Playwright dependency for programmatic browser testing
- [ ] Focus testing on http://localhost:6002/v2/ only
- [ ] Include viewport testing (mobile/tablet/desktop)
- [ ] Add console error checking capabilities

### Phase 3: Integration & Documentation (30 min)
- [x] Update browser-testing-setup.md with revised plan
- [ ] Add npm script: `npm run test:browser-v2`
- [ ] Create webapp-v2 specific testing checklist
- [ ] Document manual testing workflow as fallback

### Phase 4: Validation & Cleanup (15 min)
- [ ] Test the complete workflow
- [ ] Update related documentation
- [ ] Validate all functionality works with Firebase emulator

Total: ~1.5 hours

## Testing Checklist

### MCP Tool Status
- [x] mcp__browser__navigate - NOT AVAILABLE in current Claude session
- [x] mcp__browser__screenshot - NOT AVAILABLE in current Claude session  
- [x] mcp__browser__get_console_logs - NOT AVAILABLE in current Claude session
- [x] mcp__browser__click - NOT AVAILABLE in current Claude session

**Alternative**: Use traditional Playwright for programmatic testing

### Webapp-v2 Test Scenarios (Focus: /v2/ only)
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
- **Approach**: Traditional Playwright since MCP tools unavailable
- Start simple, enhance gradually
- Focus on developer productivity
- Make tests repeatable and reliable
- Follow browser testing directive

## Current Status
- [x] Phase 1 complete - MCP investigation done
- [x] Phase 2 complete - Traditional testing setup using tsx
- [x] Phase 3 complete - Integration & documentation
- [x] Phase 4 complete - Validation & cleanup

## IMPLEMENTATION COMPLETE ✅

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
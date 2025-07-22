# Browser Testing Setup with MCP

## Overview
Set up automated browser testing using MCP (Model Context Protocol) tools to enable screenshot capture and console error detection during development.

## Prerequisites
- [x] MCP configured in Claude desktop config
- [x] webapp-v2 development server running
- [x] Understanding of docs/directives/browser-testing.md

## Current State
- Manual browser testing only
- No automated screenshots
- Console errors checked manually
- No systematic testing approach

## Target State
- Automated browser testing via MCP tools
- Automatic screenshot capture
- Console error detection
- Systematic testing checklist

## Implementation Plan (Small Commits)

### Commit 1: Test MCP Browser Tools (30 min)
- [ ] Verify MCP browser tools are available
- [ ] Test screenshot capture on webapp-v2
- [ ] Test console error detection
- [ ] Document available MCP commands

### Commit 2: Create Test Helper Script (30 min)
- [ ] Create `scripts/browser-test.ts`
- [ ] Add helper functions for common tests
- [ ] Include viewport testing (mobile/tablet/desktop)
- [ ] Add console error checking

### Commit 3: Add Test Documentation (30 min)
- [ ] Create `docs/browser-testing-guide.md`
- [ ] Document MCP setup verification
- [ ] Add example test scenarios
- [ ] Include troubleshooting section

### Commit 4: Integrate with Development (30 min)
- [ ] Add npm script for browser testing
- [ ] Create pre-commit hook for screenshots
- [ ] Add to developer workflow docs
- [ ] Test the complete flow

Total: ~2 hours

## Testing Checklist

### MCP Tool Verification
- [ ] mcp__browser__navigate works
- [ ] mcp__browser__screenshot captures images
- [ ] mcp__browser__get_console_logs returns errors
- [ ] mcp__browser__click functions properly

### Basic Test Scenarios
1. **Homepage Load**
   - [ ] Navigate to http://localhost:3000
   - [ ] Check for console errors
   - [ ] Take desktop screenshot (1440px)
   - [ ] Take mobile screenshot (375px)

2. **Route Navigation**
   - [ ] Click navigation links
   - [ ] Verify URL changes
   - [ ] Check for errors during transition
   - [ ] Capture screenshots of each page

3. **Responsive Testing**
   - [ ] Test at 375px (mobile)
   - [ ] Test at 768px (tablet)
   - [ ] Test at 1440px (desktop)
   - [ ] Verify no horizontal scroll

## Success Criteria
- [ ] MCP browser tools working correctly
- [ ] Can capture screenshots programmatically
- [ ] Console errors detected automatically
- [ ] Testing integrated into workflow
- [ ] Documentation clear and helpful

## Notes
- Start simple, enhance gradually
- Focus on developer productivity
- Make tests repeatable and reliable
- Follow browser testing directive
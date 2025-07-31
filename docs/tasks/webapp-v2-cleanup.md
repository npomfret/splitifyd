# Webapp V2 Cleanup Task

## Summary
Now that we've established there's only one webapp (no `/v2` prefix needed), we should clean up all v2-specific references throughout the codebase. This will reduce confusion and make the codebase cleaner.

## Priority: Medium
This is a refactoring task that improves code clarity but doesn't affect functionality.

## Tasks

### 1. Remove V2 Indicator Component (High Priority)
The V2Indicator component displays a red "v2 app" badge that's no longer needed.

**Files to modify:**
- Delete: `webapp-v2/src/components/ui/V2Indicator.tsx`
- Remove imports and usage from:
  - `webapp-v2/src/pages/LoginPage.tsx`
  - `webapp-v2/src/pages/RegisterPage.tsx`
  - `webapp-v2/src/pages/ResetPasswordPage.tsx`
  - `webapp-v2/src/pages/NotFoundPage.tsx`
  - `webapp-v2/src/pages/AddExpensePage.tsx`
  - `webapp-v2/src/components/layout/BaseLayout.tsx`

### 2. Rename Test Helper Functions (Medium Priority)
The function `waitForV2App` should be renamed to `waitForApp`.

**Files to modify:**
- `webapp-v2/e2e/helpers/emulator-utils.ts` - Rename function definition
- Update all imports and usages in test files:
  - `e2e/auth-flow.e2e.test.ts`
  - `e2e/homepage.e2e.test.ts`
  - `e2e/navigation.e2e.test.ts`
  - `e2e/static-pages.e2e.test.ts`
  - `e2e/seo.e2e.test.ts`
  - `e2e/monitoring.e2e.test.ts`
  - `e2e/form-validation.e2e.test.ts`
  - `e2e/performance.test.ts`
  - `e2e/pricing.e2e.test.ts`
  - `e2e/accessibility.test.ts`

### 3. Consider Directory Rename (Low Priority - Major Change)
Rename `webapp-v2` directory to just `webapp`.

**Impact:**
- All import paths would need updating
- Package.json workspace references
- Build scripts and CI/CD pipelines
- Documentation references
- Git history would be affected

**Recommendation:** Defer this until a major refactoring sprint

### 4. Update Documentation (Medium Priority)
Remove v2-specific references from documentation.

**Files to review and update:**
- `README.md`
- `AI_AGENT.md`
- `docs/tasks/webapp-v1-removal-plan.md` (can be archived)
- `docs/tasks/ui-consistency-v2-app.md`
- `docs/tasks/webapp-v2-authenticated-user-tests.md`
- `webapp-v2/e2e/MCP-INTEGRATION.md`
- `mcp-browser-tests/README.md`
- `docs/mcp-browser-testing-guide.md`

### 5. Clean Up BaseLayout Props (Low Priority)
The `showV2Indicator` prop in BaseLayout is no longer needed.

**File to modify:**
- `webapp-v2/src/components/layout/BaseLayout.tsx` - Remove showV2Indicator prop

## Implementation Order

1. **Phase 1**: Remove V2Indicator component and its usage (visual cleanup)
2. **Phase 2**: Rename waitForV2App to waitForApp (test cleanup)
3. **Phase 3**: Update documentation references
4. **Phase 4**: Clean up remaining props and interfaces
5. **Phase 5**: (Future) Consider directory rename if beneficial

## Testing Strategy

After each phase:
1. Run the full test suite to ensure nothing breaks
2. Verify the app still builds successfully
3. Do a visual check that no UI elements are broken

## Success Criteria

- No more "v2" indicators visible in the UI
- Test code uses generic naming (waitForApp instead of waitForV2App)
- Documentation reflects single webapp architecture
- Code is cleaner and less confusing for new developers

## Implementation Plan

### Phase 1: Remove V2Indicator Component
1. First, find all files that import V2Indicator
2. Remove the import statements and component usage from each file
3. Delete the V2Indicator component file
4. Run tests to ensure nothing breaks

### Phase 2: Rename Test Helper Function
1. Update the function definition in emulator-utils.ts
2. Find all test files that use waitForV2App
3. Replace all occurrences with waitForApp
4. Verify all E2E tests still pass

### Phase 3: Documentation Updates
1. Search for "v2" references in documentation files
2. Update or remove references as appropriate
3. Archive obsolete v1-removal documentation

### Phase 4: Clean Up Props
1. Remove showV2Indicator prop from BaseLayout interface
2. Remove any code that passes this prop
3. Verify the layout still works correctly

### Commit Strategy
- Each phase will be a separate commit
- Test after each commit to ensure stability
- Use descriptive commit messages for each phase
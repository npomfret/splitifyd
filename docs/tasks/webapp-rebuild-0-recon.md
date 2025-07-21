# Webapp Rebuild Task 0: Reconnaissance and Analysis

## Overview
Comprehensive analysis of the existing webapp to understand its structure, dependencies, pain points, and prepare for a successful migration to Preact.

## Current State
- **Build System**: Basic esbuild configuration with manual HTML templating
- **Framework**: Vanilla JavaScript/TypeScript with direct DOM manipulation
- **State Management**: Scattered across multiple modules with no central store
- **Testing**: Minimal coverage (only 3 test files)
- **Development Experience**: Fragile, changes frequently break functionality

## Target State
- Complete understanding of all pages, features, and user flows
- Documented list of pain points and migration risks
- Clear migration priority order based on complexity and user impact
- Validated endpoint contracts from Firebase functions

## Implementation Steps

### Phase 1: Code Analysis (1-2 days)

1. **Map all user flows**
   - [ ] Document complete user journey from landing → register → create group → add expense → settle
   - [ ] Identify critical paths that must work during migration
   - [ ] Note any hidden features or edge cases

2. **Analyze dependencies**
   - [ ] Review package.json and identify all external dependencies
   - [ ] Check for any libraries that might conflict with Preact
   - [ ] Document any custom build scripts or processes

3. **Document API endpoints**
   - [ ] Extract all API calls from `api.ts`
   - [ ] Map endpoints to their Firebase function handlers
   - [ ] Note any undocumented or legacy endpoints

4. **Identify shared code**
   - [ ] List all utilities that need to be migrated to the new structure
   - [ ] Identify code that can be deleted vs. must be preserved
   - [ ] Document any business logic embedded in UI code

### Phase 2: Pain Point Analysis (1 day)

1. **Development friction**
   - [ ] List all common development breakages
   - [ ] Document manual processes that slow development
   - [ ] Identify missing developer tools (HMR, proper error boundaries, etc.)

2. **Code quality issues**
   - [ ] Find instances of duplicated code
   - [ ] Document inconsistent patterns
   - [ ] Identify type safety gaps

3. **Performance bottlenecks**
   - [ ] Measure current bundle sizes
   - [ ] Check for unnecessary re-renders or DOM thrashing
   - [ ] Document any reported performance issues

### Phase 3: Migration Planning (1 day)

1. **Priority ordering**
   - [ ] Rank pages by complexity (simple → complex)
   - [ ] Consider user impact (high traffic → low traffic)
   - [ ] Identify dependencies between pages

2. **Risk assessment**
   - [ ] List features that might be hard to replicate
   - [ ] Identify any custom behaviors tied to DOM structure
   - [ ] Document any third-party integrations

3. **Success metrics**
   - [ ] Define performance targets (bundle size, load time)
   - [ ] Set code quality goals (test coverage, type coverage)
   - [ ] Establish user experience benchmarks

### Phase 4: Endpoint Contract Generation (2 days)

1. **Extract TypeScript types**
   - [ ] Parse `firebase/functions/src/index.ts`
   - [ ] Generate request/response types for each endpoint
   - [ ] Create a contract file that can be shared between frontend and backend

2. **Set up contract validation**
   - [ ] Create build-time validation to ensure contracts match implementation
   - [ ] Set up CI to fail on breaking changes
   - [ ] Document the contract update process

## In-Browser Testing Checklist

After completing analysis:
- [ ] Manually test each user flow in current webapp
- [ ] Document any bugs or issues found
- [ ] Take screenshots of all pages for reference
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Check for console errors or warnings

## Deliverables

1. **`webapp-analysis.md`** - Complete analysis document
2. **`endpoint-contracts.ts`** - Generated TypeScript contracts
3. **`migration-order.md`** - Prioritized list of pages to migrate
4. **`risk-register.md`** - Identified risks and mitigation strategies
5. **User flow diagrams** - Visual representation of key user journeys

## Success Criteria

- [ ] All pages and features documented
- [ ] All API endpoints typed and contracts generated
- [ ] Clear migration order established
- [ ] Development team agrees with analysis findings
- [ ] No critical features missed in analysis

## Timeline

- Start Date: TBD
- End Date: TBD
- Total Duration: ~5 days

## Notes

- Run analysis scripts from the root directory
- Use existing `logger` for any analysis tools created
- Follow "fail fast" principle - surface issues early
- Keep analysis minimal - don't over-document obvious things
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

### Phase 3: API Endpoint Analysis (4 hours)

**Simplified Approach** - Focus on documenting what exists, not generating complex tooling yet.

1. **Extract API endpoints from webapp**
   - [ ] Analyze `webapp/src/js/api.ts` for all API calls
   - [ ] Document each endpoint with:
     - HTTP method
     - URL pattern
     - Request payload shape
     - Response data shape
   - [ ] Create simple TypeScript interfaces for each endpoint

2. **Map to Firebase functions**
   - [ ] Find corresponding handlers in `firebase/functions/src/index.ts`
   - [ ] Note any mismatches between client expectations and server implementation
   - [ ] Identify endpoints missing proper TypeScript types

3. **Create endpoint inventory**
   - [ ] Generate `docs/endpoint-inventory.md` with all findings
   - [ ] Include examples of actual API calls from the webapp
   - [ ] Document any authentication requirements

### Phase 4: Migration Planning (4 hours)

1. **Create migration order document**
   - [ ] Generate `docs/migration-order.md` with prioritized page list
   - [ ] Consider complexity, dependencies, and user impact
   - [ ] Group pages into migration "waves"
   - [ ] Estimate effort for each page

2. **Risk assessment**
   - [ ] Create `docs/risk-register.md` with identified risks
   - [ ] Document mitigation strategies for each risk
   - [ ] Highlight any blockers or unknowns
   - [ ] Flag features that might need redesign

3. **Success metrics**
   - [ ] Define clear acceptance criteria for migration
   - [ ] Set performance benchmarks
   - [ ] Establish quality gates

## In-Browser Testing Checklist

After completing analysis:
- [ ] Manually test each user flow in current webapp
- [ ] Document any bugs or issues found
- [ ] Take screenshots of all pages for reference
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Check for console errors or warnings

## Deliverables

1. **`docs/webapp-analysis.md`** - Complete analysis document (✅ In Progress)
2. **`docs/endpoint-inventory.md`** - API endpoint documentation with types
3. **`docs/migration-order.md`** - Prioritized list of pages to migrate
4. **`docs/risk-register.md`** - Identified risks and mitigation strategies

## Success Criteria

- [ ] All pages and features documented
- [ ] All API endpoints typed and contracts generated
- [ ] Clear migration order established
- [ ] Development team agrees with analysis findings
- [ ] No critical features missed in analysis

## Updated Implementation Plan (2025-07-22)

### Confirmed Current State
- ✅ Webapp confirmed to be vanilla JS/TS with direct DOM manipulation
- ✅ No Preact framework implemented yet  
- ✅ Manual HTML templating and esbuild configuration
- ✅ Task is valid and ready for implementation

### Phase Breakdown for Small Commits
1. **Commit 1**: ✅ User flow documentation and current page screenshots (DONE)
2. **Commit 2**: ✅ Dependencies analysis and build system review (DONE)
3. **Commit 3**: API endpoint inventory and documentation
4. **Commit 4**: Migration order and prioritization
5. **Commit 5**: Risk assessment and success metrics

### Priority Analysis Complete
- **Easiest First**: Landing page → Static pages → Auth flows
- **Most Complex**: Dashboard (dynamic data) → Group detail (real-time features)
- **High Risk**: Three.js globe integration, custom animations

## Timeline

- Start Date: 2025-07-22
- End Date: TBD  
- Total Duration: ~1.5 days (8 hours remaining)
- **Status**: In Progress - Phase 2 Complete

### Progress Update
- ✅ Phase 1: User flows documented (see webapp-analysis.md)
- ✅ Phase 2: Dependencies and build system analyzed
- 🚧 Phase 3: API endpoint contract extraction (NEXT)
- ⏳ Phase 4: Migration planning and risk assessment

## Notes

- Run analysis scripts from the root directory
- Use existing `logger` for any analysis tools created
- Follow "fail fast" principle - surface issues early
- Keep analysis minimal - don't over-document obvious things
- Focus on deliverables that inform migration decisions
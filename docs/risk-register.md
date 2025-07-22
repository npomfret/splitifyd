# Risk Register - Webapp Migration

## Overview

This document identifies and tracks risks associated with migrating from vanilla JS/TS to Preact, along with mitigation strategies and contingency plans.

## Risk Classification

- **Severity**: Critical | High | Medium | Low
- **Likelihood**: Very Likely | Likely | Possible | Unlikely
- **Status**: Active | Mitigated | Closed

## Critical Risks

### 1. API Contract Mismatches
- **Severity**: Critical
- **Likelihood**: Very Likely
- **Status**: Active
- **Description**: Current webapp has no type safety with API calls, leading to runtime errors
- **Evidence**: 
  - Balance endpoints returning 404 errors
  - Dashboard showing "$NaN" for balances
  - No runtime validation of API responses
- **Impact**: Application crashes, data corruption, poor user experience
- **Mitigation**:
  1. Create comprehensive API type definitions
  2. Implement runtime validation for all responses
  3. Add error boundaries to prevent crashes
  4. Create API contract tests
- **Contingency**: Keep legacy API client as fallback

### 2. State Management Complexity
- **Severity**: High
- **Likelihood**: Likely
- **Status**: Active
- **Description**: Current app has state scattered across modules with no central management
- **Impact**: Difficult to maintain consistency, race conditions, stale data
- **Mitigation**:
  1. Start simple - use local component state
  2. Add state management only when needed
  3. Use React Query for server state
  4. Document state flow clearly
- **Contingency**: Implement minimal global state first

### 3. Three.js Globe Performance
- **Severity**: High
- **Likelihood**: Likely
- **Status**: Active
- **Description**: Three.js adds 750KB+ to bundle size and may conflict with Preact
- **Impact**: Slow initial load, poor mobile performance
- **Mitigation**:
  1. Lazy load Three.js only on landing page
  2. Create static fallback for mobile
  3. Consider lighter alternatives
  4. Implement proper cleanup on unmount
- **Contingency**: Remove globe entirely or use CSS animation

## High Risks

### 4. Authentication State Synchronization
- **Severity**: High
- **Likelihood**: Possible
- **Status**: Active
- **Description**: Firebase Auth state must sync between old and new pages
- **Impact**: Users logged out unexpectedly, auth errors
- **Mitigation**:
  1. Share auth token via localStorage
  2. Implement auth state listener
  3. Test auth flow thoroughly
  4. Add session persistence
- **Contingency**: Force re-login on migration

### 5. Browser Compatibility Issues
- **Severity**: Medium
- **Likelihood**: Likely
- **Status**: Active
- **Description**: Preact may have different browser support than vanilla JS
- **Impact**: Features broken in some browsers
- **Mitigation**:
  1. Test in all major browsers early
  2. Use transpilation for older browsers
  3. Implement polyfills as needed
  4. Progressive enhancement approach
- **Contingency**: Show compatibility warning

### 6. Bundle Size Explosion
- **Severity**: High
- **Likelihood**: Possible
- **Status**: Active
- **Description**: Adding framework and dependencies may increase bundle size
- **Current Size**: ~865KB (Three.js + GSAP + app code)
- **Impact**: Slower load times, poor mobile experience
- **Mitigation**:
  1. Use Preact (3KB) instead of React
  2. Tree-shake aggressively
  3. Code split by route
  4. Lazy load heavy dependencies
  5. Set bundle size budgets in CI
- **Contingency**: Remove non-essential features

## Medium Risks

### 7. Migration Fatigue
- **Severity**: Medium
- **Likelihood**: Likely
- **Status**: Active
- **Description**: Long migration timeline may lead to incomplete implementation
- **Impact**: Technical debt, two codebases to maintain
- **Mitigation**:
  1. Set clear milestones
  2. Celebrate small wins
  3. Automate repetitive tasks
  4. Time-box migration phases
- **Contingency**: Accept partial migration

### 8. SEO Impact
- **Severity**: Medium
- **Likelihood**: Possible
- **Status**: Active
- **Description**: SPA may hurt SEO for public pages
- **Impact**: Reduced organic traffic, poor search rankings
- **Mitigation**:
  1. Server-side render public pages
  2. Implement proper meta tags
  3. Use static generation where possible
  4. Add structured data
- **Contingency**: Keep landing pages as static HTML

### 9. Real-time Updates
- **Severity**: Medium
- **Likelihood**: Possible
- **Status**: Active
- **Description**: Current polling mechanism needs replacement
- **Impact**: Delayed updates, inconsistent data
- **Mitigation**:
  1. Implement Firestore listeners
  2. Use optimistic updates
  3. Add conflict resolution
  4. Cache intelligently
- **Contingency**: Keep polling with shorter intervals

### 10. Form Validation Differences
- **Severity**: Low
- **Likelihood**: Very Likely
- **Status**: Active
- **Description**: Current custom validation needs porting to Preact patterns
- **Impact**: Inconsistent validation, poor UX
- **Mitigation**:
  1. Create reusable validation hooks
  2. Port validation rules exactly
  3. Add client-side validation library
  4. Test all edge cases
- **Contingency**: Use HTML5 validation

## Technical Debt Risks

### 11. Legacy Animation Libraries
- **Severity**: Low
- **Likelihood**: Very Likely
- **Status**: Active
- **Description**: GSAP and ScrollReveal may not integrate well with Preact
- **Impact**: Broken animations, visual glitches
- **Mitigation**:
  1. Use Framer Motion or React Spring
  2. Simplify animations
  3. CSS-only where possible
  4. Progressive enhancement
- **Contingency**: Remove complex animations

### 12. Missing Tests
- **Severity**: Medium
- **Likelihood**: Very Likely
- **Status**: Active
- **Description**: Current webapp has minimal test coverage
- **Impact**: Regressions during migration, bugs in production
- **Mitigation**:
  1. Write tests for new Preact components
  2. Add integration tests for critical paths
  3. Implement visual regression tests
  4. Test during migration, not after
- **Contingency**: Manual testing checklist

## Operational Risks

### 13. Deployment Complexity
- **Severity**: Medium
- **Likelihood**: Possible
- **Status**: Active
- **Description**: Running two apps simultaneously complicates deployment
- **Impact**: Deployment failures, routing issues
- **Mitigation**:
  1. Update Firebase hosting rules carefully
  2. Test routing extensively
  3. Implement gradual rollout
  4. Monitor 404 errors
- **Contingency**: Quick rollback procedure

### 14. User Communication
- **Severity**: Low
- **Likelihood**: Likely
- **Status**: Active
- **Description**: Users confused by gradual changes
- **Impact**: Support tickets, user frustration
- **Mitigation**:
  1. Add "beta" badge to new pages
  2. Provide feedback mechanism
  3. Communicate improvements
  4. Keep UI consistent
- **Contingency**: Faster migration

## Risk Matrix

| Risk | Severity | Likelihood | Risk Score | Priority |
|------|----------|------------|------------|----------|
| API Contract Mismatches | Critical | Very Likely | 25 | 1 |
| Three.js Performance | High | Likely | 16 | 2 |
| State Management | High | Likely | 16 | 3 |
| Bundle Size | High | Possible | 12 | 4 |
| Auth Sync | High | Possible | 12 | 5 |
| Browser Compatibility | Medium | Likely | 9 | 6 |
| Missing Tests | Medium | Very Likely | 9 | 7 |
| Migration Fatigue | Medium | Likely | 9 | 8 |
| Deployment | Medium | Possible | 6 | 9 |
| Other risks | Low-Medium | Various | <6 | 10+ |

## Monitoring Plan

1. **Weekly Risk Review**: Assess all active risks
2. **Metrics to Track**:
   - Bundle size trends
   - Error rates (Sentry)
   - Page load times
   - User feedback
   - Test coverage
3. **Escalation Triggers**:
   - Bundle size > 200KB
   - Error rate > 1%
   - Load time > 3 seconds
   - Critical bug in production

## Success Indicators

- ✅ No increase in error rates
- ✅ Page load times improved
- ✅ Bundle size under control
- ✅ All tests passing
- ✅ Positive user feedback
- ✅ Development velocity increased

---

*Last Updated: 2025-07-22*
*Next Review: Before starting Wave 1*
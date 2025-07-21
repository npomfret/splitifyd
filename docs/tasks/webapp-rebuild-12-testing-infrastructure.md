# Webapp Rebuild Task 12: Set Up Comprehensive Testing Infrastructure

## Overview
Establish a robust testing framework for the new Preact webapp with unit tests, integration tests, and end-to-end testing to ensure reliability and prevent regressions.

## Prerequisites
- [ ] Complete webapp-rebuild-11-static-pages.md
- [ ] Most core pages migrated to Preact
- [ ] API endpoints and contracts established

## Current State
- Minimal testing in existing webapp
- No automated test suite
- Manual testing only
- No CI/CD test integration

## Target State
- Comprehensive test coverage
- Automated test execution
- CI/CD integration with test gates
- Performance and accessibility testing
- Visual regression testing

## Implementation Steps

### Phase 1: Unit Testing Setup (2 hours)

1. **Testing framework configuration**
   ```json
   {
     "devDependencies": {
       "@testing-library/preact": "^3.x",
       "@testing-library/jest-dom": "^5.x",
       "@testing-library/user-event": "^14.x",
       "jest": "^29.x",
       "jest-environment-jsdom": "^29.x",
       "vitest": "^0.34.x"
     }
   }
   ```

2. **Test configuration files**
   - [ ] `vitest.config.ts` for test runner
   - [ ] `jest.setup.ts` for test utilities
   - [ ] Test environment configuration
   - [ ] Mock configurations
   - [ ] Coverage settings

3. **Testing utilities** (`src/test-utils/`)
   ```
   test-utils/
   ├── render.tsx          # Custom render with providers
   ├── mocks.ts           # Common mocks and fixtures
   ├── builders.ts        # Test data builders
   ├── api-mocks.ts       # API response mocks
   └── test-helpers.ts    # Reusable test helpers
   ```

### Phase 2: Component Unit Tests (3 hours)

1. **Core component tests**
   - [ ] Authentication components
   - [ ] Group management components
   - [ ] Expense form components
   - [ ] Balance calculation components
   - [ ] UI utility components

2. **Test patterns to implement**
   ```typescript
   // Example test structure
   describe('GroupCard', () => {
     it('displays group information correctly', () => {
       // Test implementation
     });
     
     it('handles click events', () => {
       // Test implementation
     });
     
     it('shows loading state appropriately', () => {
       // Test implementation
     });
   });
   ```

3. **Testing focus areas**
   - [ ] Component rendering
   - [ ] User interactions
   - [ ] State changes
   - [ ] Error boundaries
   - [ ] Loading states

### Phase 3: Integration Testing (2 hours)

1. **API integration tests**
   - [ ] Auth flow integration
   - [ ] Group CRUD operations
   - [ ] Expense management
   - [ ] Real-time data sync
   - [ ] Error handling

2. **Store integration tests**
   - [ ] Zustand store behaviors
   - [ ] Firebase/Firestore integration
   - [ ] Cross-store interactions
   - [ ] Optimistic updates
   - [ ] Cache management

3. **Route integration tests**
   - [ ] Page navigation
   - [ ] Route guards
   - [ ] Deep linking
   - [ ] URL parameter handling
   - [ ] Redirect flows

### Phase 4: End-to-End Testing (3 hours)

1. **E2E testing setup**
   ```json
   {
     "devDependencies": {
       "@playwright/test": "^1.x",
       "playwright": "^1.x"
     }
   }
   ```

2. **Critical user journeys**
   - [ ] User registration and login
   - [ ] Create group and invite members
   - [ ] Add and split expenses
   - [ ] View balances and settle debts
   - [ ] Mobile user flows

3. **E2E test structure** (`e2e/`)
   ```
   e2e/
   ├── fixtures/          # Test data fixtures
   ├── pages/             # Page object models
   ├── tests/
   │   ├── auth.spec.ts
   │   ├── groups.spec.ts
   │   ├── expenses.spec.ts
   │   └── mobile.spec.ts
   └── playwright.config.ts
   ```

### Phase 5: Advanced Testing (2 hours)

1. **Performance testing**
   - [ ] Bundle size monitoring
   - [ ] Load time testing
   - [ ] Memory usage testing
   - [ ] Performance regression detection
   - [ ] Core Web Vitals monitoring

2. **Accessibility testing**
   - [ ] `@axe-core/playwright` integration
   - [ ] Keyboard navigation tests
   - [ ] Screen reader compatibility
   - [ ] Color contrast validation
   - [ ] ARIA compliance

3. **Visual regression testing**
   - [ ] Screenshot comparison
   - [ ] Cross-browser visual testing
   - [ ] Mobile viewport testing
   - [ ] Component visual tests
   - [ ] Percy or similar integration

### Phase 6: CI/CD Integration (1 hour)

1. **GitHub Actions workflow** (`.github/workflows/test.yml`)
   ```yaml
   name: Test Suite
   on: [push, pull_request]
   jobs:
     unit-tests:
       # Unit and integration tests
     e2e-tests:
       # End-to-end tests
     performance:
       # Performance testing
   ```

2. **Test gates and quality checks**
   - [ ] Minimum coverage requirements
   - [ ] Performance budgets
   - [ ] Accessibility score minimums
   - [ ] Bundle size limits
   - [ ] Test execution time limits

## Testing Checklist by Feature

### Authentication Tests
- [ ] User registration flow
- [ ] Login with valid/invalid credentials
- [ ] Password reset functionality
- [ ] Session persistence
- [ ] Logout behavior

### Group Management Tests
- [ ] Group creation and listing
- [ ] Member invitation and management
- [ ] Group settings updates
- [ ] Real-time group updates
- [ ] Group deletion flow

### Expense Management Tests
- [ ] Add expense with different split types
- [ ] Edit and delete expenses
- [ ] Balance calculations accuracy
- [ ] Real-time expense updates
- [ ] Receipt upload/management

### Mobile-Specific Tests
- [ ] Touch interactions
- [ ] Responsive layout
- [ ] Mobile navigation
- [ ] Camera integration
- [ ] Offline capabilities

### Error Scenarios
- [ ] Network failures
- [ ] Invalid data handling
- [ ] Permission errors
- [ ] Rate limiting
- [ ] Concurrent user actions

## Test Coverage Goals

1. **Unit tests**: 80%+ line coverage
2. **Integration tests**: All API endpoints
3. **E2E tests**: All critical user journeys
4. **Performance**: All pages under budget
5. **Accessibility**: WCAG 2.1 AA compliance

## In-Browser Testing Verification

### Test Execution
1. **Local development**
   - [ ] `npm run test` executes all unit tests
   - [ ] `npm run test:integration` runs integration tests
   - [ ] `npm run test:e2e` runs Playwright tests
   - [ ] Coverage reports generated

2. **CI/CD pipeline**
   - [ ] Tests run on all PRs
   - [ ] Performance tests pass
   - [ ] Accessibility tests pass
   - [ ] Visual regression tests pass

### Test Quality
1. **Unit tests**
   - [ ] Fast execution (< 30 seconds)
   - [ ] Reliable (no flaky tests)
   - [ ] Meaningful assertions
   - [ ] Good test isolation

2. **E2E tests**
   - [ ] Cover happy paths
   - [ ] Test error scenarios
   - [ ] Mobile-specific flows
   - [ ] Cross-browser compatibility

## Deliverables

1. **Complete testing framework setup**
2. **Unit tests for all components**
3. **Integration tests for core flows**
4. **E2E test suite**
5. **CI/CD test automation**

## Success Criteria

- [ ] 80%+ test coverage achieved
- [ ] All critical user journeys tested
- [ ] CI/CD pipeline with test gates
- [ ] Performance budgets enforced
- [ ] Accessibility standards met
- [ ] Visual regression protection

## Testing Best Practices

1. **Test pyramid approach**
   - Many unit tests (fast, isolated)
   - Some integration tests (realistic)
   - Few E2E tests (comprehensive)

2. **Builder pattern for test data**
   - Use builders instead of fixtures
   - Focus on what's being tested
   - Avoid test data coupling

3. **Page Object Model for E2E**
   - Encapsulate page interactions
   - Reusable page methods
   - Maintainable test code

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~13 hours

## Notes

- Testing is critical for migration confidence
- Start with most critical paths
- Expand coverage incrementally
- Monitor test execution time
- Consider parallel test execution
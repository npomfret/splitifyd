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

## Implementation Plan - Detailed Breakdown

### Phase 1: Current State Analysis (1 hour)
**Objective**: Understand existing testing setup and identify specific gaps

**Implementation Steps**:
1. **Audit current test files**:
   - Check for existing test files in `webapp-v2/` and `firebase/functions/`
   - Review current testing dependencies in package.json files
   - Identify any existing test configurations

2. **Analyze test coverage gaps**:
   ```bash
   # Search for existing tests
   find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules
   # Check testing dependencies
   grep -r "test\|jest\|vitest\|playwright" package.json
   ```

3. **Document findings**:
   - Current testing frameworks (if any)
   - Missing test categories (unit/integration/e2e)
   - Component test coverage gaps
   - Store/API test coverage gaps

### Phase 2: Testing Framework Setup (2 hours)
**Objective**: Install and configure comprehensive testing stack

**Implementation Steps**:
1. **Install testing dependencies** in `webapp-v2/`:
   ```bash
   npm install --save-dev vitest @vitest/ui jsdom
   npm install --save-dev @testing-library/preact @testing-library/jest-dom @testing-library/user-event
   npm install --save-dev @playwright/test
   ```

2. **Create configuration files**:
   - `vitest.config.ts` - Vitest configuration with JSdom environment
   - `playwright.config.ts` - Playwright configuration for e2e tests
   - `src/test-utils/setup.ts` - Global test setup

3. **Update package.json scripts**:
   ```json
   {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage",
     "test:e2e": "playwright test"
   }
   ```

### Phase 3: Test Utilities & Helpers (1 hour)  
**Objective**: Create reusable testing infrastructure

**Implementation Steps**:
1. **Create test utilities** (`src/test-utils/`):
   - `render.tsx` - Custom render with providers (auth, routing)
   - `mocks.ts` - API mocks and data fixtures
   - `builders.ts` - Test data builders for groups, expenses, users
   - `api-mocks.ts` - MSW handlers for API endpoints

2. **Mock Firebase dependencies**:
   - Mock Firebase Auth for authentication tests
   - Mock Firestore for data layer tests
   - Create test environment variables

### Phase 4: Component Unit Tests (3 hours)
**Objective**: Test core UI components in isolation

**Implementation Steps**:
1. **Authentication component tests**:
   - LoginPage.tsx - Form validation, submission, error handling
   - RegisterPage.tsx - Registration flow, validation
   - Auth-related hooks and stores

2. **Group management component tests**:
   - GroupCard.tsx - Display, interactions, loading states
   - GroupDetailPage.tsx - Data display, error handling
   - MembersList.tsx - Member display, role indicators

3. **Expense component tests**:
   - AddExpensePage.tsx - Form validation, split calculations
   - ExpenseItem.tsx - Display formatting, click handlers
   - Split calculation utilities

### Phase 5: Store Integration Tests (2 hours)
**Objective**: Test store logic and API integration

**Implementation Steps**:
1. **Auth store tests**:
   - Login/logout flows
   - Token management
   - Error handling

2. **Groups store tests**:
   - Group fetching and caching
   - Real-time updates simulation
   - Error state management

3. **Expense form store tests**:
   - Split calculations accuracy
   - Form validation logic
   - Save/draft functionality

### Phase 6: API Integration Tests (2 hours)
**Objective**: Test API client and backend integration

**Implementation Steps**:
1. **API client tests**:
   - Request/response handling
   - Authentication headers
   - Error response handling
   - Retry logic

2. **End-to-end API flow tests**:
   - User registration → Login → Group creation → Expense creation
   - Group joining flow
   - Balance calculation verification

### Phase 7: E2E Critical Path Tests (2 hours)
**Objective**: Test complete user journeys

**Implementation Steps**:
1. **Core user journey tests** (`e2e/tests/`):
   ```typescript
   // auth.spec.ts - Registration and login
   // groups.spec.ts - Group creation and management  
   // expenses.spec.ts - Add expense and splits
   // mobile.spec.ts - Mobile-specific interactions
   ```

2. **Page object models** (`e2e/pages/`):
   - Reusable page interaction methods
   - Consistent selectors and actions
   - Error handling helpers

3. **Test data management**:
   - Fixture data for predictable tests
   - Database setup/teardown helpers
   - User account management

## Commit Strategy

**Commit 1**: Framework setup and configuration (3 hours)
- Install all testing dependencies
- Configure Vitest and Playwright
- Create basic test utilities
- Add npm scripts

**Commit 2**: Component unit tests (3 hours) 
- Test core components (auth, groups, expenses)
- Test utility functions
- Achieve 80%+ component coverage

**Commit 3**: Store and API integration tests (2 hours)
- Test all stores and their methods
- Test API client functionality
- Mock external dependencies

**Commit 4**: E2E tests and critical paths (2 hours)
- Implement Playwright tests for key user journeys
- Page object models
- Test data fixtures

**Commit 5**: CI/CD integration and polish (1 hour)
- GitHub Actions workflow
- Coverage reporting
- Quality gates
- Documentation

## Success Metrics

**Unit Tests**:
- 80%+ line coverage on components
- All stores tested with edge cases
- All utility functions tested

**Integration Tests**:
- All API endpoints tested
- All store-to-API interactions tested
- Auth flow fully tested

**E2E Tests**:
- Core user journeys (registration → group → expense)
- Mobile-specific interactions
- Error scenario handling

**CI/CD**:
- Tests run on all PRs
- Coverage reports generated
- Quality gates prevent broken builds

## Timeline

- Start Date: TBD  
- End Date: TBD
- Duration: ~13 hours (detailed breakdown above)

## Risk Mitigation

1. **Existing code conflicts**:
   - Analyze current setup thoroughly first
   - Incremental implementation to avoid breaking changes
   - Maintain compatibility with existing build process

2. **Firebase emulator dependencies**:
   - Mock Firebase services for unit tests
   - Use emulator for integration tests only
   - Clear setup/teardown procedures

3. **Test maintenance burden**:
   - Focus on high-value tests first
   - Use builder pattern to reduce test complexity
   - Regular test cleanup and refactoring

## Notes

- Testing is critical for migration confidence
- Start with most critical paths
- Expand coverage incrementally
- Monitor test execution time
- Consider parallel test execution
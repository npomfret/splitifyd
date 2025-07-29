# Webapp v2 Real Emulator Testing Infrastructure

## Problem Statement
The webapp-v2 keeps breaking due to insufficient real integration testing. Current tests use mocks and the Vite dev server instead of testing against the Firebase emulator. We need comprehensive tests that catch real-world issues.

## Current Issues
1. Playwright tests use Vite dev server instead of Firebase emulator
2. Only one real integration test exists (api-client.integration.test.ts)
3. MCP browser tests exist but aren't integrated
4. App breaks repeatedly - tests aren't catching real issues
5. No fast non-browser tests that validate server responses

## Implementation Plan - Small Commits

### Commit 1: Create emulator utilities helper
**Goal**: Create shared utilities for reading Firebase emulator ports

#### Files
- Create `webapp-v2/e2e/helpers/emulator-utils.ts`
- Create `webapp-v2/e2e/helpers/index.ts` (barrel export)

#### Implementation
```typescript
// emulator-utils.ts
import { readFileSync } from 'fs';
import { join } from 'path';

// Get ports from firebase.json
const firebaseConfigPath = join(process.cwd(), '..', 'firebase', 'firebase.json');
const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf-8'));

export const HOSTING_PORT = firebaseConfig.emulators?.hosting?.port || 6002;
export const FUNCTIONS_PORT = firebaseConfig.emulators?.functions?.port || 6001;
export const EMULATOR_URL = `http://localhost:${HOSTING_PORT}`;
export const V2_URL = `${EMULATOR_URL}/v2`;
export const API_URL = `http://localhost:${FUNCTIONS_PORT}`;
```

### Commit 2: Update Playwright config to use emulator
**Goal**: Point Playwright to Firebase emulator instead of Vite

#### Files
- Update `webapp-v2/playwright.config.ts`

#### Changes
- Import emulator utils
- Change baseURL to use EMULATOR_URL
- Remove webServer config
- Update output directories to ../tmp/

### Commit 3: Add Playwright wait helpers
**Goal**: Add helpers for common wait conditions with emulator

#### Files
- Update `webapp-v2/e2e/helpers/emulator-utils.ts`

#### Add functions
```typescript
export async function waitForEmulator(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function waitForV2App(page: Page) {
  await page.waitForSelector('text=v2 app', { timeout: 10000 });
}

export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
```

### Commit 4: Fix navigation e2e test for emulator
**Goal**: Update first e2e test to work with emulator

#### Files
- Update `webapp-v2/e2e/navigation.e2e.test.ts`

#### Changes
- Import emulator helpers
- Update selectors for server-rendered HTML
- Add wait conditions
- Check for console errors

### Commit 5: Fix pricing e2e test for emulator
**Goal**: Update pricing test to work with emulator

#### Files
- Update `webapp-v2/e2e/pricing.e2e.test.ts`

### Commit 6: Fix SEO e2e test for emulator
**Goal**: Update SEO test to work with emulator

#### Files
- Update `webapp-v2/e2e/seo.e2e.test.ts`

### Commit 7: Fix accessibility test for emulator
**Goal**: Update accessibility test to work with emulator

#### Files
- Update `webapp-v2/e2e/accessibility.test.ts`

### Commit 8: Fix performance test for emulator
**Goal**: Update performance test to work with emulator

#### Files
- Update `webapp-v2/e2e/performance.test.ts`

### Commit 9: Create API integration test structure
**Goal**: Set up directory structure for API tests

#### Files
- Create `webapp-v2/src/__tests__/api-integration/`
- Create `webapp-v2/src/__tests__/api-integration/utils/`
- Create `webapp-v2/src/__tests__/api-integration/utils/http-client.ts`
- Create `webapp-v2/src/__tests__/api-integration/utils/emulator-config.ts`

### Commit 10: Add HTTP client for API tests
**Goal**: Simple fetch wrapper for API integration tests

#### Files
- Update `webapp-v2/src/__tests__/api-integration/utils/http-client.ts`

#### Implementation
```typescript
export class ApiClient {
  constructor(private baseUrl: string) {}
  
  async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
}
```

### Commit 11: Add auth flow API integration test
**Goal**: Test login/register via real API calls

#### Files
- Create `webapp-v2/src/__tests__/api-integration/auth-flows.test.ts`

### Commit 12: Add groups CRUD API integration test
**Goal**: Test group operations via real API calls

#### Files
- Create `webapp-v2/src/__tests__/api-integration/groups-crud.test.ts`

### Commit 13: Add expenses CRUD API integration test
**Goal**: Test expense operations via real API calls

#### Files
- Create `webapp-v2/src/__tests__/api-integration/expenses-crud.test.ts`

### Commit 14: Add polling helpers for async operations
**Goal**: Helper functions for waiting on async operations

#### Files
- Create `webapp-v2/src/__tests__/api-integration/utils/polling-helpers.ts`

### Commit 15: Add test data cleanup utilities
**Goal**: Clean up test data after tests

#### Files
- Create `webapp-v2/src/__tests__/api-integration/utils/test-data-cleanup.ts`

### Commit 16: Update package.json with API test script
**Goal**: Add npm script for API integration tests

#### Files
- Update `webapp-v2/package.json`

#### Add script
```json
"test:api-integration": "vitest src/__tests__/api-integration/ --runInBand"
```

### Commit 17: Create browser integration test structure
**Goal**: Set up Playwright within Vitest

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/`
- Create `webapp-v2/src/__tests__/browser-integration/helpers/`
- Create `webapp-v2/src/__tests__/browser-integration/helpers/browser-test-utils.ts`

### Commit 18: Add console error checker for browser tests
**Goal**: Utility to fail tests on console errors

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/helpers/ConsoleErrorChecker.ts`

### Commit 19: Add auth UI flow browser test
**Goal**: Test login/register UI with real backend

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/auth-ui-flow.test.ts`

### Commit 20: Add dashboard display browser test
**Goal**: Test dashboard renders with real data

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/dashboard-display.test.ts`

### Commit 21: Add group interactions browser test
**Goal**: Test creating/joining groups in UI

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/group-interactions.test.ts`

### Commit 22: Add expense form browser test
**Goal**: Test expense creation UI

#### Files
- Create `webapp-v2/src/__tests__/browser-integration/expense-form.test.ts`

### Commit 23: Update package.json with browser test script
**Goal**: Add npm script for browser integration tests

#### Files
- Update `webapp-v2/package.json`

#### Add script
```json
"test:browser": "vitest src/__tests__/browser-integration/ --runInBand"
```

### Commit 24: Move MCP test utilities
**Goal**: Copy MCP utilities into main test infrastructure

#### Files
- Copy `mcp-browser-tests/lib/*` → `webapp-v2/src/__tests__/mcp/lib/`
- Update imports and types

### Commit 25: Create MCP test runner integration
**Goal**: Integrate MCP tests with npm scripts

#### Files
- Create `webapp-v2/src/__tests__/mcp/run-tests.ts`

### Commit 26: Add MCP login flow test
**Goal**: MCP test for full login with screenshots

#### Files
- Create `webapp-v2/src/__tests__/mcp/login-flow.mcp.ts`

### Commit 27: Add MCP console health test
**Goal**: Check all pages for console errors

#### Files
- Create `webapp-v2/src/__tests__/mcp/console-health.mcp.ts`

### Commit 28: Update package.json with MCP test script
**Goal**: Add npm script for MCP tests

#### Files
- Update `webapp-v2/package.json`

#### Add script
```json
"test:mcp": "tsx src/__tests__/mcp/run-tests.ts"
```

### Commit 29: Create test orchestration scripts
**Goal**: Add comprehensive test suite scripts

#### Files
- Update `webapp-v2/package.json`

#### Add scripts
```json
"test:all": "npm run test:unit && npm run test:integration && npm run test:api-integration && npm run test:e2e",
"test:ci": "npm run test:all -- --reporter=json --outputFile=../tmp/test-results.json"
```

### Commit 30: Create comprehensive testing documentation
**Goal**: Document all test types and usage

#### Files
- Create `webapp-v2/TESTING.md`

### Commit 31: Add health check test structure
**Goal**: Create structure for continuous monitoring tests

#### Files
- Create `webapp-v2/src/__tests__/health/`
- Create `webapp-v2/src/__tests__/health/fixtures/`

### Commit 32: Add all pages load health test
**Goal**: Verify every route loads without errors

#### Files
- Create `webapp-v2/src/__tests__/health/all-pages-load.test.ts`

### Commit 33: Add API health test
**Goal**: Verify all endpoints respond

#### Files
- Create `webapp-v2/src/__tests__/health/api-health.test.ts`

### Commit 34: Add performance health test
**Goal**: Check load times meet targets

#### Files
- Create `webapp-v2/src/__tests__/health/performance.test.ts`

### Commit 35: Add test fixtures and cleanup
**Goal**: Standard test data and cleanup utilities

#### Files
- Create `webapp-v2/src/__tests__/health/fixtures/test-users.json`
- Create `webapp-v2/src/__tests__/health/fixtures/cleanup.ts`


## Success Criteria

### Technical Requirements
- ✅ All tests run against Firebase emulator (ports from firebase.json)
- ✅ Zero false positives - tests only fail for real issues
- ✅ Fast feedback - API tests < 30s, browser tests < 2min
- ✅ Screenshots on failures for debugging
- ✅ Console error detection on all pages
- ✅ Network request validation

### Coverage Requirements
- ✅ All authentication flows tested
- ✅ Group CRUD operations verified
- ✅ Expense creation and calculations validated
- ✅ Real-time updates tested
- ✅ Error scenarios handled
- ✅ Mobile viewport testing

### Integration Requirements
- ✅ Tests integrated into CI/CD pipeline
- ✅ Automated test reports generated
- ✅ Test failures block deployment
- ✅ Performance budgets enforced

## Implementation Timeline

**Commits 1-8**: Fix existing Playwright tests (~2 hours)
- Create emulator utilities
- Update Playwright config
- Fix all existing e2e tests to use emulator

**Commits 9-16**: API integration tests (~2 hours)
- Set up test structure
- Create HTTP client
- Implement auth, groups, expenses tests
- Add polling and cleanup utilities

**Commits 17-23**: Browser integration tests (~2 hours)
- Set up Playwright in Vitest
- Create browser test utilities
- Implement UI flow tests

**Commits 24-28**: MCP integration (~1 hour)
- Move MCP utilities
- Create test runner
- Implement key MCP tests

**Commits 29-30**: Test orchestration (~30 min)
- Add npm scripts
- Create documentation

**Commits 31-35**: Health monitoring tests (~1 hour)
- Create health test structure
- Implement monitoring tests
- Add fixtures

**Total**: ~8.5 hours across 35 focused commits

## Risk Mitigation

### Flaky Tests
- Use proper wait conditions
- Implement retry logic
- Clear test isolation

### Performance Impact
- Run tests in parallel where possible
- Use test data builders
- Efficient cleanup

### Maintenance Burden
- Clear test organization
- Reusable utilities
- Good documentation

## Next Steps

1. Start with Phase 1 - fix Playwright configuration
2. Run existing tests to establish baseline
3. Incrementally add new test types
4. Monitor test execution times
5. Refine based on findings

## Notes

- Emulator must be running for all integration tests
- Use `npm run dev` to start emulator before testing
- Check `firebase-debug.log` for emulator issues
- All tests should clean up their data
- **IMPORTANT**: Never hardcode ports - always read from firebase.json
- Use `npm run get-webapp-url` to get the current webapp URL
- Ports may vary between environments (dev, staging, CI)
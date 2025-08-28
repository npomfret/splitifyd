# Task: Migrate firebase/functions from Jest to Vitest

## Problem Statement

The recent implementation of "no-compile development mode" has created compatibility issues with Jest:

1. **Build Complexity**: Jest requires CommonJS modules but our development mode creates ESM/tsx wrappers
2. **Workaround Overhead**: Current solution requires rebuilding `@splitifyd/shared` with `NODE_ENV=test` before every test run
3. **Performance Impact**: ~8 seconds of build overhead added to every test run
4. **Maintenance Burden**: Special handling in test scripts makes the setup fragile

## Current State Analysis

### Test Framework Distribution
- `firebase/functions`: Jest with ts-jest (339 tests)
- `webapp-v2`: Vitest + Playwright (173 tests)  
- `e2e-tests`: Playwright with minimal Jest

### Performance Metrics
- **Jest (firebase/functions)**: 
  - Total time: ~13.7 seconds
  - Build time: ~8 seconds
  - Test execution: ~5 seconds
  
- **Vitest (webapp-v2)**:
  - Total time: ~6 seconds
  - No build step required
  - Direct TypeScript execution

### Current Workaround
```json
// firebase/functions/package.json
"test:unit": "NODE_ENV=test npm run build:shared && NODE_ENV=test npm run build && jest src/__tests__/unit/",
"build:shared": "cd ../../packages/shared && NODE_ENV=test npm run build"
```

## Why Vitest?

### Advantages
1. **Native TypeScript Support**: No compilation step needed
2. **ESM First**: Compatible with modern module systems and tsx wrappers
3. **Jest Compatible API**: Minimal code changes required
4. **Better Performance**: ~50% faster due to no build overhead
5. **Vite Integration**: Consistent with webapp-v2's tooling
6. **Development Mode Compatible**: Works with tsx wrapper files

### Comparison Table

| Feature | Jest (Current) | Vitest (Proposed) |
|---------|---------------|-------------------|
| TypeScript Support | Requires ts-jest + compilation | Native, no compilation |
| Module System | CommonJS | ESM native |
| Build Required | Yes (8s overhead) | No |
| tsx Wrapper Compatible | No | Yes |
| API Compatibility | - | ~95% Jest compatible |
| Configuration Complexity | High | Low |
| Watch Mode Speed | Slow (rebuilds) | Fast (HMR) |

## Migration Plan

### Phase 1: Setup (30 mins)

#### 1.1 Install Dependencies
```bash
cd firebase/functions
npm install --save-dev vitest @vitest/ui c8
npm uninstall jest ts-jest @types/jest @jest/globals
```

#### 1.2 Create vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'lib', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'lib/',
        'scripts/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/index.ts', // Entry point
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### 1.3 Create vitest.setup.ts
```typescript
import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

beforeAll(() => {
  // Global test setup
  process.env.FUNCTIONS_EMULATOR = 'true';
  process.env.GCLOUD_PROJECT = 'splitifyd';
});

afterAll(() => {
  // Global cleanup
});
```

### Phase 2: Update Package.json Scripts (15 mins)

#### 2.1 Remove Build Dependencies from Test Scripts
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run src/__tests__/unit/",
    "test:integration": "FUNCTIONS_EMULATOR=true GCLOUD_PROJECT=splitifyd vitest run src/__tests__/integration/ --reporter=json --outputFile=test-integration-results.json",
    "test:watch": "vitest watch src/__tests__/unit/",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### 2.2 Remove Jest Configuration
- Delete jest configuration from package.json
- Delete jest.setup.js
- Delete tsconfig.test.json (if only used for Jest)

### Phase 3: Code Migration (1-2 hours)

#### 3.1 Update Import Statements
```typescript
// Before (Jest)
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// After (Vitest)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

#### 3.2 Update Mock Syntax
```typescript
// Before (Jest)
jest.mock('./module');
jest.spyOn(object, 'method');
jest.fn();

// After (Vitest)
vi.mock('./module');
vi.spyOn(object, 'method');
vi.fn();
```

#### 3.3 Common Replacements
- `jest.mock()` → `vi.mock()`
- `jest.fn()` → `vi.fn()`
- `jest.spyOn()` → `vi.spyOn()`
- `jest.clearAllMocks()` → `vi.clearAllMocks()`
- `jest.resetAllMocks()` → `vi.resetAllMocks()`
- `jest.useFakeTimers()` → `vi.useFakeTimers()`
- `jest.useRealTimers()` → `vi.useRealTimers()`

#### 3.4 Files to Update (Automated Script)
```bash
# Find all test files that need updates
find src/__tests__ -name "*.test.ts" -exec grep -l "@jest/globals\|jest\." {} \;
```

### Phase 4: Testing & Validation (1 hour)

#### 4.1 Initial Test Run
```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Run in watch mode for development
npm run test:watch
```

#### 4.2 Performance Comparison
- Document before/after test execution times
- Verify coverage metrics remain consistent
- Test watch mode responsiveness

#### 4.3 Integration Test
```bash
# Clean install test
npm run super-clean
npm install
npm run test:unit  # Should work without build step
```

### Phase 5: Documentation Updates (30 mins)

#### 5.1 Update Testing Guide
- Update `docs/guides/testing.md`
- Document Vitest commands and patterns
- Add migration notes for future reference

#### 5.2 Update Build Guide
- Update `docs/guides/building-and-testing.md`
- Remove Jest-specific build requirements
- Document simplified test workflow

## Risk Assessment

### Low Risk
- API compatibility (95% of Jest API works in Vitest)
- Performance improvements guaranteed
- Already proven in webapp-v2

### Medium Risk
- Custom Jest matchers may need rewrites
- Some edge case test behaviors might differ
- Team learning curve (mitigated by similarity to Jest)

### Mitigation Strategies
1. Run both Jest and Vitest in parallel initially
2. Migrate test files incrementally if needed
3. Keep detailed migration log for rollback

## Success Metrics

1. **Build Time Reduction**: Eliminate 8-second build overhead
2. **Test Speed**: Target 50% reduction in total test time
3. **Configuration Simplification**: Remove `build:shared` workaround
4. **Developer Experience**: Faster watch mode, better error messages
5. **Compatibility**: All 339 tests passing without modification

## Timeline Estimate

- **Total Time**: 3-4 hours
- **Phase 1 (Setup)**: 30 minutes
- **Phase 2 (Scripts)**: 15 minutes  
- **Phase 3 (Migration)**: 1-2 hours
- **Phase 4 (Testing)**: 1 hour
- **Phase 5 (Docs)**: 30 minutes

## Decision Points

### Proceed with Migration If:
- Build complexity continues to cause issues
- Team values faster test execution
- Consistency with webapp-v2 is desired

### Delay/Cancel If:
- Jest-specific features are heavily used
- Team prefers stability over improvements
- Other priorities take precedence

## Alternative Solutions Considered

1. **Fix Jest Configuration**: Continue patching workarounds
   - Pro: No migration needed
   - Con: Maintains complexity, slower tests

2. **Custom Build Pipeline**: Create sophisticated pre-test build
   - Pro: Keeps Jest
   - Con: Even more complexity

3. **Different Test Runner**: (Mocha, Ava, etc.)
   - Pro: Fresh start
   - Con: Less compatibility, more migration work

## Recommendation

**Strongly recommend proceeding with Vitest migration** based on:
1. Eliminates current build issues permanently
2. Improves developer experience significantly
3. Aligns with modern JavaScript tooling trends
4. Minimal migration effort due to API compatibility
5. Already successful in webapp-v2

## Next Steps

1. Review this plan with the team
2. Get approval for 4-hour migration window
3. Create feature branch: `feature/migrate-jest-to-vitest`
4. Execute migration plan
5. Run full test suite validation
6. Update CI/CD if needed
7. Merge and monitor for issues

---

*Created: 2025-08-28*
*Status: Pending Approval*
*Owner: TBD*
*Priority: High (due to ongoing build issues)*
# Building and Testing

This guide provides an overview of the build and test processes for this monorepo.

## Philosophy

Our testing philosophy is guided by the following principles:

- **Two Test Types**: We primarily use two types of tests:
    - **Unit Tests**: These are fine-grained tests that verify small, isolated pieces of code. They do not require any external services.
    - **Integration Tests**: These are coarse-grained tests that verify the interaction between different parts of the system. They either require the Firebase emulator to be running, or they use playwright and a browser.
- **Reliability**: Tests must be reliable. Flaky tests are not allowed.
- **Speed**: Fast tests are good, but we prioritize _correctness_ and readability over speed.
- **Isolation**: Tests must be self-contained and should not depend on the state of other tests.

## Build Process

### No-Compile Development Mode

**Important**: This project uses a no-compile development mode for faster startup times. Instead of compiling TypeScript to JavaScript during development, we use `tsx` to run TypeScript files directly.

#### How It Works

The build system uses conditional logic based on the `BUILD_MODE` environment variable:

- **Development** (`BUILD_MODE` unset or `development`): Creates lightweight wrapper files that use `tsx` to execute TypeScript directly. No compilation occurs, resulting in instant startup.
- **Testing** (`BUILD_MODE=test`): Our test harness sets this automatically before kicking off package builds so integration tests run against the compiled output when they need it.
- **Production** (`BUILD_MODE=production`): Full TypeScript compilation for optimized deployment. In this mode the Firebase Functions build emits compiled JavaScript rather than the tsx wrapper.

#### Impact on Development

- `npm run dev`: Starts instantly without compilation
- `npm run test`: Runs tests directly on TypeScript files (no build required)
- `npm run build`: Creates development wrappers (unless `BUILD_MODE` is set to `production` or `test`)
- `BUILD_MODE=production npm run build`: Full production compilation

### Traditional Build Process

Before any tests are run, the entire project must "compile". We use TypeScript's `tsc` compiler with the `--noEmit` flag to perform type-checking without generating JavaScript files. This ensures that all code, including test files, adheres to our type-safety standards.

The root `package.json` provides scripts to build all sub-projects. Run these from the monorepo root directory:

```bash
# From the monorepo root directory
npm run build                      # Builds all workspaces in development mode
BUILD_MODE=production npm run build  # Builds all workspaces for production
```

## Test Directory Structure

This project follows the convention of **co-locating tests with the source code**. All tests are located in a `__tests__` directory within the `src` directory of the project they belong to. Inside the `__tests__` directory, tests are further organized into `unit` and `integration` subdirectories.

This approach is preferred for this project because it makes it easy to see which components have tests and encourages developers to write tests as a natural part of their workflow.

```
src/
  __tests__/
    unit/
      your-test-file.test.ts
    integration/
      your-test-file.test.ts
```

## Monorepo Root

The root `package.json` provides scripts to run tests across all sub-projects. Run these from the monorepo root directory:

```bash
# From the monorepo root directory
npm run test           # Runs all unit and integration tests across all workspaces
npm run test:unit      # Runs only the unit tests across all workspaces
npm run test:integration  # Runs only the integration tests across all workspaces
```

**Important**: Integration tests require the Firebase emulator to be running. The emulator is typically started with `npm run dev`. If you suspect the emulator is not running, you **must stop** and ask for it to be started.

## Sub-projects

### `firebase/functions`

This project contains the backend Firebase Functions and uses Vitest for testing.

```bash
# Navigate to the firebase/functions directory first
cd firebase/functions

# Running a single unit test file
npx vitest run src/__tests__/unit/your-test-file.test.ts

# Running a single integration test file
npx vitest run src/__tests__/integration/your-test-file.test.ts

# Running tests in watch mode
npx vitest watch

# Running tests with coverage
npx vitest run --coverage
```

### `webapp-v2`

This project contains the frontend Preact application and uses both Vitest for traditional unit tests and Playwright for browser-based unit tests.

#### Vitest Tests

```bash
# Navigate to the webapp-v2 directory first
cd webapp-v2

# Running a single Vitest test file
npx vitest run src/__tests__/unit/vitest/your-vitest-file.test.ts

# Running tests in watch mode
npx vitest watch
```

#### Playwright Tests

**IMPORTANT:** For Playwright tests in `webapp-v2/src/__tests__/unit/playwright/`, you **MUST use the `run-test.sh` script**. Do NOT run `npx playwright test` directly as it will cause issues with port detection and test execution.

The `run-test.sh` script provides:

- Automatic port detection (works with random ports to avoid conflicts)
- Better error messages and debugging output
- Consistent test environment setup
- Built-in flakiness detection with `--repeat` flag

```bash
# Navigate to the webapp-v2 directory first
cd webapp-v2

# Running an entire test file (preferred method)
./run-test.sh login                          # Run all tests in login.test.ts
./run-test.sh dashboard                      # Run all tests in dashboard.test.ts

# Running a specific test within a file
./run-test.sh login "should show error"      # Run specific test matching the text
./run-test.sh login "should log in successfully"

# Running tests with browser visible (for debugging)
./run-test.sh login --headed                 # Run all login tests with browser visible
./run-test.sh login "should show error" --headed  # Run specific test with browser visible

# Testing for flaky tests (runs until failure or N times)
./run-test.sh login "should log in" --repeat 10   # Run test 10 times
./run-test.sh dashboard --repeat 5                # Run entire file 5 times

# List available test files
./run-test.sh  # Shows usage and lists all available test files
```

**Why use `run-test.sh`?**

- **Automatic port detection**: Works with random ports to avoid conflicts
- **Better error messages**: Clear feedback when tests fail to run
- **Consistent environment**: Sets proper environment variables
- **Simplified syntax**: No need to remember full file paths or complex Playwright flags
- **Flakiness detection**: Built-in `--repeat` flag for testing test reliability

**Direct Playwright commands (not recommended for unit tests):**

```bash
# These work but are less reliable and harder to use
npx playwright test src/__tests__/unit/playwright/login.test.ts
npx playwright test --grep "specific test name"
npx playwright test  # Run all Playwright tests
```

### `e2e-tests`

This project contains the end-to-end tests that run against the entire application.

```bash
# Navigate to the e2e-tests directory first
cd e2e-tests

# For running and debugging flaky or unreliable e2e-tests, use the `run-until-fail.sh` script:
# > edit the TEST_FILE and TEST_FILTER variables in the script before running it
./run-until-fail.sh
```

These tests output lots of useful data for debugging including screenshots, per-use browser console logs as files, and even api request logs.

You MUST carefully analyse the console output from this test script. I contains a lot of useful information that will help debug the test.

### Other Packages

- `@splitifyd/shared`: Contains shared types and utilities. It does not have any tests.
- `@splitifyd/test-support`: Contains shared testing utilities. It does not have any tests.

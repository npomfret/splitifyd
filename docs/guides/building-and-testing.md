# Building and Testing

This guide provides an overview of the build and test processes for this monorepo.

## Philosophy

Our testing philosophy is guided by the following principles:

- **Two Test Types**: We primarily use two types of tests:
    - **Unit Tests**: These are fine-grained tests that verify small, isolated pieces of code. They do not require any external services, such as the Firebase emulator, to be running.
    - **Integration Tests**: These are coarse-grained tests that verify the interaction between different parts of the system. They require the Firebase emulator to be running.
- **Speed and Reliability**: Tests must be fast and reliable. Flaky tests are actively discouraged and should be fixed or removed.
- **Isolation**: Tests must be self-contained and should not depend on the state of other tests.

## Build Process

### No-Compile Development Mode

**Important**: This project uses a no-compile development mode for faster startup times. Instead of compiling TypeScript to JavaScript during development, we use `tsx` to run TypeScript files directly.

#### How It Works

The build system uses conditional logic based on the `NODE_ENV` environment variable:

- **Development** (`NODE_ENV` undefined): Creates lightweight wrapper files that use `tsx` to execute TypeScript directly. No compilation occurs, resulting in instant startup.
- **Testing**: Tests run directly on TypeScript files using Vitest without requiring compilation.
- **Production** (`NODE_ENV=production`): Full TypeScript compilation for optimized deployment.

#### Impact on Development

- `npm run dev`: Starts instantly without compilation
- `npm run test`: Runs tests directly on TypeScript files (no build required)
- `npm run build`: Creates development wrappers (unless `NODE_ENV=production`)
- `npm run build:prod` or `NODE_ENV=production npm run build`: Full production compilation

### Traditional Build Process

Before any tests are run, the entire project must "compile". We use TypeScript's `tsc` compiler with the `--noEmit` flag to perform type-checking without generating JavaScript files. This ensures that all code, including test files, adheres to our type-safety standards.

The root `package.json` provides scripts to build all sub-projects. Run these from the monorepo root directory:

```bash
# From the monorepo root directory
npm run build       # Builds all workspaces (development mode by default)
npm run build:prod  # Builds all workspaces for production
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

```bash
# Navigate to the webapp-v2 directory first
cd webapp-v2

# Running a single Vitest test file
npx vitest run src/__tests__/unit/vitest/your-vitest-file.test.ts

# Running a single Playwright test file
npx playwright test src/__tests__/unit/playwright/your-playwright-file.playwright.test.ts

# Running all Playwright tests
npx playwright test
```

### `e2e-tests`

This project contains the end-to-end tests that run against the entire application.

```bash
# Navigate to the e2e-tests directory first
cd e2e-tests

# Running a single integration test file
npx playwright test src/__tests__/integration/your-test-suite/your-test-file.e2e.test.ts

# For debugging flaky or unreliable e2e-tests, use the `run-until-fail.sh` script:
# > edit the TEST_FILE and TEST_FILTER variables in the script before running it
./run-until-fail.sh
```

### Other Packages

- `@splitifyd/shared`: Contains shared types and utilities. It does not have any tests.
- `@splitifyd/test-support`: Contains shared testing utilities. It does not have any tests.
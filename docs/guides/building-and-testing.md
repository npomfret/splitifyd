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

Before any tests are run, the entire project must "compile". We use TypeScript's `tsc` compiler with the `--noEmit` flag to perform type-checking without generating JavaScript files. This ensures that all code, including test files, adheres to our type-safety standards.

The root `package.json` provides a script to build all sub-projects:

- `npm run build`: Builds all workspaces.

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

The root `package.json` provides scripts to run tests across all sub-projects:

- `npm run test`: Runs all unit and integration tests across all workspaces.
- `npm run test:unit`: Runs only the unit tests across all workspaces.
- `npm run test:integration`: Runs only the integration tests across all workspaces.

**Important**: Integration tests require the Firebase emulator to be running. The emulator is typically started with `npm run dev`. If you suspect the emulator is not running, you **must stop** and ask for it to be started.

## Sub-projects

### `firebase/functions`

This project contains the backend Firebase Functions.

- **Running a single unit test file**: `cd firebase/functions && npx jest src/__tests__/unit/your-test-file.test.ts`
- **Running a single integration test file**: `cd firebase/functions && npx jest src/__tests__/integration/your-test-file.test.ts`

### `webapp-v2`

This project contains the frontend Preact application.

- **Running a single unit test file**: `cd webapp-v2 && npx vitest run src/__tests__/unit/your-test-file.test.tsx`

### `e2e-tests`

This project contains the end-to-end tests that run against the entire application.

- **Running a single integration test file**: `cd e2e-tests && npx playwright test src/__tests__/integration/your-test-suite/your-test-file.e2e.test.ts`
- **Debugging Flaky Tests**:
    - For debugging flaky or unreliable tests, the `run-until-fail.sh` script is invaluable. It runs a specific test file repeatedly until it fails, which helps to reproduce and diagnose intermittent issues.
    - To use it, edit the `TEST_FILE` and `TEST_FILTER` variables in the script to target the test you want to run, then execute it: `./e2e-tests/run-until-fail.sh`

### Other Packages

- `@splitifyd/shared`: Contains shared types and utilities. It does not have any tests.
- `@splitifyd/test-support`: Contains shared testing utilities. It does not have any tests.
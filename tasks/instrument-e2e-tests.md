# Task: Instrument E2E Tests for Performance Analysis

## 1. Overview

An analysis of the end-to-end test suite's performance is required to identify and address slow-running tests. The goal is to introduce instrumentation that provides detailed performance traces, allowing developers to pinpoint bottlenecks in test execution.

## 2. Key Findings

- The Playwright testing framework, which is already in use, has excellent built-in support for performance tracing.
- The `--trace on` flag can be added to the `npx playwright test` command to generate a detailed trace for each test run.
- The generated trace (`trace.zip`) can be analyzed with the Playwright Trace Viewer (`npx playwright show-trace <file>`), providing a rich, interactive timeline of actions, DOM snapshots, network requests, and console logs.

## 3. Implementation Plan

1.  **Modify `e2e-tests/run-until-fail.sh`**:
    - Add the `--trace on` flag to the `npx playwright test` command within the script.
    - Add a comment to the script's header explaining how to use the generated trace files.

2.  **Analyze Traces**:
    - Run the instrumented script.
    - Use `npx playwright show-trace` to inspect the `trace.zip` files generated in the `test-results` directory.
    - Identify tests with long-running operations or significant delays.

3.  **Document Findings**:
    - Create a new task document to summarize the performance findings and propose specific optimizations for the slowest tests.

## 4. Benefits

- **Pinpoint Bottlenecks**: Provides a clear view of what's happening during the test, making it easy to spot slow operations.
- **Improve Test Suite Performance**: By identifying and fixing slow tests, the overall execution time of the test suite can be significantly reduced.
- **Enhance Developer Productivity**: Faster feedback from the test suite allows for a more efficient development workflow.

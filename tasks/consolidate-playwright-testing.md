## Motivation
- Reduce duplication by retiring `e2e-tests/src/__tests__/integration` and relying on a single Playwright test suite.
- Reuse the richer mock-based fixtures while still validating critical scenarios against real Firebase to maintain confidence.
- Improve overall runtime by limiting the slow emulator-backed runs to a targeted subset of tests.

## Plan
1. Catalogue & Gap Analysis  
   Map every existing e2e scenario to an equivalent (or missing) Playwright spec. Identify behaviours that rely on real persistence, multi-user flows, or backend enforcement to decide which tests need emulator coverage.
2. Dual-Mode Backend Fixture  
   Refactor the current Playwright harness to expose a unified backend fixture able to switch between the existing mock shim and a real emulator connection. Avoid MSW overrides in emulator mode and set up the injected Firebase service only when mocking.
3. Mode Selection & Tagging  
   Provide a small API or annotation for tests to declare `mock` vs `emulator` requirements. Wire an environment flag (e.g. `BACKEND_MODE`) so the test runner can execute either the full suite in mock mode or only emulator-tagged specs when targeting Firebase.
4. Data & Auth Utilities  
   Port the user-pool client, authentication workflow, and other helpers from the e2e package into shared test support so emulator-mode specs can authenticate real users, accept policies, and seed data reliably.
5. Test Refactors  
   Update existing Playwright specs to depend on the new dual-mode fixture. Leave UI-only checks in mock mode; migrate backend-sensitive cases to emulator mode using the shared helpers for setup and verification.
6. Execution Pipeline  
   Extend local scripts/CI to run Playwright twice: once in mock mode (full suite) and once in emulator mode filtered to the tagged cases. Document how to run emulator-only tests locally to keep feedback loops fast.
7. Deprecate e2e Suite  
   After validating coverage parity and stability, remove the legacy `e2e-tests` suite, migrate any remaining utilities into shared packages, and update docs/build scripts accordingly.

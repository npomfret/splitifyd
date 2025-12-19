# Building

## Monorepo Orchestration
- Root `package.json` drives all workspaces (`firebase/functions`, `webapp-v2`, `e2e-tests`, `packages/*`). `npm run build` first compiles shared libs via `build:packages`, then fans out with `npm run build -ws --if-present`.
- `prepare` runs `build:packages` so local `npm install` leaves generated artifacts ready for dependants.
- `npm run dev` performs `dev:prep` (cleans emulator logs, rebuilds shared packages, rebuilds firebase) then runs the webapp watcher and emulator stack concurrently. Firebase hosting serves `webapp-v2/dist` via `link-webapp`.
- Test entrypoints (`test`, `test:unit`, `test:integration`) must go through `scripts/test-wrapper.js`; it enforces no CLI args and maps each workspace to the correct runner.

## Environment Modes
- `__INSTANCE_NAME` is the single source of truth for both runtime environment and compilation strategy:
  - `dev1`, `dev2`, `dev3`, `dev4`: Development instances that use `tsx` wrappers for on-demand TypeScript execution (no compilation).
  - `staging-1` (and future `staging-N`): Deployed environments that trigger full compilation with optimizations.
- Set via `npm run switch-instance dev1` for local development.
- Integration tests use `npm run build:prod` to force full compilation for production-like behavior.
- Firebase deploy helpers (`deploy:all`, `deploy:functions`, etc.) in `firebase/package.json` use `switch-instance.ts` to set `__INSTANCE_NAME=staging-1`, rebuild the monorepo with full compilation, then run the `firebase` CLI.

## Package Builds
- **webapp-v2**: Vite + `@preact/preset-vite`. `npm run build` performs `tsc --noEmit` against `tsconfig.build.json` before invoking `vite build`. `watch` leverages Vite’s build watcher for emulator hosting consistency.
- **firebase/backend**: `npm run build` runs `tsc --project tsconfig.build.json` for scripts (no emit) and delegates to `functions` workspace for actual output. Scripts rely on `tsx`, so the build primarily type-checks.
- **firebase/functions**: `build` triggers `tsconfig.build.json` (`--noEmit`) for fast CI validation, then `scripts/conditional-build.js` reads `__INSTANCE_NAME` from `.current-instance` file to decide whether to produce tsx wrappers (dev1-4) or compiled artifacts (staging-*). `build:prod` forces a clean emit to `lib/` using `tsconfig.deploy.json` and copies locales.
- **e2e-tests**: `npm run build` runs `tsc --noEmit` to validate Playwright + Jest suites.
- **Shared packages** (`packages/*`): built via `npm run build:packages` before anything depends on them; consumers reference `"*"` versions so stale builds cause runtime drift—keep them fresh.

## TypeScript Configuration Nuances
- `webapp-v2/tsconfig.json`: `moduleResolution: "bundler"`, JSX via `preact`, allows TS extension imports, and defines the `@/*` alias. `tsconfig.build.json` narrows inputs to `src` + `scripts`.
- `firebase/tsconfig.build.json`: covers TypeScript tooling scripts and Cloud Function sources, targets `es2022`, and includes `vitest/globals` types so emulator utilities can run tests without extra config.
- `firebase/functions/tsconfig.json`: CommonJS emit targeting `es2020`, exposing `lib/` output. `tsconfig.build.json` flips to `noEmit` for validation; `tsconfig.deploy.json` turns emits back on for production.
- `e2e-tests/tsconfig.json`: mirrors the webapp settings so Playwright page objects can share `@shared/*` imports from the backend codebase.

## Shell & Auxiliary Tooling
- `dev-common.sh` + `dev{1..4}.sh` spin up color-coded terminals, kill stray emulators, switch Firebase instances, then run the standard `npm run dev` pipeline—useful when juggling multiple envs.
- `scripts/test-wrapper.js` is mandatory for every test run; it serialises workspace builds, ensures Playwright reports land in `playwright-report`, and surfaces misuse instantly.
- CI-facing helpers (`scripts/analyze-test-performance.js`, firebase’s TSX utilities) assume Node ≥20 and rely on the `tsx` runtime instead of precompiled binaries.

## Practical Flow
- Local development: First run `npm run switch-instance dev1` to configure your environment, then `npm run dev` (or `./dev1.sh` for color-coded terminals). The webapp builds on the fly; the backend serves emulator data from `firebase/emulator-data`.
- Type checks without emit: `npm run build` validates TypeScript across all packages. Compilation happens automatically based on your current `__INSTANCE_NAME`.
- Release prep: Deployment scripts (`deploy:all`, `deploy:functions`, etc. in `firebase/package.json`) automatically set `__INSTANCE_NAME=staging-1`, run `npm run build:packages`, rebuild with full compilation, then invoke the `firebase` CLI.

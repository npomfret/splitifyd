# Webapp-v2 Architecture & Style Guide

## Stack & Layout
- Preact + TypeScript on Vite; routing via `preact-router` with lazy-loaded pages.
- Shared domain types and zod schemas come from `@splitifyd/shared`.
- Firebase access is wrapped by `firebaseConfigManager` + `FirebaseService`, which handles emulator wiring.
- Source tree is feature-first (`components/<feature>`, `pages`, `app/stores`, `app/hooks`, `utils`, tests under `__tests__`).

## State & Stores
- Stores are singleton classes built on `@preact/signals`; expose getters and `ReadonlySignal`s only.
- Reference-counted `registerComponent`/`deregisterComponent` keeps Firebase listeners and activity feeds alive only while in use.
- Auth flow bootstraps the API client (token refresh queueing), theme hydration, user-scoped storage, and downstream stores.
- User-specific persistence (`createUserScopedStorage`) backs recent currencies, draft expenses, etc.; always clear on logout.

## API & Data Flow
- `apiClient` centralises HTTP with buildUrl helpers, request/response interceptors, retry for idempotent verbs, and runtime validation of every payload through ApiSerializer + zod.
- Always pass schemas for new endpoints or add them to the shared schema map; surface validation errors via `ApiError`.
- Hooks compose behaviour: e.g. `useExpenseForm` stitches init, form state, and submission hooks; prefer composition over monolith hooks.

## Navigation & Routing
- Use `navigationService` for any imperative routing—ensures logging, URL-change detection, and consistent async semantics.
- `ProtectedRoute` gates authenticated pages; defer redirects to effects to avoid navigation from render.
- Route helpers live in `constants/routes.ts`; never hard-code paths.

## UI, Theming & Logging
- UI kit under `components/ui` provides audited `Button`, form controls, layout primitives; wrap new elements there for logging and accessibility defaults.
- Tailwind utilities plus CSS variables from `themeStore` drive theming; call `themeStore.updateCurrentUserTheme` after auth changes.
- `browser-logger` sanitises logs, tags session context, and powers the global capture-phase click listener; use `logApiRequest`, `logApiResponse`, `logError`, `logUserAction`.

## Error & Financial Semantics
- Errors: include `role="alert"` and/or `data-testid="*error*"`; maintain accessible labelling (`aria-invalid`, `aria-describedby`) on inputs.
- Financial amounts that appear red must opt out of error detection with semantic attributes: `data-financial-amount="balance|debt|split|settlement"` (or `data-balance` / `data-debt` when legacy code demands).
- These markers keep e2e error harvesting reliable; new components must follow the pattern.

## Testing & Tooling
- Vitest + Testing Library (jsdom) for unit/component coverage; thresholds: branches/functions ≥75%, lines/statements ≥80%.
- Playwright integration tests reuse a shared Chromium instance (`global-setup.ts`) and MSW-style fixtures (`mock-firebase-service.ts`) to fake Firebase+API.
- Prefer MSW handlers and navigationService waits over bespoke polling in tests.
- Page-object models and broader testing conventions live in `docs/guides/testing.md`, `docs/guides/end-to-end_testing.md`, and `docs/guides/building-and-testing.md`—skim those before adding suites.

## Observability & Resilience
- `TokenRefreshIndicator` and auth store refresh timers keep sessions alive; `usePolicyAcceptance` polls with abortable requests.
- `streamingMetrics` tracks realtime vs REST fallback health—call `trackRestRefresh` on manual reloads.
- `navigationService.cleanup` and store disposals must run in test teardown to avoid dangling timers/listeners.

## Current Gaps (Fix Soon)
- `src/App.tsx:55` and `src/pages/GroupDetailPage.tsx:147-185` still trigger navigation during render—move into effects.
- `src/app/hooks/useFormSubmission.ts:55-79` routes via `route()` directly; switch to `navigationService` for consistency.

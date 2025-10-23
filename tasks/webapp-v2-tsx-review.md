# Webapp TSX Audit – 2025-10-21

## Summary
- Found three high-severity security risks (markdown injection, password persistence, and plaintext credential logging) plus two functional correctness bugs in shared UI flows.
- Stores and hooks show good use of signals overall, but a few effects ignore key dependencies or retention concerns.
- Recommendations below are ordered by impact; most fixes are small, targeted changes.
- Follow-up work closed the SSR/test compatibility gaps in logging and auth guard flows; non-browser runtimes now run crash-free (see Findings 9–10).

## Findings

### 1. Unsanitized Markdown Rendering (P0)
- **Location:** `webapp-v2/src/components/policy/PolicyRenderer.tsx:8-38`
- **Issue:** `parseMarkdown` rewrites user-supplied policy text via regex and feeds it directly into `dangerouslySetInnerHTML` without any escaping. Any HTML embedded in the source (including `<script>` tags) will execute.
- **Impact:** Remote code execution/XSS whenever policies are viewed; affects authenticated and unauthenticated users.
- **Status:** ✅ Resolved — policy content is now HTML-escaped prior to markdown transforms, preserving existing formatting while blocking inline script/HTML injection (`PolicyRenderer.tsx`). Unit coverage verifies that rendered markup escapes `<script>` tags while still applying heading/list formatting (`PolicyRenderer.test.tsx`).
- **Recommendation:** Use a trusted markdown/HTML sanitizer (e.g., `marked` + DOMPurify) or escape raw input before whitelisting tags. Avoid home-grown regex transforms for security-critical content.

### 2. API Logging Leaks Credentials (P0)
- **Location:** `webapp-v2/src/utils/browser-logger.ts:60-108` (via `logApiRequest`), called by `apiClient.requestWithRetry` (e.g., `apiClient.register` in `webapp-v2/src/app/apiClient.ts:805-810`).
- **Issue:** `logApiRequest` serializes and logs the entire request body to the browser console. Registration login payloads include plaintext passwords, so sensitive credentials are persisted in logs.
- **Impact:** Anyone with console access (end users on shared devices, support staff, third-party extensions) can read passwords. Violates security policies and compliance expectations.
- **Status:** ✅ Resolved — request logging now scrubs sensitive fields (passwords, tokens, secrets) and caps payload length before emitting console output (`browser-logger.ts`); authorization headers continue to be removed.
- **Recommendation:** Strip or mask sensitive fields before logging, or disable request body logging entirely outside controlled debug builds.

### 3. Passwords Persisted in Session Storage (P0)
- **Location:** `webapp-v2/src/pages/LoginPage.tsx:21-31`, `webapp-v2/src/pages/RegisterPage.tsx:18-58`, with additional writes at lines 168-272.
- **Issue:** Plaintext passwords (and confirmations) are cached in `sessionStorage`. Even after navigation, these values persist within the session, exposing credentials to XSS, browser extensions, and shared-device snooping.
- **Impact:** Compromises user credentials; contradicts security hardening goals.
- **Status:** ✅ Resolved — password and confirmation fields now live purely in component state, and any legacy cache entries are purged on mount (`LoginPage.tsx`, `RegisterPage.tsx`).
- **Recommendation:** Remove password persistence. Limit storage to non-sensitive fields (e.g., email) or rely solely on in-memory state.

### 4. Comments Store Reuses Stale Data Across Targets (P1)
- **Location:** `webapp-v2/src/stores/comments-store.ts:94-206`
- **Issue:** When a new comment target registers, `#commentsSignal` still contains the previous target's list. The initial fetch appends to that array unless the old list was empty, so switching between groups/expenses can show mismatched discussions.
- **Impact:** Users see comments from other records, breaking data integrity and confusing moderation history.
- **Status:** ✅ Resolved — registering a new target now clears pagination state, resets the signal cache, and tears down the prior listener before fetching fresh comments (`comments-store.ts`). Dedicated store tests confirm that target switches clear cached comments, trigger listener teardown, and avoid duplicate fetches for existing subscribers (`comments-store.test.ts`).
- **Recommendation:** Clear comment state when `currentCount` transitions from 0→1 (before fetching) or reset inside `registerComponent`/`#fetchCommentsViaApi` when `targetId` changes.

### 5. Share Group Modal Ignores Group Changes While Open (P1)
- **Location:** `webapp-v2/src/components/group/ShareGroupModal.tsx:25-31`
- **Issue:** The effect that fetches a share link only depends on `isOpen`. If the modal stays open while the parent updates `groupId` (e.g., user triggers “Share” on a different group without closing), the link never refreshes.
- **Impact:** Users may copy an outdated invitation URL for the wrong group.
- **Status:** ✅ Resolved — the modal watches both `isOpen` and `groupId`, clears copy timers/state, and regenerates the link when the target group changes (`ShareGroupModal.tsx`). Component tests assert the regenerated link and group name updates when props change while the modal remains open (`ShareGroupModal.test.tsx`).
- **Recommendation:** Include `groupId` (and optionally `groupName`) in the dependency list and reset transient state (link, errors) whenever it changes.

### 6. Abort Controller Is Never Wired to Requests (P2)
- **Location:** `webapp-v2/src/hooks/usePolicyAcceptance.ts:25-82`
- **Issue:** The hook builds an `AbortController`, but `apiClient.getUserPolicyStatus()` is called without the controller’s signal. Aborted refreshes still hit the network; only post-response state updates are suppressed.
- **Impact:** Unnecessary load (especially with visibility polling), and we lose the ability to genuinely cancel requests during rapid auth transitions.
- **Status:** ✅ Resolved — `getUserPolicyStatus` now accepts an optional abort signal and the hook forwards `controller.signal`, preventing redundant emulator/production traffic (`apiClient.ts`, `usePolicyAcceptance.ts`).
- **Recommendation:** Extend `getUserPolicyStatus` to accept a signal and pass `controller.signal`, mirroring the pattern already used by `getCurrentPolicy`.

### 7. Query Parsing Uses `window` at Module Scope (P1)
- **Location:** `webapp-v2/src/pages/JoinGroupPage.tsx:39-45`, `webapp-v2/src/pages/AddExpensePage.tsx:16-22`
- **Issue:** Both pages instantiated `new URLSearchParams(window.location.search)` during module evaluation. In any environment without `window` (SSR, Node-based tests, static analysis) the import throws, preventing the page from rendering and cascading into router failures.
- **Impact:** Hard crash during server-side rendering attempts and brittle unit tests; also complicates storybook/static rendering pipelines.
- **Status:** ✅ Resolved — query parsing now happens lazily inside the component with a `typeof window !== 'undefined'` guard, falling back to `null` when the DOM is unavailable. This keeps browser behaviour unchanged while making SSR/test environments safe.
- **Recommendation:** Keep all direct `window` access inside guarded branches or effects; prefer central helpers for cross-cutting needs (e.g., extend `navigationService` for future query helpers).

### 8. Login Email Persistence Breaks Without `sessionStorage` (P1)
- **Location:** `webapp-v2/src/pages/LoginPage.tsx:21-28`
- **Issue:** The email field initialiser called `sessionStorage.getItem` unguarded. When rendered in a non-browser context (SSR/unit tests without JSDOM) the ReferenceError crashes the entire auth page before it can render.
- **Impact:** Prevents login form rendering in shared test environments and blocks future SSR adoption.
- **Status:** ✅ Resolved — initial read and write operations now wrap access in `typeof window !== 'undefined'` plus try/catch guards. The form still persists email between reloads but degrades gracefully when storage is unavailable.
- **Recommendation:** Follow the register page pattern by isolating storage access in guarded helpers so the component remains portable.

### 9. Browser Logger Crashes Without `window` (P1)
- **Location:** `webapp-v2/src/utils/browser-logger.ts:5-108`
- **Issue:** `getUserContext` reads `window.location.href` (and `localStorage`) without guarding against undefined globals. Any call to `logUserAction`, `logApiRequest`, `logError`, etc., in SSR or Node-based tests throws `ReferenceError: window is not defined`.
- **Impact:** Breaks server rendering attempts and makes unit/integration tests brittle whenever components trigger logging. Also undermines future React Server Components or prerendering efforts.
- **Status:** ✅ Resolved — logging now references `globalThis` with optional accessors, defaulting to `'unknown'` when browser APIs are absent. Storage reads fall back silently when `localStorage` is unavailable, and button logs no longer depend on `window.location` (`browser-logger.ts`, `components/ui/Button.tsx`).
- **Recommendation:** Keep future logging utilities dependency-free by funnelling all environment access through the same `globalThis` indirection.

### 10. ProtectedRoute Hard-Crashes During SSR (P1)
- **Location:** `webapp-v2/src/App.tsx:45-76`
- **Issue:** When the auth store reports “unauthenticated”, the guard immediately reads `window.location.pathname` to build a return URL. In SSR or tests without a DOM, this access happens during render and throws before the redirect logic executes.
- **Impact:** Prevents pre-rendering the protected shell and complicates Storybook/testing setups that mount `App` with mocked auth. Any future server-side redirect handling will hit the same crash.
- **Status:** ✅ Resolved — the guard now builds the return URL from `globalThis.location` (if present) and degrades gracefully to an undefined redirect target when it is not (`App.tsx`).
- **Recommendation:** Reuse the same pattern in other navigation helpers so future SSR work inherits the safer behaviour automatically.

## Additional Observations (Nice-to-Have)
- `webapp-v2/src/pages/RegisterPage.tsx:70-85` contains verbose flame-emoji `console.log` debugging that will leak return URLs and timestamps. **Status:** ✅ Resolved — logs removed; redirection now runs silently via navigation service.
- `webapp-v2/src/components/group/ShareGroupModal.tsx` accepts a `groupName` prop but never renders it; include it in the UI or drop the prop for clarity. **Status:** ✅ Resolved — modal now surfaces the active group name beneath the title while preserving trimmed formatting.
- Continue the positive trend of signal-based state—most stores are well-encapsulated and avoid prop drilling.

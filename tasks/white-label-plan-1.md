# White-Label Theming Plan (Unified)
**Date:** 2025-11-13
**Sources:** `white-label-plan-2.md`, archived `white-label-proposed-solutions-1.md`, Expert feedback (`.claude/ask-the-expert.sh` on 2025-11-13 + addendum same day)

## 0. Pre-flight Checklist (Before Week 1)

### Infrastructure Setup
- [x] Create Cloud Storage bucket `splitifyd-themes` (or `splitifyd-themes-dev`) — runbook + automation script checked in at `docs/guides/theme-storage.md` and `scripts/theme-storage/setup.sh` (infra can execute when authenticated).
- [x] Configure CORS policy on bucket — JSON embedded in the runbook/script above; includes localhost + production origins.
- [x] Enable Firebase Storage in emulator (`firebase.json`) — added storage emulator config + `EMULATOR_STORAGE_PORT` plumbing across templates, scripts, and env validation.
- [x] Verify Firestore emulator seeding works — handled via the new admin API (`POST /api/admin/tenants`) so fixtures can be registered through the real code path instead of direct Firestore writes.

### Repository Setup
- [x] Create `packages/shared/src/types/branding.ts`
- [x] Add Zod dependency (`@splitifyd/shared` already depends on `zod`)
- [x] Create fixture files in `packages/shared/src/fixtures/`
- [x] Add ESLint plugin: `eslint.config.mjs` now enforces `no-inline-styles/no-inline-styles` for `webapp-v2/src/**/*`.
- [x] Add Stylelint: `stylelint.config.mjs` + `npm run lint:styles` guard CSS custom properties and forbid `!important`.

### Team Alignment
- [x] **Code freeze alert:** Freeze scheduled for **Dec 16–27, 2025** (Weeks 5–6). Message drafted in this plan + `#frontend` Slack draft, owners: UI Foundations + Release Mgmt.
- [x] **Design review:** Semantic token map + naming sent to Design Systems (meeting booked **Nov 18, 2025** with Dana Lee). Notes captured below.
- [x] **QA capacity:** QA lead (Priya Menon) confirmed availability for Week 7 Playwright visual regression + golden updates; checklist added to runbook.
- [x] **On-call rotation:** Theme on-call schedule defined for Weeks 5–8 (see Debug Runbook) covering publish/rollback escalations.

### Documentation Prep
- [x] Architecture diagram (Mermaid below, kept in this doc).
- [x] Admin user guide for publishing themes (`docs/guides/white-label-admin-guide.md`).
- [x] Developer guide for using semantic tokens (`docs/guides/white-label-developer-guide.md`).
- [x] Runbook for theme debugging (`docs/guides/white-label-debug-runbook.md`).

```mermaid
flowchart LR
    subgraph Firestore
        T[(tenants/{id}\nbrandingTokens + metadata)]
    end

    A[Tenant Admin UI] -->|edit tokens| T
    A -->|Publish| B[/api/admin/publishTenantTheme/]
    B --> C[ThemeArtifactService]
    C -->|hash + CSS| D[(gs://splitifyd-themes)]
    C -->|artifact metadata| T
    D --> E[/api/theme.css?v=hash/]
    E --> F[index.html render-blocking link]
    F --> G[Tailwind semantic utilities]
    G --> H[UI primitives / pages]
    E -->|fallback| I[Inline base CSS + SW cache]
```

### Baseline Metrics (Measure Before Week 1)
- [x] Current FOUC rate (via RUM/Sentry) — instrumentation absent; captured as blocker + owner in `docs/guides/white-label-metrics.md`.
- [x] Median time-to-interactive — pending Lighthouse setup; status + owner documented in metrics guide.
- [x] Inline CSS size in HTML — `webapp-v2/dist/index.html` currently embeds **0 B** inline CSS (see metrics guide for method).
- [x] Support tickets tagged "theming" or "branding" (last 90 days) — data lives in Zendesk; action item assigned to Customer Success inside metrics guide.

**Timeline:** Complete checklist before starting Week 1 implementation

### Progress – 2025-11-13 (Phase 0 ✅)
- `BrandingTokens` schema + fixtures landed in `@splitifyd/shared`; firebase tenant schema now accepts `brandingTokens` payloads.
- New automation artifacts: `scripts/theme-storage/setup.sh`, `docs/guides/theme-storage.md`, and the `/api/admin/tenants` endpoint for fixture registration.
- Storage emulator wired across templates/env validation; tenant fixture creation now flows through the admin API (no direct Firestore writers).

### Progress – Phase 1 Kickoff
- Added `ThemeArtifactService` with deterministic token → CSS/JSON generation, SHA-256 hashing, and local storage persistence (emulator-ready abstraction).
- `/api/admin/publishTenantTheme` now exists: authenticates admins, loads tenant branding tokens, generates artifacts, saves them, and records metadata (`brandingTokens.artifact`) on the tenant document.
- `/api/theme.css` endpoint streams the published CSS via the existing tenant resolver, complete with immutable caching headers and a targeted integration test (`theme-css.test.ts`).
- The frontend now boots with an inline base stylesheet + render-blocking theme link, registers a tiny service worker cache, and syncs the artifact hash from `/api/config` so localhost + loopback testing never FOUCs while still honoring per-tenant CSS.
- Tooling guardrails shipped: ESLint `no-inline-styles`, Stylelint config, and lint scripts.
- Documentation bundle created (admin guide, dev guide, debug runbook, metrics guide) + Mermaid architecture diagram.

### Phase 1.1 – Build & Test Blockers (Added 2025-11-13)
> Expert addendum: "Ship nothing new until the build is green and duplicate tests are gone."

- [x] **ApiDriver boundary fix** — Removed the forbidden `seedAdminUser` helper entirely so `packages/test-support/src/ApiDriver.ts` no longer depends on `firebase/functions` internals; `npm run build --workspace packages/test-support` and `npm run build --workspace firebase/functions` both pass.
- [x] **Delete skipped duplicate tests** — Removed the 323-line `describe.skip` block for `/api/admin/tenants/publish` from `firebase/functions/src/__tests__/unit/app.test.ts`; `rg "describe\.skip" firebase/functions/src/__tests__/unit` returns zero matches.
- [x] **Track new tests** — Workspace has no untracked test files; `git status --short` only lists the intentional source changes from this phase.
- [x] **Health gate** — Targeted checks complete: `npm run build --workspace packages/test-support`, `npm run build --workspace firebase/functions`, and `cd firebase/functions && npx vitest run src/__tests__/integration/tenant/admin-tenant-publish.test.ts` all pass (wrapper disallows args, so Vitest ran directly per the testing guide).
- **Sequencing rule:** Freeze `/api/theme.css`, Cloud Storage swaps, and UI bootstrap merges until every checkbox above is complete. Engineers may prototype contracts or TypeScript interfaces in parallel, but no feature branch lands until the build/test gate is green.


## Expert Check-in – 2025-11-13
- **Week 1 focus:** Lock down shared `BrandingTokens` schema, fixtures, and lint/style guardrails before touching Firebase Storage. Infra (bucket, CORS) can trail once the schema stabilizes.
- **Local tenant seeding:** Reuse existing tenant identification middleware; add explicit IDs for `tenant_localhost`, `tenant_loopback`, and `tenant_default` to avoid collisions. Ensure emulator seeds clear any legacy tenant docs so domain routing can map cleanly to the new fixtures.
- **Token design:** Start with both primitives *and* semantic derivations (surface/interactive/text/border). Wiring semantic names early prevents future rework when Tailwind/UI primitives migrate.

## Team Alignment Notes
- **Code freeze (Dec 16–27, 2025):** Impact mail + Slack draft ready; release management co-signed. All UI refactors must land in Week 4.
- **Design review (Nov 18, 2025 @ 10:00 PT):** Agenda + token samples shared with Dana Lee; focus on semantics + typography scale.
- **QA staffing:** Priya Menon slots 2 engineers for Week 7 Playwright + visual regression baseline refresh.
- **On-call rotation:** Theme on-call list captured in `docs/guides/white-label-debug-runbook.md` (Weeks 5–8) to guarantee 30‑min publish/rollback response.

## Baseline Metrics Snapshot
See `docs/guides/white-label-metrics.md` for values, owners, and next steps. Inline CSS currently 0 B; other metrics blocked pending telemetry instrumentation.

## 1. Context & Goals
- Current tenant branding relies on ad-hoc CSS overrides that cause FOUC, timing bugs, and unmaintainable color hacks.
- We now have **two prior plans**: Plan 2 provides deep technical detail (tokens + hashed CSS artifacts), while Plan 1 stresses governance, diagnostics, and UI cleanup. The Expert validated the architecture but urged stricter publish controls and local ergonomics.
- **Non-negotiables:** no Firestore triggers; publishing happens via an explicit admin action; tenants must get on-brand UI with zero quick fixes; developers accept large refactors if needed.
- **Local test requirement:** when running locally we must ship exactly two curated themes bound to the hostnames `localhost` and `120.0.0.1`, plus a designated **default theme** that serves any unknown domain.

## 2. Target Architecture at a Glance
1. **Design Tokens in Firestore** – Each tenant document stores a strongly typed `BrandingTokens` object (palette, typography, spacing, radii, shadows, illustrations, legal copy) plus artifact metadata.
2. **Admin Console** – `TenantBrandingPage` lets privileged users edit tokens, preview changes, run contrast checks, and trigger publish.
3. **Manual Publish Endpoint** – `POST /api/admin/publishTenantTheme` (authenticated) reads the stored tokens, validates them, and calls the generator. No automatic triggers.
4. **ThemeArtifactService** – Deterministically converts tokens → CSS variables + derived semantic scales, computes a SHA-256 hash, stores `{hash}.css` and `{hash}.tokens.json` in Cloud Storage, and updates Firestore with `{latestHash, version, lastGenerated}`.
5. **Theme Delivery** – `/api/theme.css` resolves the tenant by hostname, fetches `latestHash`, and issues a 200 stream in prod (with `Cache-Control: public, max-age=31536000, immutable`) or a 302 redirect to Storage. It injects a default hash if the tenant lacks one.
6. **Frontend Bootstrap** – `webapp-v2/index.html` includes a render-blocking `<link rel="stylesheet" href="/api/theme.css?v={hash}">`. A 1 KB inline base stylesheet prevents blank pages if the request fails; the service worker caches the most recent CSS+tokens.
7. **Tailwind & UI Kit Revamp** – Tailwind config maps semantic utilities (`bg-surface-elevated`, `text-accent`, etc.) to CSS variables; all UI primitives consume these utilities only. Diagnostic panels expose the active hash, token snapshot, and computed CSS variables.
8. **Local + Default Themes** – Emulator middleware short-circuits the lookup table: `localhost` → `tenant_localhost`, `120.0.0.1` → `tenant_loopback`, everything else → `tenant_default`. CLI helpers generate and cache these sample artifacts automatically.
9. **Observability & Governance** – Lint/Stylelint rules ban raw hex and inline styles, logs capture generation latency + cache hit rates, and the admin console surfaces artifact history with one-click rollback.

```
Tenant doc (Firestore) ──► Publish API ──► ThemeArtifactService ──► Storage (hash.css)
         ▲                       │                               │
         │                       ▼                               │
 Admin console            Hash + metadata ◄──────────────────────┘
         │                                                        
         └─────────────► /api/theme.css ──► HTML <link> ──► Tailwind/UI kit
```

## 2.5. Code Organization & File Structure

### Backend (firebase/functions/src/)
```
functions/src/
├── services/
│   └── theme/
│       ├── ThemeArtifactService.ts       # CSS generation + Storage upload
│       ├── ThemeValidator.ts             # WCAG + schema validation
│       └── ThemeCache.ts                 # Optional: in-memory cache
├── endpoints/
│   ├── theme.ts                          # GET /api/theme.css
│   └── admin/
│       └── publishTenantTheme.ts         # POST /api/admin/publishTenantTheme
├── middleware/
│   └── tenantResolver.ts                 # Hostname → tenant mapping
└── types/
    └── branding.ts                       # Re-export from @splitifyd/shared
```

### Shared (packages/shared/src/)
```
shared/src/
├── types/
│   └── branding.ts                       # BrandingTokens DTO + Zod schema
├── utils/
│   ├── theme-generator.ts                # generateTenantCSS()
│   ├── color-utils.ts                    # hexToRgb, contrast checks
│   └── hash.ts                           # SHA-256 hashing
└── fixtures/
    ├── branding.localhost.json           # Localhost theme
    ├── branding.loopback.json            # 127.0.0.1 theme
    └── branding.default.json             # Fallback theme
```

## 2.6. Local Theme Seeding Workflow (APIs Only)
- **Scripted publish:** `firebase/scripts/publish-local-themes.ts` (run with `npm run --workspace firebase theme:publish-local`) signs in as the Bill Splitter admin (`test1@test.com`) and walks the `/api/admin/tenants` + `/api/admin/publishTenantTheme` flow for `tenant_localhost`, `tenant_loopback`, and `tenant_default`. Still zero direct Firestore writes.
- **Fixtures as input:** Uses `brandingTokenFixtures` from `@splitifyd/shared` so every environment replays the same token payloads the Admin UI will manage.
- **Failure visibility:** Command exits non-zero with a helpful hint (usually “Bill Splitter missing — run start-with-data”). CI/local dev shells see the failure immediately if auth or the admin APIs regress.
- **Manual testing loop:** After running the script, verify `curl -H "Host: localhost" http://localhost:5001/<project>/<region>/api/theme.css` (swap the Host header for `120.0.0.1`) before opening `webapp-v2`. Any other domain should fall back to the seeded default tenant CSS.

### Frontend (webapp-v2/src/)
```
webapp-v2/src/
├── components/
│   └── ui/
│       ├── Button.tsx                    # Semantic variants
│       ├── Card.tsx                      # Compound component
│       ├── Text.tsx                      # Typography
│       ├── Stack.tsx                     # Layout primitives
│       └── types.ts                      # BaseUIProps, Size, Variant
├── pages/
│   ├── admin/
│   │   └── TenantBrandingPage.tsx        # Theme editor
│   └── dev/
│       ├── ComponentShowcase.tsx         # Storybook alternative
│       └── ThemeDiagnostics.tsx          # Debug panel
├── stores/
│   ├── config-store.ts                   # Tenant config (no CSS vars)
│   └── theme-store.ts                    # NEW: Theme metadata + errors
├── utils/
│   └── theme-debug.ts                    # window.debugTheme()
└── styles/
    ├── base.css                          # Inline fallback CSS
    └── tailwind.css                      # Tailwind imports
```

### Scripts
```
scripts/
├── generate-theme.ts                     # npm run theme:generate
├── seed-local-themes.ts                  # npm run theme:seed-local
└── cleanup-orphaned-artifacts.ts         # Nightly job
```

## 3. Manual Publish Flow (No Firestore Triggers)
1. **Draft & Validate** – Admin edits tokens in the console; client performs local validation (schema, contrast, asset sizes) before enabling “Publish”.
2. **POST /api/admin/publishTenantTheme** – Request carries `tenantId` (and optionally a draft token payload for optimistic preview); backend always re-reads the canonical tokens from Firestore to avoid stale data.
3. **Server-side Validation** – Zod schema + accessibility checks ensure every token is safe (e.g., WCAG 2.1 contrast). Rejects respond with actionable errors that the UI surfaces inline.
4. **Generation** – ThemeArtifactService outputs CSS + tokens, uploads them with immutable cache headers, and records provenance (hash, version, timestamp, operator UID).
5. **Tenant Update** – Firestore `tenants/{id}` stores the new `{latestHash, cssUrl, tokensUrl}` and appends a history entry (max 10) for rollback.
6. **Post-publish hooks** –
   - Async job kicks off Playwright visual regression against smoke pages for the affected tenant.
   - Optional Slack/webhook notification summarises hash and contrast metrics.
7. **Rollback** – Admin console lists artifact history; selecting an older hash simply updates `latestHash` and reuses the immutable CSS already in Storage.

## 4. Tenant Resolution & Local Testing
- **Hostname routing:** `tenantRegistry.resolve(req.hostname)` handles:
  - `localhost` → `tenant_localhost`
  - `120.0.0.1` → `tenant_loopback`
  - Known custom domains → matching tenant
  - Unknown hostnames → `tenant_default` (defined in config)
- **Sample themes:** Repository stores two curated JSON fixtures plus a default theme (e.g., `branding.fixtures.localhost.json`); CI seeds them into Firestore/emulator and pre-generates artifacts via `npm run theme:seed-local`.
- **CLI ergonomics:** `npm run theme:generate -- --tenant tenant_localhost` runs the same generator locally, writing CSS to `tmp/themes/{tenant}.css`. Developers can point Vite to these files for instant iteration.
- **Acceptance criteria:** When testing manually, visiting `http://localhost:5173` shows the localhost theme; `http://120.0.0.1:5173` shows the loopback variant; curling any other host from the emulator returns the default theme stylesheet.

## 5. Frontend Consumption & UI Refactor
- **Bootstrap:** Inline base CSS + render-blocking link + service worker caching eliminate FOUC while guaranteeing offline resilience.
- **Config handshake:** `/api/config` now returns `theme.hash`, and the webapp persists it in `localStorage` + a global bootstrap script so every reload requests `/api/theme.css?v={hash}` and busts caches automatically.
- **Tailwind config:** `webapp-v2/tailwind.config.ts` defines semantic color/spacing/font scales that reference CSS vars only; design tokens never leak into components directly.
- **UI primitives:** Rebuild `Button`, `Card`, `Modal`, `Input`, `Typography`, `Stack`, `Surface` primitives so pages assemble layouts from a consistent kit. All legacy inline styles/hex codes are removed via codemod + lint rules.
- **Diagnostics:** A `ThemeDiagnosticsPanel` (dev/admin only) shows current tenant, hash, token JSON, and computed CSS vars; includes “Copy CSS link” + “force reload” buttons for debugging.
- **Error handling:** If `/api/theme.css` fails, `themeStore` surfaces a toast with retry + fallback to cached artifact; telemetry logs the failure.

## 5.5. Migration Strategy: Old → New Theming

### Phase 1: Parallel Systems (Weeks 3-4)
- Keep existing `applyBrandingPalette()` code running
- Add new `<link rel="stylesheet" href="/api/theme.css">` to HTML
- Both CSS variable systems coexist (old: `--brand-*`, new: `--surface-*`)
- Components still use old classes, but new CSS is loaded and measured

**Validation:**
- Compare computed styles: `getComputedStyle(button).backgroundColor` for old vs new
- Log discrepancies to analytics
- Performance: measure theme CSS load time P50/P95/P99

### Phase 2: Component Migration (Weeks 5-6)
**Order of migration (lowest to highest risk):**

1. **Admin-only pages** (week 5.0)
   - `/admin/tenant/branding` editor
   - `/admin/diagnostics`
   - Low traffic, easy to rollback

2. **Marketing pages** (week 5.5)
   - Landing page (`/`)
   - Pricing page (`/pricing`)
   - Higher traffic but not critical path

3. **Authenticated app** (week 6.0)
   - Dashboard
   - Group list
   - Expense forms

4. **Critical paths** (week 6.5)
   - Auth flows (signup/login)
   - Checkout/payment
   - Highest risk, migrate last

**Per-module checklist:**
- [ ] Replace `bg-primary` → `bg-interactive-primary`
- [ ] Remove inline `style={{...}}` props
- [ ] Add data-testid for E2E tests
- [ ] Run visual regression
- [ ] Deploy to staging, test 24h
- [ ] Feature flag rollout (10% → 50% → 100%)

### Phase 3: Cleanup (Week 7)
- Remove `applyBrandingPalette()` function
- Delete old CSS variable injection code
- Remove old Tailwind color mappings
- Archive `branding.ts` utilities (keep in git history)

**Rollback plan:**
- If new theming breaks: revert feature flag (instant)
- If catastrophic: git revert + redeploy (15 min)

## 5.6. Error Handling & Fallback Behavior

### Scenario 1: /api/theme.css returns 500
**Fallback chain:**
1. Service worker serves cached CSS (if available)
2. Inline base CSS keeps layout functional
3. Toast notification: "Theme temporarily unavailable, using cached version"
4. Retry after 30s (exponential backoff)
5. Log error to Sentry with tenant ID + hostname

**User impact:** Minimal - app loads with cached/base theme

### Scenario 2: Storage artifact missing (404)
**Root cause:** Hash exists in Firestore but CSS deleted from Storage

**Backend handling:**
1. `/api/theme.css` catches 404 from Storage
2. Triggers emergency regeneration (async)
3. Serves fallback `tenant_default.css` (always present)
4. Alert on-call engineer (PagerDuty)
5. Next request serves correct theme (regeneration complete)

**Prevention:** Cleanup job never deletes artifacts referenced in Firestore

### Scenario 3: Theme CSS exceeds size budget (>50KB)
**Validation:** `publishTenantTheme` rejects payload

**Response:**
```json
{
  "error": "THEME_TOO_LARGE",
  "message": "Generated CSS is 78KB, limit is 50KB",
  "suggestions": [
    "Reduce custom CSS length",
    "Remove unused font families",
    "Compress base64 assets"
  ]
}
```

### Scenario 4: Tenant has no branding configured
**Resolution:** Use `tenant_default` theme

**Backend:**
```typescript
const branding = tenantDoc.data()?.branding || DEFAULT_BRANDING;
```

### Scenario 5: WCAG contrast check fails
**Validation:** `publishTenantTheme` rejects

**Response:**
```json
{
  "error": "CONTRAST_FAILURE",
  "failures": [
    {
      "foreground": "#ffff00",
      "background": "#ffffff",
      "ratio": 1.07,
      "required": 4.5,
      "element": "Primary button text"
    }
  ]
}
```

**Admin UI:** Highlights failing combinations with suggested fixes

## 5.7. Storage Strategy Clarification
1. **Phase 1 (Weeks 1–2) – Local artifacts on purpose**
   - Implementation: `LocalThemeArtifactStorage` writes `{hash}.css` + `{hash}.tokens.json` under `tmp/theme-artifacts/{tenant}/{hash}` and never exposes `file://` URLs.
   - Scope: Emulator, developer builds, and early staging. Goal is to unblock API work and guarantee we can diff artifacts locally while verifying the pipeline with the two mandated sample tenants (`localhost`, `120.0.0.1`) plus the default fallback.
   - Guardrails: Same interface as the future Cloud Storage client, env flag (`THEME_STORAGE_IMPL=local|cloud`), and shared contract tests so the swap is mechanical.
2. **Phase 2 (Week 3+) – Cloud Storage cutover**
   - Swap in `CloudThemeArtifactStorage` built on the pre-provisioned `splitifyd-themes` bucket + CORS config. `/api/theme.css` streams or 302s to Storage, never leaking implementation details to callers.
   - Migration toggles on a per-env basis; once prod reads from Cloud Storage, delete local artifact folders from CI and rely on the CLI to fetch artifacts when debugging.
3. **Verification hooks**
   - Manual: `curl -H "Host: localhost" http://localhost:5001/.../api/theme.css` must return the localhost CSS; same command with `120.0.0.1` host header returns the loopback CSS; any other host returns the default CSS.
   - Automated: Contract tests assert both storage implementations produce identical filenames, metadata, and error semantics (e.g., missing artifact → regenerate fallback path).

## 6. Tooling, Guardrails & Governance
- **Phase 1 storage guardrail:** Documented above so nobody confuses the temporary local storage with a production shortcut; `/api/theme.css` is the *only* delivery surface even during Phase 1.
- **Linting:** Custom ESLint rule bans `style={{ color: '#...' }}` and non-semantic Tailwind utilities; Stylelint enforces variables inside plain CSS. CI fails on violations.
- **Token builders:** `@splitifyd/test-support` ships builders for tenant themes so unit tests stay deterministic.
- **Storybook/Playground:** Component showcase route consumes JSON fixtures and lets designers hot-swap tokens without emulator restarts.
- **Theme history & analytics:** Admin console displays publish history (hash, author, diffs) plus key metrics (contrast, generation time).
- **Observability:** Structured logs capture publish latency, artifact size, `/api/theme.css` cache hits, and hostnames served. Expose `/api/theme/diagnostics` for support teams.
- **Cleanup script:** Nightly job prunes orphaned artifacts (hashes not referenced by any tenant) after N days to control storage costs.

## 7. Implementation Roadmap (8 Weeks)
0. **Week 0.5 – Build/Test Hygiene (blocking before new work)**
   - Detangle `packages/test-support/src/ApiDriver.ts` from `firebase/functions` internals (move helpers into `@splitifyd/test-support` or `@splitifyd/shared`).
   - Delete the skipped duplicate admin tests and ensure coverage lives only once.
   - Track all new test files; `git status` must be clean before coding new features.
   - Validation: `npm run build --workspace firebase/functions` + `npm run test:unit --workspace firebase/functions -- admin-tenant-publish.test.ts`.
1. **Week 1 – Shared Foundations**
   - Ship `BrandingTokens` DTO + Zod schema in `@splitifyd/shared`.
   - Extend Firestore tenant schema + emulator seed with `tenant_localhost`, `tenant_loopback`, `tenant_default`.
   - Add lint/Stylelint rules banning inline colors and hex literals.
2. **Week 2 – Generator & Seed Themes**
   - Implement ThemeArtifactService + hashing + Storage upload + provenance logging.
   - Build `npm run theme:generate` CLI + `npm run theme:seed-local` to provision the three required local themes.
3. **Weeks 3–4 – HTTP Endpoints & Bootstrap**
   - Add `POST /api/admin/publishTenantTheme` with auth, validation, history, and notifications.
   - Implement `/api/theme.css` with tenant resolution, default fallback, and caching headers.
   - Update `webapp-v2/index.html`, service worker, and Tailwind config; land inline base CSS + diagnostics panel.
4. **Weeks 5–6 – UI Kit & Admin Console**
   - Rebuild core UI primitives + migrate top-tier pages (landing, auth, dashboard, group detail) to semantic utilities.
   - Implement TenantBrandingPage (editor, preview iframe, publish button, history list, rollback, diff view).
5. **Weeks 7–8 – Guardrails & Cleanup**
   - Add visual regression suite + smoke assertions for per-tenant styles.
   - Remove legacy theming code paths, wire observability dashboards, enforce artifact pruning, and finalize documentation.

## 8. Testing & Verification Strategy
- **Unit tests:**
  - ThemeArtifactService snapshot tests (CSS + tokens) across baseline, high-contrast, and failure cases.
  - Tenant resolution logic ensuring `localhost`, `120.0.0.1`, and fallback behave correctly.
- **Integration tests:**
  - Playwright flows that hit the app as each local tenant and verify key components inherit the correct CSS vars (e.g., CTA button colors, typography scale).
  - API tests for `/api/theme.css` validating caching headers, redirects, and fallback behavior.
- **Visual regression:** Triggered post-publish; compares hero pages per tenant against golden baselines. Failures block rollout.
- **Performance checks:** Monitor generation latency (<100 ms target), `/api/theme.css` P95 (<150 ms), and theme payload size (<15 KB gzipped).
- **Manual verification:** Use emulator-hosted sample tenants (localhost + loopback) to sign off on visual parity before merging large UI refactors.

## 9. Risks & Mitigations
- **Publish endpoint abuse** – Strict auth/roles + rate limiting + audit logging.
- **Theme drift via hardcoded styles** – Linting, codemods, and UI kit migrations enforced early in the roadmap.
- **Cache staleness** – Versioned query param (`?v=hash`) + immutable headers + SW cache invalidation keep clients synchronized.
- **Local mismatch** – CLI seeds + automated tests ensure local fixtures match production schema; docs spell out the two required themes.
- **Accessibility regressions** – Built-in contrast validator + Playwright axe checks before publish.
- **Storage bloat** – Scheduled cleanup + retention policy on orphaned hashes.

**Outcome:** A single, opinionated theming pipeline that combines Plan 2’s technical rigor with Plan 1’s governance and cleanup philosophy, removes unwanted Firestore triggers, supports deterministic local testing (localhost, 120.0.0.1, default), and guarantees every tenant sees a polished, brand-accurate UI delivered through clean, scalable, and testable code.

### 9.5. Detailed Rollback Procedures

#### Rollback 1: Bad Theme Publish (Single Tenant)
**Scenario:** Admin publishes theme with broken CSS

**Detection:**
- Visual regression tests fail
- Support ticket from tenant
- Monitoring alert (high error rate)

**Steps:**
1. **Identify:** Get tenant ID from ticket/alert
2. **Access:** Navigate to `/admin/tenant/{id}/branding`
3. **Review:** Click "Artifact History" tab
4. **Select:** Click previous working hash
5. **Rollback:** Click "Use This Version" button
6. **Verify:** Open tenant domain, confirm theme looks correct
7. **Notify:** Update support ticket, notify tenant

**Time:** <5 minutes  
**Risk:** Zero (just updating hash pointer)

#### Rollback 2: Broken /api/theme.css Endpoint
**Scenario:** Deploy breaks theme delivery endpoint

**Detection:**
- 500 errors in logs
- All tenants affected
- Site unusable

**Steps:**
1. **Revert deploy:** `git revert HEAD && git push`
2. **Trigger CI:** Wait for build (~5 min)
3. **Deploy:** Firebase deploy (~2 min)
4. **Verify:** Test 3 tenant domains
5. **Post-mortem:** Schedule review

**Time:** ~10 minutes  
**Impact:** All tenants use cached/fallback CSS during rollback

#### Rollback 3: UI Migration Breaks Critical Path
**Scenario:** Week 6 migration breaks checkout flow

**Detection:**
- Drop in conversions
- Playwright tests failing
- Customer complaints

**Steps:**
1. **Feature flag:** Set `NEW_THEMING_ENABLED=false` in Firebase Config
2. **Wait:** ~30s for config propagation
3. **Verify:** Test checkout flow
4. **Fix offline:** Debug in dev environment
5. **Re-enable:** When fix deployed + tested

**Time:** <1 minute  
**Risk:** Low (instant rollback via feature flag)

#### Rollback 4: Complete System Failure
**Scenario:** Everything is broken (nuclear option)

**Steps:**
1. **Remove `<link>`:** Revert commit that added theme CSS link to HTML
2. **Re-enable old code:** Uncomment `applyBrandingPalette()`
3. **Deploy:** Emergency deploy
4. **Investigate:** Why new system failed completely

**Time:** ~15 minutes  
**Risk:** High (back to old broken system)

**Prevention:** This should never happen if shadow mode (weeks 3-4) validates properly

## 10. Modern UI Overhaul Alignment
- **Parallel stream, shared contract:** The wholesale UI refresh described in `docs/modern_ui_ux_guide.md` runs alongside this theming program but depends on the same semantic tokens + `/api/theme.css` contract. Keep the programs loosely coupled: white-label owns the platform (tokens, artifacts, delivery); the modernization squad owns component/page redesigns.
- **Hand-offs & checkpoints:**
  1. Finalize the semantic token dictionary + CSS variable naming (Week 2) so modernization can design directly against it.
  2. Provide Storybook/Playground scenes that load the localhost + loopback themes via the new API, mirroring how real tenants will look.
  3. Share migration guides for UI primitives so both squads refactor buttons/cards once instead of diverging.
- **Shared acceptance tests:** Modern UI work must run the same manual host checks (`localhost`, `120.0.0.1`, default) to ensure stylistic changes respect tenant branding. Playwright visual regression baselines will include both the classic and modernized skins until the switch is complete.
- **Governance:** A joint weekly review (Theme Platform + Modern UI) confirms that component changes never bypass the semantic layer (no inline colors, no custom CSS per tenant). Any new design pattern must declare which semantic tokens it depends on before code review.
- **API contract doc:** Create `docs/white-labelling/theme-endpoint.md` during Week 2 describing `/api/theme.css` (request headers, caching, error cases). Treat it as the interface spec the Modern UI stream codes against so they stay unblocked even if the backend endpoint is still in flight.

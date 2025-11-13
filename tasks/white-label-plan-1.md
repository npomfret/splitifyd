# White-Label Plan 1
**Date:** 2025-11-13  
**Inputs:** `white-label-proposed-solutions-1.md`, `white label - Proposed Solutions 2.md`, Expert guidance (`.claude/ask-the-expert.sh`)  
**Principles:** No quick fixes, embrace large-scale refactor, single source of truth, deterministic delivery, tenant self-service, test-first validation.

---

## 1. What We Learned From the Two Proposals
| Topic | Proposal 1 Takeaways | Proposal 2 Takeaways | Expert Emphasis |
| --- | --- | --- | --- |
| Theme delivery | Option 1 (signals) only masks timing; Option 2 introduces server-generated CSS plus ESLint/UI cleanup; Option 3 outlines a phased UI rebuild. | Locks in Firestore design tokens → backend artifact generator → `/api/theme.css` bootstrap. | Double down on content-hashed artifacts + render-blocking `<link>` to eliminate FOUC and fall back only to minimal inlined defaults. |
| Token source of truth | Mentions design tokens but not canonical schema. | Explicit branding object per tenant with defaults. | Define DTO + Zod schema in `@splitifyd/shared`; no component reads Firestore directly. |
| Caching & hosting | Mentions CDN/ETag loosely. | Hash artifacts, store in Storage, 302 redirect via Functions. | Add immutable cache headers + service-worker caching; ensure dev/emulator parity and offline resiliency. |
| Developer ergonomics | Proposes lint rules, component showcase, typography system. | Tailwind variable mapping, cleanup sprints. | Provide local generator script + Storybook decorator so changes don’t require deploys. |
| Governance & guardrails | Suggests ESLint + phased cleanup. | Calls out audit, UI primitive rebuild, diagnostics endpoint. | Add admin branding UI with validation, automated contrast checks, visual-regression gate before publish. |

**Decision:** Use Proposal 2 as the architectural spine, enrich it with Proposal 1’s UI/system refactors, and integrate the Expert’s risk mitigations (performance profiling, caching, local tooling, guardrails).

---

## 2. Final Architecture & Guardrails
### 2.1 Shared Branding Schema
- Define `BrandingTokens` DTO and Zod schema inside `packages/shared/src/branding/` with sections for palette, semantic roles, typography, spacing scale, radii, shadows, assets, legal copy.
- Firestore `tenant` document embeds `branding: BrandingTokens` plus `themeArtifactHash`.
- Builder utilities (`@splitifyd/test-support`) generate deterministic sample themes for tests and previews.

### 2.2 Theme Artifact Generator
- Implementation: Dedicated Firebase Function (or Cloud Run job if perf requires) `generateTenantThemeArtifacts`.
- Inputs: validated tokens + template metadata (version, tenant slug).
- Outputs:
  1. `theme.css` — concrete values + CSS variables + Tailwind semantic class overrides.
  2. `theme.tokens.json` — stored for diagnostics.
- Content hash (SHA-256) acts as artifact ID, persisted on tenant doc.
- Instrument using `firebase/functions/src/monitoring/PerformanceTimer` to ensure generation <100ms typical, alarm at 500ms.

### 2.3 Delivery & Caching
- **Endpoint:** `/api/theme.css` resolves tenant via domain middleware, looks up `{hash}`, sets `Cache-Control: public, max-age=31536000, immutable`, and streams Storage asset (direct 200 in prod, signed URL in dev if needed).
- **Client bootstrap:** `webapp-v2/index.html` includes `<link rel="preload stylesheet" href="/api/theme.css?v={hash}">` as the first blocking resource. Service worker precaches the last good CSS and tokens for offline reloads.
- **Fallback:** Inline a 1KB “safety” stylesheet (neutral neutral palette, system font) to avoid blank screens if `/api/theme.css` fails; show toast with retry CTA via `themeStore`.
- **Versioning:** Keep `/api/theme/v1.css` namespaced so schema changes can coexist.

### 2.4 Frontend Consumption & UI Refactor
- Tailwind config maps semantic tokens (`colors.brand.primary = 'var(--color-brand-primary)'`, etc.); remove inline styles and DOM hacks.
- Refresh `components/ui` primitives (Button, Card, Modal, Input, Alert, Text, Stack/HStack/Grid) to consume semantic classes only.
- Add `ThemeDiagnosticsPanel` toggled in dev/admin to display current hash, token snapshot, and computed CSS variable map.
- Enforce no raw color/font usage via ESLint + Stylelint rules (`no-hex-literals`, `no-inline-style`) plus custom codemod checks in CI.
- Build a component showcase route backed by generated tokens to validate themes quickly.

### 2.5 Tenant Self-Service & Guardrails
- **Branding Console:** `TenantBrandingPage` with form-driven editor, live preview iframe powered by locally generated CSS, and publish workflow.
- **Validation:** Server-side Zod enforcement + accessibility (contrast ratio) checks; reject invalid combinations with actionable errors.
- **Publishing flow:** Draft → preview snapshot → “publish” triggers generator, stores artifacts, runs automated visual regression suite for critical pages. Failures revert to previous hash and notify tenant/admin.
- **Documentation:** Extend `docs/guides/branding.md` (new) to explain tokens, constraints, and recommended asset specs.

### 2.6 Local & Emulator Tooling
- CLI `npm run theme:generate -- --tenant demo` invokes the same generator locally and writes to `tmp/themes/{tenantId}.css` for rapid iteration.
- Emulator middleware serves local artifacts if present, falling back to real generator otherwise.
- Storybook/Playground decorator that swaps between JSON token fixtures without restarts to preview components in isolation.

---

## 3. Implementation Roadmap (No Quick Fixes)
1. **Foundation (Week 1)**
   - Add shared token schema + builders.
   - Extend Firestore tenant schema + backfill defaults.
   - Land lint/Stylelint rules banning inline/hex usage.
2. **Generator & Endpoint (Week 2)**
   - Implement generator function + hashing + Storage persistence.
   - Ship `/api/theme.css` v1 with caching + diagnostics logging.
   - Create local CLI + emulator shim.
3. **Frontend Bootstrap & UI Kit (Weeks 3-4)**
   - Wire render-blocking link + fallback inline CSS + service-worker caching.
   - Update Tailwind config and rebuild UI primitives + layout components.
   - Add component showcase + ThemeDiagnostics panel; migrate high-traffic screens (auth, dashboard, group detail).
4. **Tenant Console & Guardrails (Weeks 5-6)**
   - Build branding admin UI with live preview + validation.
   - Add automated contrast + asset checks, publish workflow, and CI visual regression gate.
   - Document process + provide sample token packs for tenants.
5. **Cleanup & Rollout (Weeks 7-8)**
   - Remove legacy `applyBrandingPalette` paths, deprecated CSS variables, and DRY up residues.
   - Monitor PERF metrics (generation latency, cache hit ratio, theming load errors) and iterate.

---

## 4. Testing & Verification Strategy
- **Unit:** Snapshot tests for generator (CSS + token JSON) across baseline + edge-case themes; builders ensure deterministic fixtures.
- **Integration:** Playwright suite spins up emulator tenant, loads app, and asserts computed styles (buttons, cards, typography, spacing). Include contrast/accessibility assertions.
- **Visual Regression:** On publish, capture golden screenshots per page per key theme; block deploy if diffs exceed tolerance.
- **Linting:** ESLint + Stylelint rules in CI to block inline styles/hex values; custom script ensures every component imports tokens/Tailwind classes only.
- **Performance:** Monitor generation latency + `/api/theme.css` response times; alert if >300ms P95 or cache hit rate <95%.

---

## 5. Risks & Mitigations
- **Generator cold starts or heavy load:** Mitigate via Cloud Run option, warmup pings, and perf instrumentation.
- **Theme drift via hardcoded values:** Enforced by lint rules, codemods, and component audits during cleanup sprints.
- **FOUC/offline failures:** Render-blocking link + inline base CSS + service-worker caching + retry UX.
- **Tenant misconfiguration:** Strong validation, contrast checks, preview-before-publish, automated regression gating.
- **Developer friction:** Local generator, Storybook decorator, diagnostics UI, and comprehensive docs ensure fast iteration.

---

**Outcome:** A clean, fully deterministic white-label system where every tenant’s look-and-feel is defined once (tokens), generated reliably (artifacts), delivered efficiently (hashed CSS + caching), consumed consistently (Tailwind + UI kit), and guarded by tooling, validation, and tests. This unlocks scalable branding without hacks or repeated CSS experiments.

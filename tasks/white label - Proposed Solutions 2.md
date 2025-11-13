White-Label Theming – Proposed Solutions (v2)
===========================================

Objective
---------
Give every tenant a deterministic, cache-friendly way to control the full look-and-feel (colors, typography, spacing, radii, assets) without brittle client hacks or repeated CSS experiments.

Key Principles
--------------
1. Single source of truth: Firestore stores a validated `branding` design-token object per tenant; defaults ensure partial configs never break rendering.
2. Deterministic generation: a backend builder renders concrete CSS + JSON artifacts from those tokens, hashes the payload, and stores immutable files for fast CDN delivery.
3. Bootstrap-first loading: the webapp fetches `/api/theme.css` before Preact mounts so there is no FOUC and no reliance on rerenders to pick up new variables.
4. Ergonomic authoring: Tailwind utility classes are mapped to CSS custom properties exported by the generated stylesheet, so developers still write `bg-primary`, `font-heading`, etc.
5. Testability: Playwright/Vitest suites spin up tenants with known tokens and assert computed styles, proving that each domain picks up the correct theme end-to-end.

Proposed Architecture
---------------------
### 1. Firestore Schema
- Extend `tenantSchema` with `branding` → `colors`, `typography`, `spacing`, `borderRadius`, `assets`, `legal`.
- Use branded types shared via `@splitifyd/shared` so both backend + frontend speak the same DTOs.
- Provide defaults for every token (e.g., Indigo/Violet palette, Inter/Montserrat fonts) to keep new tenants functional immediately.

### 2. Artifact Generation Pipeline
- Cloud Function (or emulator hook) listens to tenant branding changes.
- `generateTenantThemeArtifacts(branding)` outputs:
  - `theme.css`: concrete values + CSS vars (`--color-primary`, etc.) plus Tailwind override classes and safe body defaults.
  - `theme.tokens.json`: serialized tokens for runtime diagnostics/tests.
- Hash the CSS contents (MD5/SHA1) and write to Storage under `themes/{tenantId}/{hash}.css`; same for JSON.
- Record `{hash}` on the tenant doc so the router knows which artifact is current.

### 3. Delivery Endpoint
- Add `/api/theme.css` route in Firebase Functions:
  - Uses existing domain→tenant middleware.
  - Looks up latest hash + Storage bucket path.
  - Responds with 302 to the signed-but-public Storage URL (or streams directly) and emits cache headers (`max-age=300` dev, `max-age=3600` prod) plus `ETag` support.
- Because artifacts are content-addressed, CDN/browser caching stays valid until branding changes.

### 4. Frontend Consumption
- Insert `<link rel="stylesheet" id="tenant-theme" href="/api/theme.css">` inside `webapp-v2/index.html` head to guarantee early load.
- Keep a tiny `loadTenantCSS()` helper for SPA-only refreshes if config reloads at runtime.
- Update `tailwind.config.js` to map `colors.primary = 'var(--color-primary)'`, etc., and rely on semantic utility classes; remove inline style experiments from components like `Card`.
- Optional: expose hydrated tokens via `configStore` for analytics/logging, but rendering relies solely on CSS.

### 5. Testing & Tooling
- Add unit tests for the generator (snapshot CSS per token set).
- Extend Playwright suites to provision a tenant with distinctive colors/fonts and assert computed styles on representative elements (buttons, cards, headings, body background).
- Update the Tenant Admin UI to edit the richer token object with live previews that read from the generated CSS.

Rollout Plan
------------
1. Land schema + DTO updates and migrate current tenants to the new structure with defaults.
2. Ship backend generator + `/api/theme.css` route; shadow-load the stylesheet while keeping legacy CSS variables for one release.
3. Flip Tailwind + component styling to the new tokens, then remove legacy `applyBrandingPalette` code once E2E coverage is green.
4. Monitor cache hit rates + theming metrics; iterate on additional tokens (shadows, transitions) after the core experience is stable.

UI Refactor & Cleanup Suggestions (No Quick Fixes)
--------------------------------------------------
- Run a design-token audit: inventory every hard-coded color/font/spacing usage in `webapp-v2` and map it to the new token set before cutting over. Refuse ad-hoc overrides—either the token exists or we add it formally.
- Consolidate UI primitives: rebuild `components/ui/*` so every surface (Card, Button, Alert, Modal, Input) consumes Tailwind utilities that reference the tenant tokens; delete bespoke per-feature styling layers after migration.
- Normalize typography & spacing: introduce layout primitives (Stack, Cluster, Grid) that encode tenant-aware spacing scales and ensure all headings/body text go through shared `Text` components tied to tokenized font families/sizes.
- Centralize assets: route favicon/logo/background imagery through the same branding object + artifact pipeline so domains never drift (no inline `<img>` fallbacks); admin panel should preview exactly what ships.
- Improve observability: add theming diagnostics (`/api/theme.debug` or UI devtools panel) that dumps resolved tokens + CSS URL so QA can verify without inspecting DOM hacks.
- Schedule phased cleanup sprints (webapp + admin) where we rip out legacy CSS variable helpers, inline styles, and redundant Tailwind configs; treat each sprint as a module refactor (auth, dashboard, group detail, admin) to keep scope manageable while still landing the full redesign.

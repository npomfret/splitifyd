# Modern UI Overhaul & Dual-Tenant Theme Plan
**Date:** 2025-11-15  
**Scope:** Total visual redesign + multi-tenant showroom (localhost = “Slick Aurora”, 127.0.0.1 = “Boring Default”)  
**Constraints:** We may change anything. Focus on code deliverables, no legacy compatibility.

---

## Vision
- **Default tenant (127.0.0.1)** – intentionally bland, grayscale, low-contrast UI to highlight the delta from the premium theme. Serves as functional baseline and fixtures for regression tests.
- **Slick tenant (localhost)** – cinematic glassmorphism using Modern UI guide: layered aurora background, fluid typography via `clamp()`, 3D cards with motion/lighting, vibrant accent gradients, micro-interactions.
- **Outcome:** Every surface, control, and layout uses the new semantic tokens. The app becomes a design showcase rather than a utilitarian dashboard.

---

## Theme Foundations
1. **Branding token rewrite (`packages/shared/src/fixtures/branding-tokens.ts`):**
   - Replace existing palettes with:
     - `default`: monochrome neutrals (`#f4f4f5`, `#a1a1aa`, `#18181b`) + flat typography (Inter only), muted shadows.
     - `localhost`: neon teal/purple palette, expressive typography mix (Space Grotesk + Geist Mono), high-radius geometry, atmospheric shadows.
   - Encode extra semantic slots: `surface-glass`, `surface-aurora`, `text-hero`, `interactive-ghost`, `gradient-primary`.
   - Ensure schema coverage by extending `BrandingTokensSchema` only if absolutely necessary; prefer mapping to existing semantic buckets first.
2. **Seeder updates (`firebase/scripts/publish-local-themes.ts` + fixtures in Firestore emulator data):**
   - Tenants:
     - `tenant_loopback` → boring theme (primary domain `127.0.0.1`, alias `::1`, flagged as `defaultTenant: true`).
     - `tenant_localhost` → slick theme (primary `localhost`, aliases `localhost.local`, `splitifyd.test`).
   - Remove unused third tenant to reduce maintenance; script only publishes these two loads.
   - Document expectation inside Phase 3 progress in `tasks/white-label-plan-1.md` once implemented.

---

## Frontend Redesign Plan
### 1. Global Shell
- Implement aurora/glass background in `webapp-v2/src/app/app.css` using pseudo-elements + `@layer` overrides. Utilize tokens for colors (`surface.glass`, `surface.overlay`) and define animation keyframes per guide §1.2.
- Add theme badge component showing `{tenantId} · hash` (pull from `configStore.config?.tenant` + `config.theme.hash`) to ease QA.

### 2. Primitive Kit Rebuild
- **Surfaces/Card/Modal:** Rebuild with frosted glass, border gradients, and depth tokens. Provide props for “muted” (default tenant) vs “vivid” (slick) rendering so theme toggles feel intentional.
- **Buttons & Inputs:** Adopt floating-label inputs, ghost buttons, icon-buttons. Use CSS vars for states (hover, pressed) and `outline-offset` focus rings.
- **Typography system:** Map semantic slots to `clamp()`-based font sizes. Introduce eyebrow + display components referenced from tokens.

### 3. Layouts & Pages
- **Auth Flow:** Re-stage login/register with split panels (copy + form), hero visuals using `tokens.assets.heroIllustrationUrl`. Add microcopy + animated gradient lines for slick theme; default theme stays monochrome.
- **Dashboard:** Replace legacy cards with timeline + KPI tiles (sparkline placeholders). Build reusable “AuroraPanel” for slick tenant; degrade to simple gray cards for default.
- **Group Detail & Forms:** Re-compose headers, tab navigation, tables using new primitives. Add contextual shadows + highlight chips for statuses.
- **Settings/Admin:** Apply same primitives to modals/forms; ensure admin diagnostics show theme metadata.

### 4. Motion & Micro-interactions
- Use `prefers-reduced-motion` guard but default to:
  - Soft parallax on hero card
  - Button hover translation + glow
  - Section entrance animations triggered via Intersection Observer (abstracted hook).

---

## Testing & POM Alignment
1. **Component hooks:** Add `data-testid` attributes sparingly (loading spinners, layout toggles, nav anchors). Favor role/text selectors elsewhere.
2. **POM audit (`packages/test-support/src/page-objects`):**
   - Replace any residual `.bg-*`/`.text-*` selectors with `getByRole`, `getByText`, or new anchors.
   - Update constructors to assert tenant badge text when relevant to ensure we’re on the expected host/theme.
3. **Playwright smoke tests:**
   - Refresh `theme-smoke.test.ts` fixtures with new RGB triplets for both tenants.
   - Add assertions for aurora background + glass surfaces (e.g., check computed blur/backdrop-filter via JS) to prevent regressions.
4. **Runbook note:** Document `webapp-v2/run-test.sh theme-smoke` usage + host requirements in plan doc once coded.

---

## Execution Order
1. **Tokens & Seeder**
   - Update fixtures → regenerate artifacts via `npm run tsx firebase/scripts/publish-local-themes.ts`.
   - Smoke test via browser (localhost vs 127.0.0.1) to capture screenshots for reference.
2. **Primitive kit refactor**
   - Tackle `components/ui` primitives first.
   - Update shared layout wrappers (`App.tsx`, `Layout.tsx`, `Header`, `Sidebar`).
3. **Page rewrites**
   - Auth → Dashboard → Group Detail → Admin areas.
   - After each page cluster, update relevant Playwright POM + targeted integration test (use `webapp-v2/run-test.sh <file>`).
4. **Motion polish + QA**
   - Add global motion tokens (duration, easing).
   - Ensure `prefers-reduced-motion` fallback.
5. **Docs & tracking**
   - Append progress entries to `tasks/white-label-plan-1.md` after each major milestone (tokens, primitives, pages).

---

## Open Questions / TODO to Clarify with Stakeholders
- Do we want to surface tenant theme selection inside the UI (e.g., toggle) for demos? (default assumption: no, host-based only).
- Should the slick theme ship with alternative font assets self-hosted or rely on third-party CDNs? (Prefer self-host once design is approved.)
- Any accessibility color contrast constraints beyond WCAG AA? (Plan assumes high contrast even for neon theme; verify with actual palettes.)

Once this plan is approved, we proceed with token/seeder work immediately, then iterate through the execution order.


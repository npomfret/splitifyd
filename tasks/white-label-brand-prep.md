# White-label Brand Prep Notes

## Current Status

**Phases 1-5 Complete ✅**
- Tenant types and configuration infrastructure
- Domain-based tenant identification middleware
- Firestore tenant registry with fallback support
- Frontend dynamic branding (logos, colors, favicon)
- Feature flags and conditional routing

**Next: Phase 6 - Tenant Admin Panel 🔄**
- Build internal UI for managing tenant configuration
- Branding editor, domain management
- Backend APIs under `/settings/tenant` prefix

## Ideas
- Centralize tenant branding (name, palette, logos, marketing flags) in a dedicated descriptor that both web and functions read, so swapping tenants is a config change rather than a code edit.
- Gate marketing routes/components behind descriptor toggles and default `ROUTES.HOME` to login or dashboard when the landing page is disabled.
- Feed brand palettes into `themeStore` and `USER_COLORS` so avatars, buttons, and decorative accents stay on-theme without duplicating colour logic.
- Keep legal copy centralized; tenants adopt Splitifyd policies so no per-tenant overrides are required.
- Introduce branded primitive types for all tenant configuration fields to ensure strong typing across the stack.

## Questions
- Where should tenant brand data live (Firebase Remote Config, Firestore document, build-time env, etc.) and who owns updates?
- Are there constraints on acceptable colour palettes (contrast requirements, light/dark variants) that we must validate before applying runtime themes? *(Answered: no enforced guardrails for MVP; tenants supply palettes as-is.)*

## Decisions
- Legal documents remain Splitifyd-owned and global; white-label tenants accept the shared policies without customization.
- All white-label tenants share a single Firebase project and Functions instance.
- Tenant identification will resolve from the request host via a cached domain→tenant registry, with guarded `DEFAULT_TENANT_ID` and non-production `x-tenant-id` overrides for localhost/testing.
- White-label partners host their own marketing, landing, and pricing experiences; Splitifyd controls the application from login onward, with a demo tenant reusing the existing public pages.
- Initial rollout ships without automated accessibility guardrails on tenant-provided colour palettes; compliance remains a manual review responsibility.
- Tenant branding metadata persists in Firestore (one document per tenant) with asset uploads stored in Cloud Storage; edits flow through a simple management UI.
- Provide a guarded default tenant configuration (mirroring the demo/showroom branding) for development and unrecognized hosts, while unknown production domains fail closed.
- Firestore-backed tenant registry resolves request hosts to tenant configs via middleware, with cached lookups and dev-only override/default fallbacks feeding the `/config` endpoint.
- Added a safety integration test exercising `/config` and `/health` to confirm the tenant fallback flows without requiring Firestore seed data.

## Progress
- Exported shared tenant/app configuration schemas so both Functions and the webapp enforce the branded Phase 1 types.
- Re-pointed Functions config validation (with unit coverage) at the shared schema to accept tenant payloads and reject incomplete Firebase client configs.
- Introduced the tenant-identification middleware (plus route exemption list) so the Express pipeline resolves host, override, and fallback flows before handing off to `/config`.
- Added Vitest coverage for domain, override, fallback, and error paths to lock in the identification behaviour.
- Routed `/config` through cloned tenant configs so requests without Firestore data still receive the hardcoded fallback, with unit tests guarding both the fallback and custom-tenant paths.
- Webapp now hydrates tenant branding on load—config store pushes palettes/favicons into the DOM and theme store mirrors tenant colours—backed by unit tests.
- Header swaps the logo/button label using tenant branding so white-label tenants see their assets without code changes.
- Feature-flag utilities (hooks + `FeatureGate`) now gate browser/admin routes and marketing pages per tenant config, with unit tests verifying signal-driven updates.
- Footer marketing links honour tenant marketing flags, hiding pricing funnels when disabled and covered by unit tests.
- Landing page marketing sections (features grid + CTA) now respond to tenant marketing flags so white-label tenants avoid Splitifyd promo content, with dedicated unit coverage.
- Functions config integration tests now assert marketing flags (including showMarketingContent) propagate for default and override tenants.

**Phase 5 Feature Flags & Conditional Routing (Complete):**
- Root route (`/`) now uses clear `getRootRouteComponent()` logic to conditionally show landing page or redirect to dashboard/login based on `showLandingPage` flag and auth state.
- Pricing route (`/pricing`) conditionally rendered based on `showPricingPage` flag.
- Browser routes (`/browser/users`) feature-gated with `enableAdvancedReporting` flag.
- Improved route organization with section comments distinguishing marketing pages from legal pages.
- All existing tests (497 total: 193 unit + 304 integration) passing with conditional routing logic.
- Added comprehensive integration test suite for root route conditional rendering (6 tests in `root-route-conditional.test.ts`):
  - Landing page display for authenticated and unauthenticated users when `showLandingPage: true`
  - Dashboard redirect for authenticated users accessing protected routes
  - Login redirect for unauthenticated users accessing protected routes
  - Feature-gated routes (`/browser/users`) when `enableAdvancedReporting: true`
  - Pricing page conditional rendering (shows 404 when `showPricingPage: false`)
- Test coverage now: 503 total tests (193 unit + 310 integration), all passing.

## Agent's Ideas (Based on App Analysis)

*   **Extend `AppConfiguration` in `@splitifyd/shared`:**
    *   Introduce a `BrandingConfig` interface to hold `appName`, `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, and `marketingFlags` (e.g., `showLandingPage`, `showPricingPage`).
    *   Introduce a `FeatureConfig` interface for toggling specific features per tenant (e.g., `enableAdvancedReporting`).
    *   Integrate these new configurations into the existing `AppConfiguration` interface.
*   **Backend Configuration Source (Recommendation: Firestore Document per Tenant):**
    *   Create a `tenants` Firestore collection where each document represents a tenant and stores their `BrandingConfig` and `FeatureConfig`.
    *   Modify the `getAppConfig()` function in `firebase/functions/src/client-config.ts` to fetch the relevant tenant document based on the identified tenant ID.
*   **Frontend Implementation:**
    *   **Dynamic Theming:** Use CSS variables for colors, dynamically applying them based on `branding.primaryColor` etc., from the fetched `AppConfiguration`. Tailwind CSS can consume these variables.
    *   **Conditional Rendering & Routing:** Use `branding.marketingFlags` to conditionally render marketing components or redirect routes using `preact-router`.
    *   **Dynamic Legal Pages:** Continue using the existing policy endpoints that serve Splitifyd's global terms, privacy, and cookie policies.

## Agent's Questions (Based on App Analysis)

1.  **Tenant Identification:** How will the application identify the current tenant? (e.g., subdomain, custom domain, query parameter, user's organization ID after login). This is the most crucial decision for the architecture. *(Answered: resolve via request host mapped through the tenant registry, with localhost/test overrides guarded.)*
2.  **Configuration Storage:** What is the preferred approach for storing tenant-specific branding and configuration? (Firestore document per tenant, Firebase Remote Config, or a combination?) *(Answered: brand metadata lives in Firestore with asset references in Cloud Storage, managed through a lightweight UI.)*
3.  **Deployment Strategy:** Will each white-label instance be a separate Firebase project, or will multiple tenants share a single Firebase project? This impacts how tenant data and configurations are isolated and managed. *(Answered: all tenants live in the same Firebase project/Functions instance.)*
4.  **Admin Interface for Tenants:** Will there be an admin interface for white-label partners to manage their branding and configurations, or will this be a manual process (e.g., updating Firestore documents directly)? *(Answered: build a basic management UI that writes to Firestore/Cloud Storage; scope can remain internal for MVP.)*
5.  **Color Palette Constraints:** Are there any specific constraints on acceptable color palettes (e.g., contrast requirements, light/dark variants) that we must validate before applying runtime themes? *(Answered: none for MVP; accessibility reviews remain manual.)*
6.  **Marketing Landing Pages:** Should each tenant expose a marketing landing page, or do some embed the app within an existing site and only need the authenticated views? *(Answered: partners own landing/pricing surfaces; we manage the app from login onward and keep a demo tenant on the existing marketing pages.)*

---

## Detailed Analysis & Implementation Roadmap

### Key Strengths
- **Dynamic Theming System**: 16 predefined color palettes with WCAG contrast ratios already in `packages/shared/src/user-colors.ts`
- **CSS Variables**: Comprehensive theme system using CSS custom properties (`--theme-primary`, `--theme-primary-light`, etc.) in `webapp-v2/src/styles/global.css`
- **Strong Type System**: 34,859 lines of TypeScript with Zod validation throughout
- **Configuration Infrastructure**: Environment-based config system in `firebase/functions/src/client-config.ts` with lazy loading
- **Dynamic Legal Content**: Policies stored in Firestore (not hardcoded), with version tracking and user acceptance flows

### Next: Phase 6 - Tenant Admin Panel

#### Palette Validation (shared infra)

- Collect a single primary colour from tenants; plan to generate hover/active states by adjusting HSL lightness (≈−10% hover, −15% active) and validate each variant automatically.
- Normalise colours to uppercase hex (no alpha) and map them onto semantic roles (primary, secondary). Keep success/error/warning palettes system-owned to avoid tenant clashes.
- Validate contrast server-side with `culori` (or similar) and enforce WCAG 2.1 AA (≥4.5:1 for normal text, ≥3:1 for large text/icons) against both light (`#ffffff`) and dark (`#111827`) surfaces. If a generated state fails, either adjust text colour (black/white) or reject with a clear error—automatic tweaks are optional stretch goals.
- Persist computed metadata (`contrastWithLight`, `contrastWithDark`, `relativeLuminance`, generated hover/active swatches) alongside the raw colours so the client can apply them without recomputation.
- Detect potential hue clashes between tenant primary colours and system status palettes; surface warnings and recommended adjustments when the delta is too small.
- Client still guards against missing/undefined branding by defaulting to the fallback tenant config before applying CSS variables.

#### Branding Assets & Admin UX

- Logos: prefer SVG; enforce transparent backgrounds, guard aspect ratio with cropping or padded containers, and cap raster uploads (≤1 MB) to protect performance.
- Admin previews should offer live contrast "Pass/Fail" badges, component previews, and automated warnings for inaccessible combinations.

#### Admin Panel Scope

**Scope**
- Internal-only for MVP; expose via guarded routes under `webapp-v2/src/pages/admin/`.
- Requires `tenant-admin` or higher role; leverage existing auth middleware to gate access.

**Core modules**
1. **Branding Editor**
   - Upload logo (SVG preferred) with aspect-ratio guard and transparent background checks.
   - Pick primary colour; live preview applies generated hover/active states and shows contrast “Pass/Fail”.
   - Manage additional assets (favicon, marketing toggles).

2. **Domain Management**
   - List mapped domains, show verification status (CNAME/SSL provisioning).
   - Provide copy-ready DNS instructions for new domains; expose "showroom" preview link.

**Implementation notes**
- Build forms with shared validation schema (`zod`) so the same rules run server-side.

**Backend/Frontend interface**
- **APIs (new endpoints under `/settings/tenant`)**
  - `GET /settings/tenant` → returns current tenant config and domain info
  - `PUT /settings/tenant/branding` → updates branding; payload validated via shared schemas
  - `GET /settings/tenant/domains` / `POST /settings/tenant/domains` → enumerate/add domains, trigger verification workflow
  - All routes require auth middleware that enforces `tenantId` + `tenant-admin` custom claim; rate-limit mutations

- **Frontend structure**
  - Add guarded routes under `/settings/tenant` (`/settings/tenant/branding`, `/settings/tenant/domains`) that lazy-load module pages
  - Tenant settings layout component pulls `/settings/tenant` on mount, provides context store for child tabs
  - Use shared form components with inline validation + live preview, wiring submissions to the corresponding API endpoints

### Implementation Timeline

| Phase | Status | Effort | Risk |
|-------|--------|--------|------|
| Phase 1: Types | ✅ Complete | Low | Low |
| Phase 2: Tenant ID | ✅ Complete | Low | Medium |
| Phase 3: Config Storage | ✅ Complete | Medium | Low |
| Phase 4: Frontend Branding | ✅ Complete | Low | Low |
| Phase 5: Feature Flags | ✅ Complete | Medium | Low |
| Phase 6: Admin Panel | 🔄 Next | Medium | Low |

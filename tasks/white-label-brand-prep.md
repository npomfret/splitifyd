# White-label Brand Prep Notes

## Ideas
- Centralize tenant branding (name, palette, logos, marketing flags) in a dedicated descriptor that both web and functions read, so swapping tenants is a config change rather than a code edit.
- Gate marketing routes/components behind descriptor toggles and default `ROUTES.HOME` to login or dashboard when the landing page is disabled.
- Feed brand palettes into `themeStore` and `USER_COLORS` so avatars, buttons, and decorative accents stay on-theme without duplicating colour logic.
- Keep legal copy centralized; tenants adopt Splitifyd policies so no per-tenant overrides are required.

## Questions
- Where should tenant brand data live (Firebase Remote Config, Firestore document, build-time env, etc.) and who owns updates?
- Are there constraints on acceptable colour palettes (contrast requirements, light/dark variants) that we must validate before applying runtime themes?
- Should each tenant expose a marketing landing page, or do some embed the app within an existing site and only need the authenticated views?

## Decisions
- Legal documents remain Splitifyd-owned and global; white-label tenants accept the shared policies without customization.

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

1.  **Tenant Identification:** How will the application identify the current tenant? (e.g., subdomain, custom domain, query parameter, user's organization ID after login). This is the most crucial decision for the architecture.
2.  **Configuration Storage:** What is the preferred approach for storing tenant-specific branding and configuration? (Firestore document per tenant, Firebase Remote Config, or a combination?)
3.  **Deployment Strategy:** Will each white-label instance be a separate Firebase project, or will multiple tenants share a single Firebase project? This impacts how tenant data and configurations are isolated and managed.
4.  **Admin Interface for Tenants:** Will there be an admin interface for white-label partners to manage their branding and configurations, or will this be a manual process (e.g., updating Firestore documents directly)?
5.  **Color Palette Constraints:** Are there any specific constraints on acceptable color palettes (e.g., contrast requirements, light/dark variants) that we must validate before applying runtime themes?
6.  **Marketing Landing Pages:** Should each tenant expose a marketing landing page, or do some embed the app within an existing site and only need the authenticated views?

---

## Detailed Analysis & Implementation Roadmap

### Overall Readiness: 5.5/10

Splitifyd has **excellent technical foundations** (strong types, modular architecture, dynamic theming) but requires **critical architectural decisions** before white-label deployment.

### Key Findings

#### Strengths
- **Dynamic Theming System**: 16 predefined color palettes with WCAG contrast ratios already in `packages/shared/src/user-colors.ts`
- **CSS Variables**: Comprehensive theme system using CSS custom properties (`--theme-primary`, `--theme-primary-light`, etc.) in `webapp-v2/src/styles/global.css`
- **Strong Type System**: 34,859 lines of TypeScript with Zod validation throughout
- **Configuration Infrastructure**: Environment-based config system in `firebase/functions/src/client-config.ts` with lazy loading
- **Dynamic Legal Content**: Policies stored in Firestore (not hardcoded), with version tracking and user acceptance flows

#### Critical Gaps (BLOCKERS)

1. **No Tenant Identification Mechanism** (CRITICAL)
   - Current system has instance modes (`dev1`-`dev4`, `prod`) but these are for environments, not tenants
   - No middleware to detect tenant from subdomain, domain, or user context
   - **Impact**: Cannot route requests to tenant-specific configurations

2. **No Data Isolation Strategy** (CRITICAL)
   - Single Firebase project with no tenant-scoped data
   - All Firestore documents lack `tenantId` field
   - Security rules don't enforce tenant boundaries
   - **Impact**: Data leakage risk between tenants

3. **Hardcoded Branding**
   - Logo: `webapp-v2/src/components/layout/Header.tsx:64` loads `/images/logo.svg`
   - App name "Splitifyd": 8 references across webapp files
   - Favicon: Not configurable
   - **Impact**: Requires code changes to rebrand

4. **No Feature Flag System**
   - Cannot toggle features per tenant (e.g., landing pages, advanced reporting)
   - All tenants get identical functionality
   - **Impact**: Cannot offer tiered features or A/B test

5. **Groups ≠ Organizations (Future consideration)**
   - Current "groups" are expense groups, not tenant-level org units
   - For MVP we can equate “tenant” with “organization”; revisit hierarchy only when multiple orgs per tenant becomes a real requirement

### Specific Implementation Plan

#### Phase 1: Extend Core Types (Week 1-2)

**File: `packages/shared/src/shared-types.ts`**

Add new branded types:
```typescript
export type TenantId = string;
export type OrganizationId = string;

export interface TenantConfig {
    tenantId: TenantId;
    branding: BrandingConfig;
    features: FeatureConfig;
    createdAt: ISOString;
    updatedAt: ISOString;
}

export interface BrandingConfig {
    appName: string;                    // e.g., "Acme Splitter"
    logoUrl: string;                    // Firestore Storage URL
    faviconUrl: string;                 // Firestore Storage URL
    primaryColor: string;               // Hex color
    secondaryColor: string;             // Hex color
    themePalette: ColorPalette;         // One of the 16 existing palettes
    customCSS?: string;                 // Advanced: custom CSS overrides
    marketingFlags: {
        showLandingPage: boolean;
        showPricingPage: boolean;
        showBlogPage: boolean;
    };
}

export interface FeatureConfig {
    enableAdvancedReporting: boolean;
    enableMultiCurrency: boolean;
    enableCustomFields: boolean;
    maxGroupsPerUser: number;
    maxUsersPerGroup: number;
}
```

**File: `packages/shared/src/shared-types.ts:348`**

Extend `AppConfiguration`:
```typescript
export interface AppConfiguration {
    firebase: FirebaseConfig;
    environment: EnvironmentConfig;
    formDefaults: FormDefaults;
    tenant?: TenantConfig;              // NEW: Add tenant config
    firebaseAuthUrl?: string;
    firebaseFirestoreUrl?: string;
}
```

#### Phase 2: Tenant Identification Middleware (Week 3)

**New File: `firebase/functions/src/middleware/tenant-identification.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { TenantId } from '@splitifyd/shared';
import { getTenantRegistry } from '../services/tenant-registry';

export interface TenantRequest extends Request {
    tenantId?: TenantId;
}

export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
    const host = (req.get('host') || '').toLowerCase();
    const registry = await getTenantRegistry(); // caches Firestore tenants + domain mappings
    const tenant = registry.findByDomain(host);

    req.tenantId = tenant?.tenantId ?? registry.getFallbackTenantId();
    next();
}
```

**Implementation notes**
- Maintain a cached domain→tenant map hydrated from Firestore (`tenants/{tenantId}.domains`).
- Seed a “showroom” tenant with its own demo domain that mirrors client-facing branding.
- Support multiple domains per tenant so the same config works for both our managed subdomains and customer-owned hosts.

**Modify: `firebase/functions/src/index.ts`**

Apply tenant middleware before routes:
```typescript
import { resolveTenant } from './middleware/tenant-identification';

app.use(resolveTenant);
```

#### Phase 3: Tenant Configuration Storage (Week 3-4)

**Firestore Collection Schema: `tenants/{tenantId}`**

```typescript
{
    tenantId: "acme",
    domains: ["acme.hosted-app.com", "app.acmeclient.com"],
    branding: {
        appName: "Acme Bill Splitter",
        logoUrl: "gs://white-label-prod.appspot.com/tenants/acme/logo.svg",
        faviconUrl: "gs://white-label-prod.appspot.com/tenants/acme/favicon.ico",
        primaryColor: "#0066CC",
        secondaryColor: "#FF6600",
        themePalette: "ocean-blue",
        marketingFlags: {
            showLandingPage: true,
            showPricingPage: false,
            showBlogPage: false
        }
    },
    features: {
        enableAdvancedReporting: true,
        enableMultiCurrency: false,
        maxGroupsPerUser: 50,
        maxUsersPerGroup: 20
    },
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-20T14:30:00.000Z"
}
```

**Modify: `firebase/functions/src/client-config.ts:177`**

Extend `buildAppConfiguration()` to fetch tenant config via the registry:
```typescript
import { TenantId } from '@splitifyd/shared';
import { getTenantRegistry } from './services/tenant-registry';

async function buildAppConfiguration(tenantId?: TenantId): Promise<AppConfiguration> {
    const config = getConfig();
    const env = getEnv();
    const registry = await getTenantRegistry();
    const tenant = tenantId ? registry.getConfig(tenantId) : null;

    return {
        firebase,
        environment,
        formDefaults: config.formDefaults,
        tenant: tenant ?? registry.getFallbackTenantConfig(),
        firebaseAuthUrl: getFirebaseAuthUrl(config, env),
        firebaseFirestoreUrl: getFirebaseFirestoreUrl(config, env),
    };
}
```

**Modify: `firebase/functions/src/index.ts:90`**

Reuse the existing `/config` route but make it tenant-aware:
```typescript
app.get(
    '/config',
    asyncHandler(async (req: TenantRequest, res: express.Response) => {
        const config = await buildAppConfiguration(req.tenantId);
        res.json(config);
    }),
);
```

**Implementation notes**
- `getTenantRegistry()` caches Firestore data with a snapshot listener so `/config` stays fast even with many tenants.
- Registry exposes helpers: `findByDomain(host)`, `getConfig(tenantId)`, `getFallbackTenantConfig()`, and `getFallbackTenantId()` for middleware reuse.
- Seed a “showroom” tenant whose branding powers the public demo domain; fallback tenant config can mirror this branding so unknown hosts still render a polished experience.
- Policies remain global—`PolicyService` logic is unchanged, so all tenants point to the same legal copy until we explicitly support overrides.

#### Phase 4: Frontend Dynamic Branding (Week 5)

**Modify: `webapp-v2/src/stores/config-store.ts`**

Fetch tenant-aware config:
```typescript
const response = await fetch('/config', { credentials: 'include' });
const config = await response.json();

// Apply branding immediately
if (config.tenant?.branding) {
    themeStore.applyThemeToDOM(
        mapTenantBrandingToUserTheme(config.tenant.branding),
        themeStore.isDarkMode,
    );
    applyFavicon(config.tenant.branding.faviconUrl);
}
```

**Modify: `webapp-v2/src/components/layout/Header.tsx:64`**

Dynamic logo loading:
```typescript
import { useConfigStore } from '../../stores/config-store';

function Header() {
    const config = useConfigStore();
    const logoUrl = config.tenant?.branding.logoUrl || '/images/logo.svg';
    const appName = config.tenant?.branding.appName || 'Splitifyd';

    return (
        <header>
            <img src={logoUrl} alt={appName} />
            <h1>{appName}</h1>
        </header>
    );
}
```

**Modify: `webapp-v2/src/app/stores/theme-store.ts`**

Apply tenant theme colors:
```typescript
function applyTenantTheme(branding: BrandingConfig) {
    const root = document.documentElement;

    // Apply tenant colors to CSS variables
    root.style.setProperty('--theme-primary', branding.primaryColor);
    root.style.setProperty('--theme-secondary', branding.secondaryColor);

    // Apply predefined palette if specified
    if (branding.themePalette) {
        const palette = USER_COLORS.find(c => c.name === branding.themePalette);
        if (palette) {
            root.style.setProperty('--theme-primary-light', palette.light);
            root.style.setProperty('--theme-primary-dark', palette.dark);
        }
    }
}
```

**Modify: `webapp-v2/index.html`**

Dynamic favicon:
```html
<script>
    // Detect tenant and set favicon before page loads
    const tenantId = detectTenantFromURL();
    fetch(`/api/app-config?tenantId=${tenantId}`)
        .then(res => res.json())
        .then(config => {
            if (config.tenant?.branding.faviconUrl) {
                document.querySelector('link[rel="icon"]').href = config.tenant.branding.faviconUrl;
            }
        });
</script>
```

#### Palette Validation (shared infra)

- Collect a single primary colour from tenants; plan to generate hover/active states by adjusting HSL lightness (≈−10% hover, −15% active) and validate each variant automatically.
- Normalise colours to uppercase hex (no alpha) and map them onto semantic roles (primary, secondary). Keep success/error/warning palettes system-owned to avoid tenant clashes.
- Validate contrast server-side with `culori` (or similar) and enforce WCAG 2.1 AA (≥4.5:1 for normal text, ≥3:1 for large text/icons) against both light (`#ffffff`) and dark (`#111827`) surfaces. If a generated state fails, either adjust text colour (black/white) or reject with a clear error—automatic tweaks are optional stretch goals.
- Persist computed metadata (`contrastWithLight`, `contrastWithDark`, `relativeLuminance`, generated hover/active swatches) alongside the raw colours so the client can apply them without recomputation.
- Detect potential hue clashes between tenant primary colours and system status palettes; surface warnings and recommended adjustments when the delta is too small.
- Client still guards against missing/undefined branding by defaulting to the fallback tenant config before applying CSS variables.

#### Branding Assets & Admin UX

- Logos: prefer SVG; enforce transparent backgrounds, guard aspect ratio with cropping or padded containers, and cap raster uploads (≤1 MB) to protect performance.
- Future admin previews should offer live contrast “Pass/Fail” badges, component previews, and automated warnings for inaccessible combinations. Colour-blind simulators and other advanced aids are nice-to-have enhancements.

#### Phase 5: Feature Flags & Conditional Routing (Week 6)

**New File: `webapp-v2/src/utils/feature-flags.ts`**

```typescript
import { useConfigStore } from '../stores/config-store';

export function useFeatureFlag(featureName: keyof FeatureConfig): boolean {
    const config = useConfigStore();
    return config.tenant?.features[featureName] ?? false;
}

export function FeatureGate({ feature, children }: { feature: keyof FeatureConfig; children: any }) {
    const enabled = useFeatureFlag(feature);
    return enabled ? children : null;
}
```

**Modify: `webapp-v2/src/App.tsx`**

Conditional marketing routes:
```typescript
import { useConfigStore } from './stores/config-store';
import { FeatureGate } from './utils/feature-flags';

function App() {
    const config = useConfigStore();
    const showLandingPage = config.tenant?.branding.marketingFlags.showLandingPage ?? true;

    return (
        <Router>
            {showLandingPage && <Route path="/" component={LandingPage} />}
            <Route path="/login" component={LoginPage} />
            <Route path="/app" component={AuthenticatedApp} />

            <FeatureGate feature="enableAdvancedReporting">
                <Route path="/app/reports/advanced" component={AdvancedReports} />
            </FeatureGate>
        </Router>
    );
}
```

#### Phase 6: Data Isolation (Week 7-8)

**Persist tenant context everywhere**

- Users: when registering (`firebase/functions/src/auth/register.ts`), inject `tenantId` from the resolved request and propagate it into the stored user doc plus custom auth claims. Existing admin promotion flows must retain the claim.
- Groups/Expenses/Settlements/Comments/etc.: enforce `tenantId` at creation time via service constructors—extend DTO builders to require a tenant and ensure every Firestore write includes it. For legacy data, plan a one-time backfill script keyed off existing ownership.
- APIs: decorate `request.auth.token.tenantId` in the auth middleware so downstream handlers can trust the claim; add guard helpers (e.g., `assertTenantAccess(docTenantId, requestTenantId)`) in each service before returning data.

**Firestore security rules (`firebase/firestore.rules`)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function userTenant() {
      return request.auth != null ? request.auth.token.tenantId : null;
    }

    match /users/{userId} {
      allow read, update: if userTenant() != null && resource.data.tenantId == userTenant();
      allow create: if userTenant() != null && request.resource.data.tenantId == userTenant();
    }

    match /groups/{groupId} {
      allow read, write: if userTenant() != null && resource.data.tenantId == userTenant();
    }

    match /expenses/{expenseId} {
      allow read, write: if userTenant() != null && resource.data.tenantId == userTenant();
    }

    match /tenants/{tenantId} {
      allow read: if tenantId == userTenant();
      allow write: if tenantId == userTenant() && request.auth.token.role == 'tenant-admin';
    }
  }
}
```

- Cloud Functions should double-check claims vs payload to avoid privilege escalation (never trust client-provided `tenantId`).
- Add smoke tests that sign in as two tenants and ensure cross-tenant reads/writes fail.

#### Phase 7: Organization Hierarchy (Future / Optional)

- Defer building a dedicated organization layer until a tenant explicitly needs multiple orgs under one tenant.
- When revisited, introduce `Organization` and `OrganizationMember` types, plus scoped collections (`organizations`, `organization-members`) with `tenantId` backreferences.
- User DTOs would then add optional `organizationId` while keeping `tenantId` as the primary isolation key.

#### Phase 8: Tenant Admin Panel (Week 11-12)

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
   - Provide copy-ready DNS instructions for new domains; expose “showroom” preview link.

3. **Feature Toggles**
   - Surface boolean/range config (e.g., multi-currency, group limits) with contextual descriptions.
   - Changes trigger backend validation via the tenant registry service.

4. **User & Access Management**
   - Invite tenant users, assign roles (`tenant-admin`, `member`), view activity/audit log.
   - Optional: show pending policy acceptance status to encourage compliance.

5. **Usage Snapshot (stretch)**
   - Display high-level metrics (active users, groups, storage usage) sourced from existing analytics.

**Implementation notes**
- Build forms with shared validation schema (`zod`) so the same rules run server-side.
- Use staged publish: edits save to draft, require confirmation before pushing to live config to avoid partial updates.
- Ensure every mutation writes audit entries (`tenant_audit_logs`) for later compliance needs.

**Backend/Frontend interface**
- **APIs (new endpoints under `/tenant-admin`)**
  - `GET /tenant-admin/tenant` → returns current tenant config, domain info, draft state.
  - `PUT /tenant-admin/tenant` → updates branding/features; payload validated via shared schemas, writes audit log.
  - `GET /tenant-admin/domains` / `POST /tenant-admin/domains` → enumerate/add domains, trigger verification workflow.
  - `GET /tenant-admin/users` / `POST /tenant-admin/users/invite` / `PATCH /tenant-admin/users/:id` → manage tenant members & roles.
  - All routes require auth middleware that enforces `tenantId` + `tenant-admin` claim; rate-limit mutations.

- **Frontend structure**
  - Add guarded routes (`/admin`, `/admin/branding`, `/admin/domains`, `/admin/users`, `/admin/features`) that lazy-load module pages.
  - Admin layout component pulls `/tenant-admin/tenant` on mount, provides context store for child tabs, and shows draft/published status with publish button.
  - Use shared form components with inline validation + live preview, wiring submissions to the corresponding API endpoints.

### Implementation Timeline

| Phase | Duration | Effort | Risk |
|-------|----------|--------|------|
| Phase 1: Types | 1-2 weeks | Low | Low |
| Phase 2: Tenant ID | 1 week | Low | Medium |
| Phase 3: Config Storage | 1-2 weeks | Medium | Low |
| Phase 4: Frontend Branding | 1 week | Low | Low |
| Phase 5: Feature Flags | 1 week | Medium | Low |
| Phase 6: Data Isolation | 2-3 weeks | High | **CRITICAL** |
| Phase 7: Org Hierarchy (optional) | TBD | Medium | Medium |
| Phase 8: Admin Panel | 2-3 weeks | Medium | Low |

**Total: 12-16 weeks (3-4 months)** for production-ready multi-tenant SaaS

---

**Reference Documents** (created during analysis):
- `WHITEMAP_EXECUTIVE_SUMMARY.md` - High-level business impact assessment
- `WHITEMAP_ANALYSIS.md` - Detailed technical analysis (930 lines)
- `WHITEMAP_CODE_REFERENCES.md` - Exact file paths and code snippets for modifications

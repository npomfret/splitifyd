# Tenant Theming Architecture - Complete Redesign

## Critical Constraint

**NO hardcoded design values in code.** Ever.

This means:
- NO colors in TypeScript/TSX files
- NO font names in TypeScript/TSX files
- NO sizes, spacing, radii in TypeScript/TSX files
- NO "presets" or "defaults" in code

**ALL design values must come from:**
- Firestore (tenant's stored `brandingTokens`)
- Set exclusively through the TenantEditorModal UI

---

## Why This Matters

Any number of tenants with unique domains can be added. Each tenant controls their own look and feel through the admin UI. If design values are hardcoded anywhere in the codebase, tenants cannot customize them.

**If NO tenants exist, the app will not be usable.** This is acceptable - the system requires at least one tenant to function.

---

## What Code Should Contain

1. **Schema definitions** - What fields exist, their types (BrandingTokensSchema)
2. **Validation rules** - Zod schemas for validation
3. **CSS variable generation logic** - ThemeArtifactService converts tokens to CSS
4. **UI components** - TenantEditorModal for editing tokens

## What Code Should NOT Contain

1. Colors (e.g., `#4f46e5`, `rgba(...)`)
2. Font names (e.g., `Space Grotesk`, `Inter`)
3. Sizes (e.g., `12px`, `1rem`)
4. Shadows, radii, spacing values
5. Any visual design decisions

---

## Tenant Creation Options

There are exactly TWO ways to create a tenant:

### Option 1: Empty Slate
- Start with a completely blank form
- User fills in EVERY required field
- No defaults, no presets
- Form shows placeholders with expected format (e.g., `#RRGGBB`)

### Option 2: Copy Existing Tenant
- Select an existing tenant from dropdown
- Clone ALL of its brandingTokens
- Modify as needed
- This is the ONLY way to get "starting values"

---

## UI Organization

Based on expert consultation from [UX Collective](https://uxdesign.cc/themeable-design-systems-313898c07eab), [Adobe Spectrum](https://spectrum.adobe.com/page/design-tokens/), [USWDS](https://designsystem.digital.gov/design-tokens/), and [Penpot](https://penpot.app/blog/what-are-design-tokens-a-complete-guide/):

### Token Collections (Collapsible Sections)

```
┌─ Create Tenant ──────────────────────────────────────────┐
│                                                          │
│ ○ Start from empty    ○ Copy from existing tenant [▼]   │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Basic Info ─────────────────────────────────────────────┐
│ Tenant ID: [____________]  App Name: [____________]      │
│ Domains: [____________] [Add]                            │
└──────────────────────────────────────────────────────────┘

▼ Colors
  ├── Palette (primary, secondary, accent, neutral, status)
  ├── Surfaces (base, raised, sunken, overlay, glass)
  ├── Text (primary, secondary, muted, accent, inverted)
  ├── Interactive (primary, secondary, destructive states)
  └── Borders (subtle, default, strong, focus)

▼ Typography
  ├── Font Families (sans, serif, mono)
  ├── Sizes (xs through 5xl)
  ├── Weights (regular, medium, semibold, bold)
  └── Line Heights & Letter Spacing

▼ Spacing & Layout
  ├── Scale (2xs through 2xl)
  └── Semantic (page, section, card, component)

▼ Radii & Shadows
  ├── Corner Radius (none, sm, md, lg, pill, full)
  └── Shadows (sm, md, lg)

▼ Motion
  ├── Durations (instant, fast, base, slow, glacial)
  ├── Easings (standard, decelerate, accelerate, spring)
  └── Features (parallax, magnetic, scroll reveal)

▼ Assets
  ├── Logo URL
  ├── Favicon URL
  └── Font URLs

▼ Legal
  ├── Company Name
  ├── Support Email
  └── Policy URLs

[Cancel]                              [Save & Publish]
```

### Live Preview Panel

As user fills in values, show a live preview:
- Sample button with primary/secondary colors
- Sample card with surface/border colors
- Sample text with typography settings
- Immediate feedback without defaults

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  TenantEditor   │────▶│  API: upsert     │────▶│   Firestore     │
│  Modal (UI)     │     │  tenant          │     │  brandingTokens │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CSS Output    │◀────│  ThemeArtifact   │◀────│  flattenTokens  │
│   (variables)   │     │  Service         │     │  (recursive)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Files to Delete

| File | Reason |
|------|--------|
| `packages/shared/src/fixtures/branding-tokens.ts` | Contains hardcoded design values - MUST BE DELETED |

## Files That Import Fixtures (Must Be Modified)

| File | Required Change |
|------|-----------------|
| `packages/shared/src/index.ts` | Remove fixture exports |
| `webapp-v2/src/components/admin/TenantEditorModal.tsx` | Remove presets, add copy-tenant flow |
| `firebase/scripts/publish-local-themes.ts` | Rewrite without fixtures |
| `firebase/scripts/publish-staging-themes.ts` | Rewrite without fixtures |
| `firebase/functions/src/__tests__/integration/tenant/theme-css.test.ts` | Create test data in Firestore, not from fixtures |
| `scripts/verify-theme-css.ts` | Rewrite without fixtures |

---

## BrandingTokens Schema

The schema in `packages/shared/src/types/branding.ts` defines the STRUCTURE only:

- `palette` - 11 hex colors (primary, secondary, accent, neutral, status colors)
- `typography` - font families, sizes, weights, line heights, letter spacing
- `spacing` - scale values (2xs through 2xl)
- `radii` - corner radius values (none, sm, md, lg, pill, full)
- `shadows` - elevation levels (sm, md, lg)
- `assets` - logo, favicon, font URLs
- `legal` - company info, policy URLs
- `semantics` - surface colors, text colors, interactive states, borders, status, gradients
- `motion` - durations, easings, feature flags

Total: ~144 fields, all must be user-configurable through the UI.

---

## Implementation Steps

### Phase 1: Delete Fixtures
1. Delete `packages/shared/src/fixtures/branding-tokens.ts`
2. Remove exports from `packages/shared/src/index.ts`
3. Fix all import errors

### Phase 2: Rewrite TenantEditorModal
1. Remove preset selection
2. Add "Start from empty" vs "Copy existing tenant" toggle
3. Expose ALL 144 fields organized into collapsible sections
4. Add live preview panel
5. Add real-time validation

### Phase 3: Update Scripts
1. Rewrite `publish-local-themes.ts` to use API calls or Firestore directly
2. Rewrite `publish-staging-themes.ts` similarly
3. Test data must come from Firestore, not code

### Phase 4: Fix Tests
1. Integration tests create test tenants via API
2. No test should import fixture data
3. Test data is stored in Firestore during test setup

---

## Previous Mistakes (Lessons Learned)

### What I kept doing wrong:
1. Putting color values in TypeScript files
2. Treating fixtures as "presets"
3. Making changes without documenting in this file first
4. Not recognizing that ANY hardcoded design value is a violation

### Why this happened:
- I was trying to provide "convenience" through defaults
- But defaults in code prevent tenant customization
- The system must be purely data-driven

### The correct approach:
- Code defines STRUCTURE (schema)
- Data (Firestore) contains VALUES
- UI (TenantEditorModal) is the ONLY way to set values
- There are NO shortcuts, NO defaults, NO presets

---

## Status: ✅ ARCHITECTURE FIXED (2025-11-26)

The following changes were made to fix the architecture:

### Completed:
1. ✅ Deleted `packages/shared/src/fixtures/branding-tokens.ts` (contained hardcoded design values)
2. ✅ Removed fixture exports from `packages/shared/src/index.ts`
3. ✅ Rewrote `TenantEditorModal.tsx`:
   - Removed preset system
   - Added "Start from empty" vs "Copy from existing tenant" creation modes
   - All ~144 fields exposed in collapsible sections
   - No hardcoded design values
4. ✅ Updated `publish-local-themes.ts` - now reads from Firestore, doesn't create tenants
5. ✅ Updated `publish-staging-themes.ts` - same approach
6. ✅ Fixed `theme-css.test.ts` - creates test data inline, no fixtures
7. ✅ Updated `webapp-and-style-guide.md` - removed fixture references

### Code Review Fix (2025-11-26):

**Issues identified in code review:**
1. `buildBrandingTokensFromForm` had ~50 fallback values (`formData.primaryColor || '#000000'`)
2. UI only exposed ~45 fields, ~100 fields used hardcoded defaults
3. publish scripts no longer created tenants, breaking dev workflow

**Fixes applied:**
1. ✅ Removed ALL fallback values from `buildBrandingTokensFromForm` - values now come directly from formData
2. ✅ Added ALL missing form fields to TenantData interface (~120 fields total)
3. ✅ Added ALL missing UI sections:
   - Palette Colors (11 fields)
   - Surface Colors (6 fields)
   - Text Colors (5 fields)
   - Interactive Colors (13 fields)
   - Border Colors (5 fields)
   - Status Colors (4 fields)
   - Typography (fonts, sizes, weights, line heights, letter spacing, semantics)
   - Spacing (scale + semantic)
   - Radii (6 fields)
   - Shadows (3 fields)
   - Legal (4 fields)
   - Motion (durations + easings)
4. ✅ Added comprehensive form validation - ALL required fields must be filled before save
5. ✅ Test data in `theme-css.test.ts` is complete and test-only (doesn't violate architecture)

### Architecture Now Correct:
- **Code contains:** Schema definitions, validation rules, CSS generation logic
- **Code does NOT contain:** Colors, fonts, sizes, or any visual design decisions
- **All design values come from:** Firestore (tenant's stored `brandingTokens`)
- **Set exclusively through:** TenantEditorModal UI

### UX Impact:
- "Start from empty" mode requires filling ALL ~120 fields manually
- "Copy from existing" is the practical choice for new tenants
- First tenant creation is tedious but subsequent ones are easy (copy)

---

### Phase 2: Delete BrandingTokensGenerator.ts (2025-11-26)

**Problem Found:**
`firebase/functions/src/services/tenant/BrandingTokensGenerator.ts` contained ~100 hardcoded design values that were auto-applied whenever a tenant was created without full brandingTokens.

**Fixes Applied:**
1. ✅ Deleted `BrandingTokensGenerator.ts` - no more auto-generation
2. ✅ Updated `TenantAdminService.ts` - now throws error if brandingTokens not provided
3. ✅ Made `brandingTokens` required in `AdminUpsertTenantRequestSchema` (removed `.optional()`)
4. ✅ Updated `tenant-configs.json` - all 3 tenants now have complete `brandingTokens` (~144 fields each)
5. ✅ Updated `sync-tenant-configs.ts` - validates and passes brandingTokens from JSON

**Architecture Now Strictly Enforced:**
- API rejects tenant creation without full brandingTokens
- All design values in production come from Firestore/JSON data, NOT TypeScript code
- Test builders (`AdminTenantRequestBuilder`) provide test-only data (acceptable for tests)
- tenant-configs.json is the single source of truth for seed tenants

---

### Phase 3: Premium Theme Features & Testing (2025-11-26)

**New Features Implemented:**

1. **Premium CSS Enhancements** (`global.css`, `landing.css`)
   - Glassmorphism hover glow effects on `.glass-panel`
   - Animated gradient text shimmer (`@keyframes gradient-shift`)
   - Hero image enhanced shadows with primary color glow
   - Feature card cursor-following glow overlay
   - CTA section animated radial glow
   - All effects use CSS variables from theme tokens

2. **ThemeArtifactService Enhancements**
   - Added palette RGB variants (`--palette-primary-rgb`, `--palette-secondary-rgb`, `--palette-accent-rgb`)
   - Enables `rgba()` usage in glow effects without hardcoding colors

3. **Three Example Tenant Themes** (`tenant-configs.json`)
   - **localhost-tenant (Aurora)**: Violet/Cyan/Pink dark theme with full motion, glassmorphism, aurora gradient
   - **staging-tenant (Neon Emerald)**: Emerald/Cyan/Gold dark theme with same premium features, different palette
   - **default-tenant (Clean Light)**: Blue/Indigo/Violet light theme, minimal effects, high readability

4. **Comprehensive E2E Testing** (`e2e-tests/tenant-editor.e2e.test.ts`)
   - Core CRUD operations
   - Motion & Effects toggles
   - Typography customization
   - Advanced controls (aurora gradient, glassmorphism)
   - Marketing flags
   - Theme publishing with CSS verification

5. **Simplified Playwright Tests** (`webapp-v2/tenant-editor-modal.test.ts`)
   - 14 focused tests covering modal operations, form display, validation, domain management
   - Uses MSW mocks for fast, isolated testing
   - Page object auto-expands collapsible sections

6. **Page Object Enhancements** (`TenantEditorModalPage.ts`)
   - Auto-section expansion in all setter/verify methods
   - Added methods for spacing, radii, shadows, legal, interactive colors
   - Supports nested sections (aurora gradient, glassmorphism under motion)

7. **Documentation Updates** (`webapp-and-style-guide.md`)
   - Added "TenantEditorModal Testing" section with usage examples
   - Page object usage patterns
   - Test category explanations
   - Running tests guide

**Test Status:**
- ✅ 14/14 `tenant-editor-modal.test.ts` (Playwright, MSW-mocked)
- ✅ 55/55 `authorization.test.ts` (unit tests)
- ✅ E2E tests passing with real emulator

**Files Modified:**
- `webapp-v2/src/styles/global.css` - Premium component styles
- `webapp-v2/src/styles/landing.css` - Landing page enhancements
- `firebase/functions/src/services/tenant/ThemeArtifactService.ts` - RGB variants
- `firebase/scripts/tenant-configs.json` - Three themed tenants
- `e2e-tests/src/__tests__/integration/tenant-editor.e2e.test.ts` - Comprehensive tests
- `webapp-v2/src/__tests__/integration/playwright/tenant-editor-modal.test.ts` - Simplified tests
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts` - Enhanced page object
- `packages/test-support/src/builders/AdminTenantRequestBuilder.ts` - Added `surface.muted` field
- `firebase/functions/src/__tests__/unit/api/authorization.test.ts` - Fixed brandingTokens requirement
- `docs/guides/webapp-and-style-guide.md` - Testing documentation

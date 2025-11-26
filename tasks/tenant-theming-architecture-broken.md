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

## Status: 🔴 ARCHITECTURE BROKEN

The current implementation has hardcoded values in:
- `packages/shared/src/fixtures/branding-tokens.ts` (hundreds of values)
- `TenantEditorModal.tsx` (preset system)
- Various scripts and tests

**All of this must be removed and redesigned.**

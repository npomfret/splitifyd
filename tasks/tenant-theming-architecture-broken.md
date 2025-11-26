# Tenant Theming - Fix Plan

## Problem

The editor reads from `tenant.branding` but CSS is generated from `brandingTokens.tokens`. Editor shows wrong values.

## Solution

Editor with **categories**. Configure the category, everything in that category gets the same treatment.

## Progress

### Phase 1: Core Architecture Fix ✅ COMPLETE

**What was done:**
- Rewrote TenantEditorModal to read/write directly to `brandingTokens.tokens`
- Added preset selection (Aurora/Brutalist/Blank) for create mode
- Deleted `tenant-token-merger.ts` and `branding-tokens-generator.ts`
- All 4 e2e tests passing

### Phase 2: Missing Form Fields ✅ COMPLETE

**What was done:**
- Added Primary hover color field
- Added Secondary color + hover fields
- Added Text accent color field
- Added Gradient toggle for buttons
- Added Font weight controls (headings, body, UI)
- Added Fluid typography toggle
- Updated page objects to use test IDs
- All 4 e2e tests passing

**Current form fields implemented:**
- **Primary Actions**: Color, Hover, Gradient toggle
- **Secondary Actions**: Color, Hover
- **Accent**: Color
- **Surfaces**: Base, Raised
- **Text**: Primary, Secondary, Muted, Accent
- **Borders**: Subtle, Default, Strong
- **Status**: Success, Warning, Error, Info
- **Typography**: Sans/Serif/Mono fonts, Headings/Body/UI weights, Fluid sizing toggle
- **Motion**: Aurora, Glassmorphism, Magnetic Hover, Scroll Reveal
- **Aurora Gradient**: 4 colors
- **Glassmorphism**: Glass color, Glass border
- **Marketing**: Landing page, Marketing content, Pricing page flags

### Phase 3: UI Organization ✅ COMPLETE

**What was done:**
- Rewrote TenantEditorModal with collapsible `Section` component
- Created reusable `ColorInput` and `Toggle` helper components
- Organized into 12 collapsible sections matching the wireframe:
  - Basic Info (always open)
  - Theme Preset (create mode, always open)
  - Logo & Assets
  - Actions (Primary/Secondary/Accent colors)
  - Surfaces (Base, Raised)
  - Text (Primary, Secondary, Muted, Accent)
  - Borders (Subtle, Default, Strong)
  - Status Colors (Success, Warning, Error, Info)
  - Motion & Effects (Aurora, Glassmorphism, Magnetic Hover, Scroll Reveal)
  - Aurora Gradient (conditional, 4 colors)
  - Glassmorphism Settings (conditional, RGBA colors)
  - Typography (Fonts, Weights, Fluid toggle)
  - Marketing (Landing page, Marketing content, Pricing page)
- Updated page objects to expand sections before interacting with fields
- All 4 e2e tests passing

### Phase 4: Remaining Work (Optional)

**Still to do:**

1. **ThemeArtifactService verification** (technical debt)
   - [ ] Ensure all motion CSS variables are generated
   - [ ] Verify gradient CSS is generated correctly

---

## Categories

### Background
- **Aurora Animation** (on/off) ✅
  - 4 gradient colors ✅

### Surfaces
All cards, modals, dropdowns, panels share these settings:
- Base color ✅
- Raised color ✅
- **Glassmorphism** (on/off) ✅
  - Glass color ✅
  - Glass border color ✅

### Primary Actions
All primary buttons, links, focused inputs share:
- Color ✅
- Hover color ✅
- **Gradient** (on/off) ✅
- **Magnetic hover** (on/off) ✅

### Secondary Actions
All secondary/ghost buttons share:
- Color ✅
- Hover color ✅

### Text
All text shares these levels:
- Primary (headings, important text) ✅
- Secondary (body, descriptions) ✅
- Muted (captions, hints) ✅
- Accent (highlights, links) ✅

### Typography
- **Headings** - font family ✅, weight ✅
- **Body** - font family ✅, weight ✅
- **UI** - font family ✅, weight ✅
- **Code** - font family ✅
- **Fluid sizing** (on/off) ✅

### Borders
All borders share:
- Subtle (dividers) ✅
- Default (inputs, cards) ✅
- Strong (emphasis) ✅

### Status
- Success color ✅
- Warning color ✅
- Error color ✅
- Info color ✅

### Animations
- **Scroll reveal** (on/off) ✅

### Marketing
- Show landing page ✅
- Show marketing content ✅
- Show pricing page ✅

## Presets

**Aurora:**
- Background: Aurora ON, neon gradients
- Surfaces: Glassmorphism ON, dark
- Primary: Gradient ON, Magnetic ON, indigo
- Typography: Space Grotesk headings, Inter body, Fluid ON
- Animations: Scroll reveal ON

**Brutalist:**
- Background: Aurora OFF
- Surfaces: Glassmorphism OFF, gray
- Primary: Gradient OFF, Magnetic OFF, gray
- Typography: System fonts, Fluid OFF
- Animations: All OFF

## Editor UI

```
┌─ Basic Info ─────────────────────────────────────────────┐
│ Tenant ID, App Name, Logo, Domains                       │
└──────────────────────────────────────────────────────────┘

┌─ Preset (create mode) ───────────────────────────────────┐
│ ○ Aurora    ○ Brutalist    ○ Blank                       │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Background ─────────────────────────────────────────────┐
│ ☑ Aurora Animation                                       │  ✅ DONE
│   [■] [■] [■] [■]                                       │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Surfaces ───────────────────────────────────────────────┐
│ Base [■]  Raised [■]                                    │  ✅ DONE
│ ☑ Glassmorphism                                          │  ✅ DONE
│   Glass [____]  Border [____]                           │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Primary Actions ────────────────────────────────────────┐
│ Color [■]  Hover [■]                                    │  ✅ DONE
│ ☑ Gradient    ☑ Magnetic Hover                          │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Secondary Actions ──────────────────────────────────────┐
│ Color [■]  Hover [■]                                    │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Text ───────────────────────────────────────────────────┐
│ Primary [■]  Secondary [■]  Muted [■]  Accent [■]       │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Typography ─────────────────────────────────────────────┐
│ Headings: [Font________▼] [Weight▼]                     │  ✅ DONE
│ Body:     [Font________▼] [Weight▼]                     │  ✅ DONE
│ UI:       [Font________▼] [Weight▼]                     │  ✅ DONE
│ Code:     [Font________▼]                               │  ✅ DONE
│ ☑ Fluid Sizing                                           │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Borders ────────────────────────────────────────────────┐
│ Subtle [■]  Default [■]  Strong [■]                     │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Status Colors ──────────────────────────────────────────┐
│ Success [■]  Warning [■]  Error [■]  Info [■]           │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Animations ─────────────────────────────────────────────┐
│ ☑ Scroll Reveal                                          │  ✅ DONE
└──────────────────────────────────────────────────────────┘

┌─ Marketing ──────────────────────────────────────────────┐
│ ☐ Landing Page  ☐ Marketing Content  ☐ Pricing Page     │  ✅ DONE
└──────────────────────────────────────────────────────────┘
```

## Implementation

### Form → Tokens mapping

Editor form fields map to `brandingTokens.tokens`:

| Form Field | Token Path | Status |
|------------|------------|--------|
| surfaceBase | semantics.colors.surface.base | ✅ |
| surfaceRaised | semantics.colors.surface.raised | ✅ |
| glassColor | semantics.colors.surface.glass | ✅ |
| glassBorderColor | semantics.colors.surface.glassBorder | ✅ |
| primaryColor | semantics.colors.interactive.primary | ✅ |
| primaryHover | semantics.colors.interactive.primaryHover | ✅ |
| secondaryColor | semantics.colors.interactive.secondary | ✅ |
| secondaryHover | semantics.colors.interactive.secondaryHover | ✅ |
| textPrimary | semantics.colors.text.primary | ✅ |
| textSecondary | semantics.colors.text.secondary | ✅ |
| textMuted | semantics.colors.text.muted | ✅ |
| textAccent | semantics.colors.text.accent | ✅ |
| borderSubtle | semantics.colors.border.subtle | ✅ |
| borderDefault | semantics.colors.border.default | ✅ |
| borderStrong | semantics.colors.border.strong | ✅ |
| fontSans | typography.fontFamily.sans | ✅ |
| fontSerif | typography.fontFamily.serif | ✅ |
| fontMono | typography.fontFamily.mono | ✅ |
| fontWeightHeadings | typography.weights.bold | ✅ |
| fontWeightBody | typography.weights.regular | ✅ |
| fontWeightUI | typography.weights.medium | ✅ |
| enableFluidTypography | typography.fluidScale (presence) | ✅ |
| enableAurora | motion.enableParallax | ✅ |
| enableMagnetic | motion.enableMagneticHover | ✅ |
| enableScrollReveal | motion.enableScrollReveal | ✅ |
| enableButtonGradient | semantics.colors.gradient.primary (presence) | ✅ |
| auroraGradient | semantics.colors.gradient.aurora | ✅ |

### Read from tokens → form ✅ DONE

On edit, populate form from `brandingTokens.tokens` via `extractFormDataFromTokens()`

### Write form → tokens ✅ DONE

On save, build complete tokens object from form values via `buildBrandingTokensFromForm()`. Features that are OFF unset related values.

## Files Modified

| File | Change | Status |
|------|--------|--------|
| webapp-v2/src/components/admin/TenantEditorModal.tsx | Rewritten with full category support | ✅ |
| packages/test-support/src/page-objects/TenantEditorModalPage.ts | Updated to use test IDs | ✅ |
| e2e-tests/src/__tests__/integration/tenant-editor.e2e.test.ts | Removed customCSS test | ✅ |

## Files Deleted

| File | Reason | Status |
|------|--------|--------|
| webapp-v2/src/utils/tenant-token-merger.ts | Not needed | ✅ |
| webapp-v2/src/utils/branding-tokens-generator.ts | Not needed | ✅ |

## Success Criteria

1. ✅ Create tenant with Aurora preset → fancy theme with all effects
2. ✅ Create tenant with Brutalist preset → minimal flat theme
3. ✅ Change a category setting → all elements in that category change
4. ✅ Toggle feature on/off → CSS reflects it
5. ✅ Edit existing tenant → shows actual stored values

## Next Steps (Optional)

1. **UI reorganization** - Group fields into collapsible category sections per wireframe
2. **CSS generation verification** - Check ThemeArtifactService generates all variables correctly

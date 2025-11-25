# Tenant Theming - Fix Plan

## Problem

The editor reads from `tenant.branding` but CSS is generated from `brandingTokens.tokens`. Editor shows wrong values.

## Solution

Editor with **categories**. Configure the category, everything in that category gets the same treatment.

## Categories

### Background
- **Aurora Animation** (on/off)
  - 4 gradient colors

### Surfaces
All cards, modals, dropdowns, panels share these settings:
- Base color
- Raised color
- **Glassmorphism** (on/off)
  - Glass color
  - Glass border color

### Primary Actions
All primary buttons, links, focused inputs share:
- Color
- Hover color
- **Gradient** (on/off)
- **Magnetic hover** (on/off)

### Secondary Actions
All secondary/ghost buttons share:
- Color
- Hover color

### Text
All text shares these levels:
- Primary (headings, important text)
- Secondary (body, descriptions)
- Muted (captions, hints)
- Accent (highlights, links)

### Typography
- **Headings** - font family, weight, scale (applies to h1-h6, titles)
- **Body** - font family, weight (applies to paragraphs, inputs)
- **UI** - font family, weight (applies to buttons, labels, badges)
- **Code** - font family (applies to code blocks)
- **Fluid sizing** (on/off) - responsive text scaling

### Borders
All borders share:
- Subtle (dividers)
- Default (inputs, cards)
- Strong (emphasis)

### Status
- Success color
- Warning color
- Error color
- Info color

### Animations
- **Scroll reveal** (on/off)

### Marketing
- Show landing page
- Show marketing content
- Show pricing page

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
│ ○ Aurora    ○ Brutalist    ○ Blank                       │
└──────────────────────────────────────────────────────────┘

┌─ Background ─────────────────────────────────────────────┐
│ ☑ Aurora Animation                                       │
│   [■] [■] [■] [■]                                       │
└──────────────────────────────────────────────────────────┘

┌─ Surfaces ───────────────────────────────────────────────┐
│ Base [■]  Raised [■]                                    │
│ ☑ Glassmorphism                                          │
│   Glass [____]  Border [____]                           │
└──────────────────────────────────────────────────────────┘

┌─ Primary Actions ────────────────────────────────────────┐
│ Color [■]  Hover [■]                                    │
│ ☑ Gradient    ☑ Magnetic Hover                          │
└──────────────────────────────────────────────────────────┘

┌─ Secondary Actions ──────────────────────────────────────┐
│ Color [■]  Hover [■]                                    │
└──────────────────────────────────────────────────────────┘

┌─ Text ───────────────────────────────────────────────────┐
│ Primary [■]  Secondary [■]  Muted [■]  Accent [■]       │
└──────────────────────────────────────────────────────────┘

┌─ Typography ─────────────────────────────────────────────┐
│ Headings: [Font________▼] [Weight▼] [Scale▼]            │
│ Body:     [Font________▼] [Weight▼]                     │
│ UI:       [Font________▼] [Weight▼]                     │
│ Code:     [Font________▼]                               │
│ ☑ Fluid Sizing                                           │
└──────────────────────────────────────────────────────────┘

┌─ Borders ────────────────────────────────────────────────┐
│ Subtle [■]  Default [■]  Strong [■]                     │
└──────────────────────────────────────────────────────────┘

┌─ Status Colors ──────────────────────────────────────────┐
│ Success [■]  Warning [■]  Error [■]  Info [■]           │
└──────────────────────────────────────────────────────────┘

┌─ Animations ─────────────────────────────────────────────┐
│ ☑ Scroll Reveal                                          │
└──────────────────────────────────────────────────────────┘

┌─ Marketing ──────────────────────────────────────────────┐
│ ☐ Landing Page  ☐ Marketing Content  ☐ Pricing Page     │
└──────────────────────────────────────────────────────────┘
```

## Implementation

### Form → Tokens mapping

Editor form fields map to `brandingTokens.tokens`:

| Form Field | Token Path |
|------------|------------|
| surfaceBase | semantics.colors.surface.base |
| surfaceRaised | semantics.colors.surface.raised |
| glassColor | semantics.colors.surface.glass |
| primaryColor | semantics.colors.interactive.primary |
| primaryHover | semantics.colors.interactive.primaryHover |
| textPrimary | semantics.colors.text.primary |
| headingFont | typography.fontFamily.heading |
| bodyFont | typography.fontFamily.sans |
| enableAurora | motion.enableParallax |
| enableMagnetic | motion.enableMagneticHover |
| ... | ... |

### Read from tokens → form

On edit, populate form from `brandingTokens.tokens`

### Write form → tokens

On save, build complete tokens object from form values. Features that are OFF should unset related values.

## Files to Modify

| File | Change |
|------|--------|
| webapp-v2/src/components/admin/TenantEditorModal.tsx | Complete rewrite with category-based UI |
| firebase/functions/src/services/tenant/ThemeArtifactService.ts | Ensure all features generate correct CSS |

## Files to Delete

| File | Reason |
|------|--------|
| webapp-v2/src/utils/tenant-token-merger.ts | Not needed |
| webapp-v2/src/utils/branding-tokens-generator.ts | Not needed |

## Success Criteria

1. Create tenant with Aurora preset → fancy theme with all effects
2. Create tenant with Brutalist preset → minimal flat theme
3. Change a category setting → all elements in that category change
4. Toggle feature on/off → CSS reflects it
5. Edit existing tenant → shows actual stored values

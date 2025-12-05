# Theme Settings Guide

Complete reference for the multi-tenant theming system. Every color, spacing, typography, and motion setting flows through CSS variables generated per-tenant.

---

## Architecture Overview

```
BrandingTokens (Firestore)
    ↓
ThemeArtifactService.generate()
    ↓
/api/theme.css (per-tenant CSS variables)
    ↓
Tailwind Config (semantic class mappings)
    ↓
Components (consume via Tailwind classes or var())
```

**Key files:**
| Purpose | Location |
|---------|----------|
| Token schema | `packages/shared/src/types/branding.ts` |
| CSS generation | `firebase/functions/src/services/tenant/ThemeArtifactService.ts` |
| CSS serving | `firebase/functions/src/theme/ThemeHandlers.ts` |
| Tailwind config | `webapp-v2/tailwind.config.js` |
| Config store | `webapp-v2/src/stores/config-store.ts` |
| Motion hooks | `webapp-v2/src/app/hooks/useThemeConfig.ts` |

---

## Token Categories

### 1. Palette Colors (11 tokens)

Raw brand colors used to derive semantic colors.

| Token | CSS Variable | Default | Purpose |
|-------|--------------|---------|---------|
| `primary` | `--palette-primary` | `#2563eb` | Primary brand color |
| `primaryVariant` | `--palette-primary-variant` | `#1d4ed8` | Darker primary |
| `secondary` | `--palette-secondary` | `#7c3aed` | Secondary brand color |
| `secondaryVariant` | `--palette-secondary-variant` | `#6d28d9` | Darker secondary |
| `accent` | `--palette-accent` | `#f97316` | Accent/highlight color |
| `neutral` | `--palette-neutral` | `#f8fafc` | Light neutral |
| `neutralVariant` | `--palette-neutralVariant` | `#e2e8f0` | Medium neutral |
| `success` | `--palette-success` | `#22c55e` | Success state |
| `warning` | `--palette-warning` | `#eab308` | Warning state |
| `danger` | `--palette-danger` | `#ef4444` | Error/danger state |
| `info` | `--palette-info` | `#38bdf8` | Info state |

---

### 2. Semantic Surface Colors (10 tokens)

Background colors for UI layers.

| Token | CSS Variable | Tailwind Class | Default | Usage |
|-------|--------------|----------------|---------|-------|
| `base` | `--surface-base-rgb` | `bg-surface-base` | `#f8fafc` | Page background |
| `raised` | `--surface-raised-rgb` | `bg-surface-raised` | `#fafbfc` | Cards, elevated surfaces |
| `sunken` | `--surface-sunken-rgb` | `bg-surface-sunken` | `#eff1f3` | Inset areas |
| `overlay` | `--surface-overlay-rgb` | `bg-surface-overlay` | `#0f172a` | Modal backdrops |
| `warning` | `--surface-warning-rgb` | `bg-surface-warning` | `#fef3c7` | Warning backgrounds |
| `muted` | `--surface-muted-rgb` | `bg-surface-muted` | `#e2e8f0` | Disabled/muted areas |
| `glass` | `--surface-glass` | `.glass-panel` | optional | Glassmorphism panels |
| `glassBorder` | `--surface-glassBorder` | — | optional | Glass panel borders |
| `skeleton` | `--surface-skeleton` | — | `#e2e8f0` | Loading skeleton base |
| `skeletonShimmer` | `--surface-skeletonShimmer` | — | `#f1f5f9` | Skeleton shimmer |

**Component usage:**
```tsx
<Surface variant="base">...</Surface>    // bg-surface-base
<Surface variant="raised">...</Surface>  // bg-surface-raised
<Surface variant="glass">...</Surface>   // glass-panel class
```

---

### 3. Semantic Text Colors (8 tokens)

| Token | CSS Variable | Tailwind Class | Default | Usage |
|-------|--------------|----------------|---------|-------|
| `primary` | `--text-primary-rgb` | `text-text-primary` | `#0f172a` | Primary body text |
| `secondary` | `--text-secondary-rgb` | `text-text-secondary` | `#475569` | Secondary text |
| `muted` | `--text-muted-rgb` | `text-text-muted` | `#94a3b8` | Placeholder, hints |
| `inverted` | `--text-inverted-rgb` | `text-text-inverted` | `#ffffff` | Text on dark backgrounds |
| `accent` | `--text-accent-rgb` | `text-text-accent` | `#f97316` | Highlighted text |
| `hero` | `--text-hero` | `.hero-heading` class | falls back to primary | Hero section headings |
| `eyebrow` | `--text-eyebrow` | `.eyebrow` class | falls back to muted | Eyebrow labels |
| `code` | `--text-code` | `code` elements | falls back to accent | Code snippets |

**Component usage:**
```tsx
<Typography color="primary">...</Typography>
<Typography color="muted">...</Typography>
```

**Note:** `hero`, `eyebrow`, and `code` are optional - they have CSS fallbacks in `global.css` when not defined.

---

### 4. Interactive Colors (16 tokens)

Colors for buttons, links, and interactive elements.

| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `primary` | `--interactive-primary-rgb` | `bg-interactive-primary` | `#2563eb` |
| `primaryHover` | `--interactive-primaryHover-rgb` | — | `#224dc7` |
| `primaryActive` | `--interactive-primaryActive-rgb` | — | `#1f45b3` |
| `primaryForeground` | `--interactive-primaryForeground-rgb` | `text-interactive-primary-foreground` | `#ffffff` |
| `secondary` | `--interactive-secondary-rgb` | `bg-interactive-secondary` | `#7c3aed` |
| `secondaryHover` | `--interactive-secondaryHover-rgb` | — | `#7235d9` |
| `secondaryActive` | `--interactive-secondaryActive-rgb` | — | `#6730c5` |
| `secondaryForeground` | `--interactive-secondaryForeground-rgb` | `text-interactive-secondary-foreground` | `#ffffff` |
| `accent` | `--interactive-accent-rgb` | `bg-interactive-accent` | `#f97316` |
| `destructive` | `--interactive-destructive-rgb` | — | `#ef4444` |
| `destructiveHover` | `--interactive-destructiveHover-rgb` | — | `#dc3e3e` |
| `destructiveActive` | `--interactive-destructiveActive-rgb` | — | `#c93838` |
| `destructiveForeground` | `--interactive-destructiveForeground-rgb` | — | `#ffffff` |
| `ghost` | `--interactive-ghost-rgb` | `bg-interactive-ghost` | optional |
| `magnetic` | `--interactive-magnetic-rgb` | — | optional |
| `glow` | `--interactive-glow-rgb` | — | optional |

**Button component applies these automatically:**
```tsx
<Button variant="primary">...</Button>   // bg-interactive-primary, magnetic hover glow, glow on focus
<Button variant="secondary">...</Button> // bg-interactive-secondary
<Button variant="ghost">...</Button>     // hover:bg-interactive-ghost/10, focus ring uses ghost
<Button variant="danger">...</Button>    // Uses destructive colors
```

**Effect tokens (optional):**
- `ghost` - Background tint for ghost button hover state
- `magnetic` - Glow color for magnetic hover effect on primary buttons
- `glow` - Outer glow color for focus states

**CSS utilities for effect tokens:**
```css
.focus-glow:focus-visible { /* Uses --interactive-glow-rgb */ }
.magnetic-glow:hover { /* Hover glow using --interactive-magnetic-rgb */ }
```

---

### 5. Border Colors (6 tokens)

| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `subtle` | `--border-subtle-rgb` | `border-border-subtle` | `#e2e8f0` |
| `default` | `--border-default-rgb` | `border-border-default` | `#cbd5f5` |
| `strong` | `--border-strong-rgb` | `border-border-strong` | `#94a3b8` |
| `focus` | `--border-focus-rgb` | `border-border-focus` | `#f97316` |
| `warning` | `--border-warning-rgb` | `border-border-warning` | `#fbbf24` |
| `error` | `--border-error-rgb` | `border-border-error` | optional |

---

### 6. Status Colors (4 tokens)

| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `success` | `--semantic-success-rgb` | `bg-semantic-success` | `#22c55e` |
| `warning` | `--semantic-warning-rgb` | `bg-semantic-warning` | `#eab308` |
| `danger` | `--semantic-error-rgb` | `bg-semantic-error` | `#ef4444` |
| `info` | `--semantic-info-rgb` | `bg-semantic-info` | `#38bdf8` |

---

### 7. Typography (40+ tokens)

#### Font Families
| Token | CSS Variable | Default |
|-------|--------------|---------|
| `sans` | `--typography-font-family-sans` | `Space Grotesk, Inter, system-ui` |
| `serif` | `--typography-font-family-serif` | `Fraunces, Georgia, serif` (optional) |
| `mono` | `--typography-font-family-mono` | `JetBrains Mono, SFMono-Regular, Menlo` |

#### Font Sizes (9 levels)
| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `xs` | `--typography-sizes-xs` | `text-xs` | `0.75rem` |
| `sm` | `--typography-sizes-sm` | `text-sm` | `0.875rem` |
| `md` | `--typography-sizes-md` | `text-base` | `1rem` |
| `lg` | `--typography-sizes-lg` | `text-lg` | `1.125rem` |
| `xl` | `--typography-sizes-xl` | `text-xl` | `1.25rem` |
| `2xl` | `--typography-sizes-2xl` | `text-2xl` | `1.5rem` |
| `3xl` | `--typography-sizes-3xl` | `text-3xl` | `1.875rem` |
| `4xl` | `--typography-sizes-4xl` | `text-4xl` | `2.25rem` |
| `5xl` | `--typography-sizes-5xl` | `text-5xl` | `3rem` |

#### Font Weights (4 levels)
| Token | CSS Variable | Default |
|-------|--------------|---------|
| `regular` | `--typography-weights-regular` | `400` |
| `medium` | `--typography-weights-medium` | `500` |
| `semibold` | `--typography-weights-semibold` | `600` |
| `bold` | `--typography-weights-bold` | `700` |

#### Line Heights (3 levels)
| Token | CSS Variable | Default |
|-------|--------------|---------|
| `compact` | `--typography-line-heights-compact` | `1.25rem` |
| `standard` | `--typography-line-heights-standard` | `1.5rem` |
| `spacious` | `--typography-line-heights-spacious` | `1.75rem` |

#### Letter Spacing (3-5 levels)
| Token | CSS Variable | Default |
|-------|--------------|---------|
| `tight` | `--typography-letter-spacing-tight` | `-0.02rem` |
| `normal` | `--typography-letter-spacing-normal` | `0rem` |
| `wide` | `--typography-letter-spacing-wide` | `0.04rem` |
| `wider` | `--typography-letter-spacing-wider` | optional |
| `eyebrow` | `--typography-letter-spacing-eyebrow` | optional |

#### Typography Semantics (7 presets)
Map to size/weight combinations in the Typography component:

| Semantic | Maps To | Usage |
|----------|---------|-------|
| `body` | `md` | Default body text |
| `bodyStrong` | `md` + semibold | Emphasized body |
| `caption` | `sm` | Small helper text |
| `button` | `sm` + uppercase | Button labels |
| `eyebrow` | `xs` + uppercase + wide tracking | Section labels |
| `heading` | `2xl` + semibold | Section headings |
| `display` | `4xl` + bold | Page titles |

#### Fluid Typography (optional, 9 levels)
Responsive sizing using CSS `clamp()`:

| Token | CSS Variable | Tailwind Class |
|-------|--------------|----------------|
| `xs` | `--fluid-xs` | `text-fluid-xs` |
| `sm` | `--fluid-sm` | `text-fluid-sm` |
| `base` | `--fluid-base` | `text-fluid-base` |
| `lg` | `--fluid-lg` | `text-fluid-lg` |
| `xl` | `--fluid-xl` | `text-fluid-xl` |
| `2xl` | `--fluid-2xl` | `text-fluid-2xl` |
| `3xl` | `--fluid-3xl` | `text-fluid-3xl` |
| `4xl` | `--fluid-4xl` | `text-fluid-4xl` |
| `hero` | `--fluid-hero` | `text-fluid-hero` |

---

### 8. Spacing (11 tokens)

#### Scale Values (7 levels)
| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `2xs` | `--spacing-2xs` | `p-2xs`, `m-2xs`, `gap-2xs` | `0.125rem` (2px) |
| `xs` | `--spacing-xs` | `p-xs`, `m-xs`, `gap-xs` | `0.25rem` (4px) |
| `sm` | `--spacing-sm` | `p-sm`, `m-sm`, `gap-sm` | `0.5rem` (8px) |
| `md` | `--spacing-md` | `p-md`, `m-md`, `gap-md` | `0.75rem` (12px) |
| `lg` | `--spacing-lg` | `p-lg`, `m-lg`, `gap-lg` | `1rem` (16px) |
| `xl` | `--spacing-xl` | `p-xl`, `m-xl`, `gap-xl` | `1.5rem` (24px) |
| `2xl` | `--spacing-2xl` | `p-2xl`, `m-2xl`, `gap-2xl` | `2rem` (32px) |

#### Semantic Spacing (4 contexts)
| Token | CSS Variable | Default | Usage |
|-------|--------------|---------|-------|
| `pagePadding` | `--spacing-pagePadding` | `1rem` | Page margins |
| `sectionGap` | `--spacing-sectionGap` | `2rem` | Between sections |
| `cardPadding` | `--spacing-cardPadding` | `1rem` | Card content padding |
| `componentGap` | `--spacing-componentGap` | `0.75rem` | Between elements |

---

### 9. Border Radius (6 tokens)

| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `none` | `--radii-none` | `rounded-none` | `0px` |
| `sm` | `--radii-sm` | `rounded-sm` | `4px` |
| `md` | `--radii-md` | `rounded-md` | `8px` |
| `lg` | `--radii-lg` | `rounded-lg` | `16px` |
| `pill` | `--radii-pill` | `rounded-pill` | `999px` |
| `full` | `--radii-full` | `rounded-full` | `9999px` |

---

### 10. Shadows (3 tokens)

| Token | CSS Variable | Tailwind Class | Default |
|-------|--------------|----------------|---------|
| `sm` | `--shadow-sm` | `shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.08)` |
| `md` | `--shadow-md` | `shadow-md` | `0 4px 12px rgba(15, 23, 42, 0.12)` |
| `lg` | `--shadow-lg` | `shadow-lg` | `0 20px 60px rgba(15, 23, 42, 0.18)` |

---

### 11. Motion System (12 tokens)

#### Duration Values (5 levels)
| Token | CSS Variable | Default | Usage |
|-------|--------------|---------|-------|
| `instant` | `--motion-duration-instant` | `50ms` | Instant feedback |
| `fast` | `--motion-duration-fast` | `150ms` | Quick micro-interactions |
| `base` | `--motion-duration-base` | `250ms` | Standard transitions |
| `slow` | `--motion-duration-slow` | `400ms` | Deliberate animations |
| `glacial` | `--motion-duration-glacial` | `800ms` | Page transitions |

#### Easing Curves (4 types)
| Token | CSS Variable | Default | Feel |
|-------|--------------|---------|------|
| `standard` | `--motion-easing-standard` | `cubic-bezier(0.22, 1, 0.36, 1)` | Bouncy, energetic |
| `decelerate` | `--motion-easing-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Slowing down |
| `accelerate` | `--motion-easing-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Speeding up |
| `spring` | `--motion-easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Springy bounce |

#### Feature Flags (3 toggles)
| Token | CSS Variable | Default | Effect |
|-------|--------------|---------|--------|
| `enableParallax` | `--motion-enable-parallax` | `false` | Aurora background animation |
| `enableMagneticHover` | `--motion-enable-magnetic-hover` | `false` | Cursor-following button effect |
| `enableScrollReveal` | `--motion-enable-scroll-reveal` | `false` | Fade-up on scroll |

**Reading motion flags in components:**
```tsx
const { motion } = useThemeConfig();
if (motion.enableMagneticHover) {
    // Apply magnetic effect
}
```

**Hooks that respect motion flags:**
- `useMagneticHover()` - Auto-disabled when `enableMagneticHover: false`
- `useScrollReveal()` - Auto-disabled when `enableScrollReveal: false`

---

### 12. Gradients (optional, 4 types)

| Token | CSS Variable | Structure | Usage |
|-------|--------------|-----------|-------|
| `primary` | `--gradient-primary` | 2 colors | Primary button gradient overlay |
| `accent` | `--gradient-accent` | 2 colors | Accent gradients |
| `text` | `--gradient-text` | 2 colors | Gradient text effects |
| `aurora` | `--gradient-aurora` | 2-4 colors | Atmospheric background |

**Aurora theme example:**
```json
{
  "gradient": {
    "aurora": ["#8B5CF6", "#06B6D4", "#10B981", "#F472B6"]
  }
}
```

---

### 13. Assets (7 fields)

| Field | Required | Usage |
|-------|----------|-------|
| `logoUrl` | No | Brand logo (header, favicon fallback) |
| `wordmarkUrl` | No | Text-based logo variant |
| `faviconUrl` | No | Browser favicon (defaults to logoUrl) |
| `heroIllustrationUrl` | No | Landing page hero image |
| `backgroundTextureUrl` | No | Background texture overlay |
| `fonts.headingUrl` | No | Custom heading font (woff2) |
| `fonts.bodyUrl` | No | Custom body font (woff2) |
| `fonts.monoUrl` | No | Custom mono font (woff2) |

---

### 14. Legal Information (5 fields)

| Field | Required | Usage |
|-------|----------|-------|
| `appName` | Yes | Document title, header display |
| `companyName` | Yes | Footer, legal pages |
| `supportEmail` | Yes | Contact links |
| `privacyPolicyUrl` | Yes | Privacy policy link |
| `termsOfServiceUrl` | Yes | Terms of service link |

---

## Feature Flags

### Marketing Flags
Control page/section visibility:

| Flag | Default | Effect |
|------|---------|--------|
| `showLandingPage` | `false` | Show landing page at `/` instead of dashboard |
| `showMarketingContent` | `false` | Show features grid + CTA on landing page |
| `showPricingPage` | `false` | Enable `/pricing` route |

### Display Flags
| Flag | Default | Effect |
|------|---------|--------|
| `showAppNameInHeader` | `true` | Display app name next to logo in header |

### Effect Flags (in `motion` object)
| Flag | Default | Effect |
|------|---------|--------|
| `enableParallax` | `false` | Animated aurora background |
| `enableMagneticHover` | `false` | Cursor-following on buttons |
| `enableScrollReveal` | `false` | Fade-up animations on scroll |

---

## Admin Access Levels

### Tenant Admin (TenantBrandingPage)
Limited to high-level settings:
- `appName`, `logoUrl`, `faviconUrl`
- `primaryColor`, `secondaryColor`
- Marketing flags (3)

**API:** `PUT /settings/tenant/branding`

### System Admin (TenantEditorModal)
Full control over all 150+ tokens:
- Complete palette, semantic colors, typography
- Spacing, radii, shadows
- Motion system (all durations, easings, flags)
- Gradients, glassmorphism
- Assets with upload capability
- Domain management
- Theme publishing

**API:** `POST /api/admin/tenants`, `POST /api/admin/tenants/:tenantId/publish`

---

## Theme Examples

### Brutalist (Minimal Motion)
```json
{
  "palette": { "primary": "#737373" },
  "motion": {
    "duration": { "instant": 0, "fast": 0, "base": 0, "slow": 0, "glacial": 0 },
    "enableParallax": false,
    "enableMagneticHover": false,
    "enableScrollReveal": false
  }
}
```

### Aurora (Full Effects)
```json
{
  "palette": { "primary": "#8B5CF6", "secondary": "#06B6D4" },
  "semantics": {
    "colors": {
      "gradient": {
        "aurora": ["#8B5CF6", "#06B6D4", "#10B981", "#F472B6"]
      }
    }
  },
  "motion": {
    "duration": { "instant": 50, "fast": 150, "base": 300, "slow": 500, "glacial": 1000 },
    "enableParallax": true,
    "enableMagneticHover": true,
    "enableScrollReveal": true
  }
}
```

---

## CSS Variable Naming Convention

Tokens are flattened to kebab-case CSS variables:

```
tokens.palette.primary           → --palette-primary
tokens.semantics.colors.surface.base → --semantic-colors-surface-base
tokens.typography.sizes.xs       → --typography-sizes-xs
tokens.motion.duration.fast      → --motion-duration-fast
```

RGB variants are auto-generated for opacity support:
```
--surface-base-rgb: 248 250 252
```

Usage in CSS:
```css
background: rgb(var(--surface-base-rgb) / 0.5);
```

---

## Consuming Tokens in Components

### Via Tailwind Classes (preferred)
```tsx
<div className="bg-surface-raised text-text-primary border-border-default">
```

### Via CSS Variables (when needed)
```tsx
<div style={{ gap: 'var(--spacing-md, 0.75rem)' }}>
```

### Via Motion Hooks
```tsx
const { motion } = useThemeConfig();
const magneticRef = useMagneticHover({
    enabled: motion.enableMagneticHover,
    strength: 0.3
});
```

---

## Theme CSS Caching

| Request Type | Cache Header |
|--------------|--------------|
| Versioned (`/theme.css?v=hash`) | `public, max-age=31536000, immutable` |
| Unversioned (`/theme.css`) | Configurable (default: no-cache) |

ETag and Last-Modified headers are set from artifact metadata.

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Token schema definition | `packages/shared/src/types/branding.ts` |
| CSS generation service | `firebase/functions/src/services/tenant/ThemeArtifactService.ts` |
| Theme HTTP handler | `firebase/functions/src/theme/ThemeHandlers.ts` |
| Tailwind semantic mappings | `webapp-v2/tailwind.config.js` |
| Config store | `webapp-v2/src/stores/config-store.ts` |
| Motion config hook | `webapp-v2/src/app/hooks/useThemeConfig.ts` |
| Magnetic hover hook | `webapp-v2/src/app/hooks/useMagneticHover.ts` |
| Scroll reveal hook | `webapp-v2/src/app/hooks/useScrollReveal.ts` |
| Tenant admin page | `webapp-v2/src/pages/TenantBrandingPage.tsx` |
| System admin modal | `webapp-v2/src/components/admin/TenantEditorModal.tsx` |
| Form transformers | `webapp-v2/src/components/admin/tenant-editor/transformers.ts` |
| Example configs | `firebase/docs/tenants/*/config.json` |

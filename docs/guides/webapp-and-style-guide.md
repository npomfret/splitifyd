# Webapp-v2 Architecture & Style Guide

## Table of Contents
1. [CRITICAL: Tenant Configuration Rules](#critical-tenant-configuration-rules)
2. [Stack & Layout](#stack--layout)
3. [Tenant Theming System](#tenant-theming-system)
4. [State & Stores](#state--stores)
5. [API & Data Flow](#api--data--flow)
6. [Navigation & Routing](#navigation--routing)
7. [UI Components & Styling](#ui-components--styling)
8. [Error & Financial Semantics](#error--financial-semantics)
9. [Testing & Tooling](#testing--tooling)
10. [Observability & Resilience](#observability--resilience)

---

## CRITICAL: Tenant Configuration Rules

### ⚠️ SINGLE SOURCE OF TRUTH

**ONE FILE defines all tenants:** `firebase/scripts/tenant-configs.json`

**NEVER:**
- ❌ Create hardcoded tenant arrays in other scripts
- ❌ Duplicate tenant definitions across multiple files
- ❌ Mix tenant configuration sources
- ❌ Add tenants directly to Firestore without updating tenant-configs.json

**ALWAYS:**
- ✅ Edit `tenant-configs.json` to add/remove/modify tenants
- ✅ All scripts MUST read from tenant-configs.json
- ✅ One tenant MUST have `"isDefault": true`
- ✅ After editing tenant-configs.json, restart emulator to reseed

### Tenant Configuration Schema

```json
[
  {
    "id": "localhost-tenant",              // Unique tenant ID
    "domains": ["localhost"],              // Domain mapping (without port)
    "isDefault": true,                     // ONE tenant must be default
    "branding": {
      "appName": "Splitifyd Demo",
      "logoUrl": "/logo.svg",
      "faviconUrl": "/favicon.ico",
      "primaryColor": "#3B82F6",           // Hex color (legacy, not used in new themes)
      "secondaryColor": "#8B5CF6"          // Hex color (legacy, not used in new themes)
    },
    "features": {
      "enableAdvancedReporting": true,
      "enableMultiCurrency": true,
      "enableCustomFields": true,
      "maxGroupsPerUser": 100,
      "maxUsersPerGroup": 50
    }
  }
]
```

### How Tenants Are Loaded

**On emulator startup:**
1. `start-with-data.ts` runs
2. Calls `createDefaultTenant()` → syncs ONLY default tenant
3. Calls `publishLocalThemes({ defaultOnly: true })` → publishes ONLY default tenant theme

**When you run `generate:test-data`:**
1. Calls `createAllDemoTenants()` → syncs ALL tenants from tenant-configs.json
2. Calls `publishLocalThemes()` → publishes ALL tenant themes

### Theme Fixture Mapping

Each tenant ID maps to a branding token fixture in `packages/shared/src/fixtures/branding-tokens.ts`:

```typescript
// In publish-local-themes.ts
const fixtureMap: Record<string, BrandingTokenFixtureKey> = {
  'localhost-tenant': 'localhost',    // Uses Aurora theme
  'partner-tenant': 'loopback',       // Uses Brutalist theme
};
```

**To add a new tenant:**
1. Add entry to `tenant-configs.json`
2. Add mapping to `fixtureMap` in `publish-local-themes.ts` (lines 26-29)
3. Create branding fixture in `@splitifyd/shared/src/fixtures/branding-tokens.ts`
4. Restart emulator

### Verifying Tenant Setup

```bash
# Check how many tenants are configured
cat firebase/scripts/tenant-configs.json | jq length

# Check which tenant is default
cat firebase/scripts/tenant-configs.json | jq '.[] | select(.isDefault == true) | .id'

# Republish all themes after changing configs (USE THIS!)
cd firebase && npm run theme:publish-local

# Or run script directly
npx tsx firebase/scripts/publish-local-themes.ts

# Check generated theme CSS
curl http://localhost:6005/api/theme.css | head -50
curl http://127.0.0.1:6005/api/theme.css | head -50
```

**⚠️ IMPORTANT:** After making ANY changes to:
- Theme generation code (`ThemeArtifactService.ts`)
- Branding token fixtures (`packages/shared/src/fixtures/branding-tokens.ts`)
- Tenant configs (`firebase/scripts/tenant-configs.json`)

You MUST run: `cd firebase && npm run theme:publish-local`

### Common Mistakes

**Mistake: Adding tenants to multiple places**
```typescript
// ❌ WRONG - hardcoded tenant list in publish-local-themes.ts
const TENANT_SEEDS: TenantSeed[] = [
  { tenantId: 'localhost-tenant', ... },
  { tenantId: 'partner-tenant', ... },
  { tenantId: 'NEW_TENANT', ... },  // DON'T DO THIS!
];
```

```json
// ✅ CORRECT - add to tenant-configs.json ONLY
[
  { "id": "localhost-tenant", ... },
  { "id": "partner-tenant", ... },
  { "id": "NEW_TENANT", ... }
]
```

**Mistake: Forgetting to set a default tenant**
```json
// ❌ WRONG - no default tenant
[
  { "id": "tenant1", "isDefault": false },
  { "id": "tenant2", "isDefault": false }
]

// ✅ CORRECT - exactly one default
[
  { "id": "tenant1", "isDefault": true },
  { "id": "tenant2", "isDefault": false }
]
```

**Mistake: Not restarting after changes**
- Editing `tenant-configs.json` does NOT automatically update Firestore
- You MUST restart the emulator or run `publish-local-themes.ts` manually

---

## Stack & Layout
- **Framework**: Preact + TypeScript on Vite
- **Routing**: `preact-router` with lazy-loaded pages
- **Shared code**: Domain types and Zod schemas from `@splitifyd/shared`
- **Firebase**: Wrapped by `firebaseConfigManager` + `FirebaseService` (handles emulator wiring)
- **Source structure**: Feature-first organization:
  - `components/<feature>/` - Feature-specific UI components
  - `pages/` - Route-level page components
  - `app/stores/` - Singleton state stores
  - `app/hooks/` - Reusable hooks
  - `utils/` - Utility functions
  - `__tests__/` - Co-located tests

---

## Tenant Theming System

### Overview
Splitifyd uses a **white-label theming system** where each tenant gets their own branded UI via design tokens. The system generates CSS from structured token data stored in Firestore, ensuring consistent branding across all pages without hardcoded colors or inline styles.

### Architecture

```
Firestore (tenants/{id})
├── brandingTokens (palette, typography, spacing, etc.)
└── artifact (hash, cssUrl, tokensUrl)
          ↓
    POST /api/admin/publishTenantTheme
          ↓
  ThemeArtifactService.ts
  (generates CSS from tokens)
          ↓
    Cloud Storage (gs://splitifyd-themes/)
    ├── {hash}.css
    └── {hash}.tokens.json
          ↓
    GET /api/theme.css
          ↓
    HTML <link rel="stylesheet" href="/api/theme.css">
    (loaded BEFORE Tailwind CSS - critical for CSS cascade)
          ↓
    Tailwind utilities consume CSS variables
    (e.g., bg-interactive-primary → var(--interactive-primary-rgb))
          ↓
    UI components use semantic tokens only
    (NO hardcoded colors, NO inline styles)
```

### Demo Tenants

The system ships with **two distinct demo tenants** for local development:

#### 1. Aurora Theme (`localhost`)
**"Cinematic Glassmorphism"** - A dark, modern UI with neon gradients and animations

**Visual characteristics:**
- Dark atmospheric background (`#090b19`)
- Glassmorphic surfaces with `backdrop-filter: blur(24px)`
- Neon accent colors (cyan `#22d3ee`, indigo `#4f46e5`, pink `#ec4899`)
- Animated aurora backgrounds (gradients moving over 24s)
- Fluid typography with responsive `clamp()` scales
- Smooth animations (320ms cubic-bezier easing)
- Magnetic hover effects, scroll reveals, parallax

**Primary colors:**
```typescript
{
  primary: '#4f46e5',           // Indigo
  accent: '#22d3ee',            // Cyan (neon)
  secondary: '#ec4899',         // Pink
  surface: {
    base: '#090b19',            // Near black
    glass: '#090b19',           // With opacity in CSS
    glassBorder: '#ffffff',     // With opacity in CSS
  },
  text: {
    primary: '#f8fafc',         // Near white
    muted: '#94a3b8',           // Slate
    hero: '#ffffff',            // Pure white for titles
  }
}
```

**Typography:**
- Sans: Space Grotesk, Inter
- Serif: Fraunces, Georgia
- Mono: Geist Mono, JetBrains Mono

**Motion:**
```typescript
{
  duration: { fast: 150, base: 320, slow: 500 },
  easing: { standard: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  enableParallax: true,
  enableMagneticHover: true,
  enableScrollReveal: true
}
```

#### 2. Brutalist Theme (`127.0.0.1` / loopback)
**"Intentionally Bland"** - A minimal, grayscale UI with zero animations

**Visual characteristics:**
- Light background (`#fafafa`)
- Flat surfaces (no glassmorphism, no gradients)
- Grayscale palette (grays 50-900)
- Sharp corners (4px border radius everywhere)
- Zero animations (all durations set to 0ms)
- No parallax, no hover effects, no scroll reveals
- Inter font only

**Primary colors:**
```typescript
{
  primary: '#a1a1aa',           // Gray 400 (everything!)
  accent: '#a1a1aa',
  secondary: '#d4d4d8',
  surface: {
    base: '#fafafa',            // Gray 50
    raised: '#ffffff',
    sunken: '#f4f4f5',
  },
  text: {
    primary: '#18181b',         // Gray 900
    muted: '#71717a',           // Gray 500
  }
}
```

**Typography:**
- Sans: Inter
- Mono: Monaco, Courier New
- No fluid scales, no special letter spacing

**Motion:**
```typescript
{
  duration: { fast: 0, base: 0, slow: 0 },  // ALL zero!
  easing: { standard: 'linear' },
  enableParallax: false,
  enableMagneticHover: false,
  enableScrollReveal: false
}
```

### Semantic Token System

The theming system uses **semantic tokens** that map to tenant-specific values. These are the ONLY colors/styles you should use in components.

#### Surface Colors
```css
--surface-base-rgb: <tenant value>        /* Main background */
--surface-raised-rgb: <tenant value>      /* Elevated cards */
--surface-sunken-rgb: <tenant value>      /* Recessed areas */
--surface-overlay-rgb: <tenant value>     /* Modals, toasts */
--surface-warning-rgb: <tenant value>     /* Warning backgrounds */
--surface-error-rgb: <tenant value>       /* Error backgrounds */
```

**Usage:**
```tsx
<div className="bg-surface-base">           {/* Main page background */}
<Card className="bg-surface-raised">       {/* Elevated card */}
<Modal className="bg-surface-overlay">     {/* Modal backdrop */}
```

#### Text Colors
```css
--text-primary-rgb: <tenant value>        /* Primary text */
--text-muted-rgb: <tenant value>          /* Secondary text */
--text-inverted-rgb: <tenant value>       /* Text on dark backgrounds */
```

**Usage:**
```tsx
<h1 className="text-text-primary">Main Heading</h1>
<p className="text-text-muted">Subtitle or description</p>
<Button className="text-text-inverted">Dark button text</Button>
```

#### Interactive Colors
```css
--interactive-primary-rgb: <tenant value>             /* Primary actions */
--interactive-primary-foreground-rgb: <tenant value>  /* Text on primary */
--interactive-secondary-rgb: <tenant value>           /* Secondary actions */
--interactive-secondary-foreground-rgb: <tenant value>
--interactive-accent-rgb: <tenant value>              /* Accents, highlights */
```

**Usage:**
```tsx
<Button className="bg-interactive-primary text-interactive-primary-foreground">
  Primary Action
</Button>
<Button className="bg-interactive-secondary text-interactive-secondary-foreground">
  Secondary Action
</Button>
<span className="text-interactive-accent">Highlighted term</span>
```

#### Border Colors
```css
--border-subtle-rgb: <tenant value>       /* Very light borders */
--border-default-rgb: <tenant value>      /* Standard borders */
--border-strong-rgb: <tenant value>       /* Emphasized borders */
--border-warning-rgb: <tenant value>      /* Warning borders */
--border-error-rgb: <tenant value>        /* Error borders */
```

**Usage:**
```tsx
<Card className="border border-border-default">
<Input className="border-border-subtle focus:border-border-strong">
<Alert className="border-border-warning">
```

#### Status Colors
```css
--semantic-success-rgb: <tenant value>    /* Success states */
--semantic-warning-rgb: <tenant value>    /* Warning states */
--semantic-error-rgb: <tenant value>      /* Error states */
```

**Usage:**
```tsx
<Badge className="bg-semantic-success text-white">Success</Badge>
<Alert className="bg-surface-warning border-border-warning">Warning</Alert>
<span className="text-semantic-error">Error message</span>
```

### How CSS Variables Work

The `/api/theme.css` endpoint generates CSS like this:

```css
:root {
  /* RGB values for Tailwind's opacity modifiers */
  --surface-base-rgb: 9 11 25;              /* Aurora: #090b19 */
  --text-primary-rgb: 248 250 252;          /* Aurora: #f8fafc */
  --interactive-primary-rgb: 79 70 229;     /* Aurora: #4f46e5 */

  /* Spacing scales */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 0.75rem;
  --spacing-lg: 1rem;
  --spacing-xl: 1.5rem;

  /* Border radii */
  --radius-sm: 8px;      /* Aurora: rounded */
  --radius-md: 12px;
  --radius-lg: 18px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.12), ...;
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.18), ...;

  /* Typography */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;

  /* Motion (Aurora only) */
  --motion-duration-base: 320ms;
  --motion-easing-standard: cubic-bezier(0.22, 1, 0.36, 1);
}
```

**Brutalist theme would generate:**
```css
:root {
  --surface-base-rgb: 250 250 250;          /* #fafafa */
  --text-primary-rgb: 24 24 27;             /* #18181b */
  --interactive-primary-rgb: 161 161 170;   /* #a1a1aa */

  --radius-sm: 4px;      /* Brutalist: sharp corners everywhere */
  --radius-md: 4px;
  --radius-lg: 4px;

  --motion-duration-base: 0ms;              /* Zero animations! */
  --motion-easing-standard: linear;
}
```

### Tailwind Integration

`webapp-v2/tailwind.config.js` maps semantic tokens to Tailwind utilities:

```javascript
{
  colors: {
    'surface-base': 'rgb(var(--surface-base-rgb) / <alpha-value>)',
    'surface-raised': 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
    'text-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
    'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
    'interactive-primary': 'rgb(var(--interactive-primary-rgb) / <alpha-value>)',
    // ... etc
  },
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
  },
  borderRadius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  }
}
```

This allows Tailwind's opacity modifiers to work:
```tsx
<div className="bg-surface-base/80">       {/* 80% opacity */}
<div className="text-text-muted/50">       {/* 50% opacity */}
```

### Critical CSS Cascade Rules

⚠️ **CRITICAL**: Theme CSS MUST load BEFORE Tailwind CSS

**Correct order** (`webapp-v2/index.html`):
```html
<head>
  <!-- 1. Theme CSS loads first (sets CSS variables) -->
  <link rel="stylesheet" href="/api/theme.css">

  <!-- 2. Tailwind CSS loads second (consumes variables) -->
  <script type="module" src="/src/main.tsx"></script>  <!-- includes Tailwind -->
</head>
```

**Why this matters:**
- If Tailwind loads first, its compiled CSS might contain hardcoded fallback values
- If global.css contains `:root { --surface-base-rgb: ... }`, those hardcoded values will override the tenant theme
- Theme CSS variables must be defined BEFORE any CSS that references them

**What NOT to do:**
```css
/* ❌ NEVER put hardcoded CSS variables in global.css */
:root {
  --surface-base-rgb: 255 255 255;   /* This overrides tenant themes! */
  --text-primary-rgb: 15 23 42;
}
```

**What to do instead:**
```css
/* ✅ global.css should only have base styles, no color variables */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply antialiased;
    min-height: 100vh;
  }
}
```

### Styling Rules & Anti-Patterns

⚠️ **CRITICAL RULES** ⚠️

**Each tenant has its own theme. Components must ONLY use semantic tokens.**

#### 🚫 NEVER:

1. **Hardcode Tailwind colors in components**
   ```tsx
   ❌ className="bg-gray-600 text-blue-500 border-red-200"
   ❌ className="bg-white text-black"
   ✅ className="bg-surface-raised text-text-primary border-border-default"
   ```

2. **Use inline styles with hardcoded values**
   ```tsx
   ❌ style={{ backgroundColor: '#ffffff', color: '#000000' }}
   ✅ className="bg-surface-base text-text-primary"
   ```
   Exception: Dynamic values (width percentages, z-index, pointer-events)

3. **Add CSS variables to global.css or component CSS files**
   ```css
   ❌ :root { --surface-base-rgb: 255 255 255; }
   ❌ background: radial-gradient(circle, rgba(106, 13, 173, 0.2), transparent);
   ✅ /* No color definitions in CSS files - use semantic tokens only */
   ```

4. **Cover the aurora background**
   ```tsx
   ❌ <main className="bg-surface-base">  /* Blocks animated background */
   ✅ <main className="">                 /* Transparent, aurora shows through */
   ```

5. **Use hardcoded animations/transitions**
   ```css
   ❌ transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
   ✅ transition: transform calc(var(--motion-duration-base, 320) * 1ms) var(--motion-easing-standard);
   ```

6. **Forget reduced motion**
   ```css
   ❌ /* No accessibility consideration */
   ✅ @media (prefers-reduced-motion: reduce) {
       .animated { transition: none; transform: none; }
     }
   ```

#### ✅ DO: Use semantic tokens

```tsx
// Surfaces
<div className="bg-surface-base">           // Page background
<div className="bg-surface-raised">         // Cards, elevated panels
<div className="bg-surface-overlay">        // Modals, overlays

// Text
<h1 className="text-text-primary">          // Headings, primary content
<p className="text-text-muted">             // Secondary text, captions
<span className="text-text-accent">         // Highlights, links

// Interactive
<button className="bg-interactive-primary text-interactive-primary-foreground">
<button className="bg-interactive-secondary text-interactive-secondary-foreground">

// Borders
<div className="border border-border-default">
<input className="border-border-subtle focus:border-border-strong">

// Status
<div className="bg-surface-warning border-border-warning">
<span className="text-semantic-error">
```

#### ✅ DO: Use motion tokens in CSS

```css
.feature-item {
    transition: transform
        calc(var(--motion-duration-base, 320) * 1ms)
        var(--motion-easing-standard, cubic-bezier(0.22, 1, 0.36, 1));
}

@media (prefers-reduced-motion: reduce) {
    .feature-item { transition: none; }
}
```

#### ✅ DO: Check your work

```bash
# Find hardcoded colors (should return 0 results)
grep -r "bg-gray\|bg-blue\|bg-red\|text-gray\|text-blue\|border-gray" src/components

# Find inline styles (check each one is justified)
grep -r "style=" src/components

# Find hardcoded CSS colors (should only be in theme fixtures)
grep -r "#[0-9a-fA-F]\{6\}" src/styles/
```

### Adding New Semantic Tokens

When you need a new color/style that doesn't exist:

1. **Update the schema** (`packages/shared/src/types/branding.ts`):
```typescript
const BrandingSemanticColorSchema = z.object({
  surface: z.object({
    base: HexColorSchema,
    raised: HexColorSchema,
    // NEW: Add your token here
    highlighted: HexColorSchema,
  }),
  // ...
});
```

2. **Update fixtures** (`packages/shared/src/fixtures/branding-tokens.ts`):
```typescript
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#090b19',
      raised: '#0f1219',
      highlighted: '#1a1f3a',  // ← Aurora value
    },
  },
};

const brutalistSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#fafafa',
      raised: '#ffffff',
      highlighted: '#f4f4f5',  // ← Brutalist value
    },
  },
};
```

3. **Update CSS generator** (`firebase/functions/src/services/theme/ThemeArtifactService.ts`):
```typescript
private generateSemanticCss(semantics: BrandingSemantics): string {
  const rgbVars: string[] = [];

  // Add new token
  rgbVars.push(
    `--surface-highlighted-rgb: ${this.hexToRgb(semantics.colors.surface.highlighted)};`
  );

  return rgbVars.sort().join('\n  ');
}
```

4. **Update Tailwind config** (`webapp-v2/tailwind.config.js`):
```javascript
{
  colors: {
    'surface-highlighted': 'rgb(var(--surface-highlighted-rgb) / <alpha-value>)',
  }
}
```

5. **Use it in components**:
```tsx
<Card className="bg-surface-highlighted">
  Featured content
</Card>
```

6. **Publish updated themes**:
```bash
cd firebase
npm run generate:test-data  # Regenerates all tenant themes
```

### Testing Tenant Themes

#### Viewing Demo Tenants

1. **Start the emulator** (creates default tenant):
```bash
cd firebase
npm run start:with-data
```

2. **Generate full demo data** (creates localhost + loopback tenants):
```bash
cd firebase
npm run generate:test-data
```

3. **View Aurora theme** (localhost):
```
http://localhost:6005/
```
- Should show dark background, neon colors, animations

4. **View Brutalist theme** (loopback):
```
http://127.0.0.1:6005/
```
- Should show light background, grayscale, no animations

#### Verifying Theme CSS

```bash
# Check Aurora theme
curl -H "Host: localhost" http://localhost:5001/splitifyd-dev/us-central1/api/theme.css | head -20

# Check Brutalist theme
curl -H "Host: 127.0.0.1" http://localhost:5001/splitifyd-dev/us-central1/api/theme.css | head -20
```

Should output different CSS variables for each tenant.

#### Playwright Theme Tests

Automated tests intercept `/api/theme.css` and verify UI elements render correct colors:

```typescript
// e2e-tests/src/tests/theme-smoke.test.ts
test('Aurora theme applies correct colors', async ({ page }) => {
  await page.route('**/api/theme.css', route => {
    route.fulfill({
      body: generateThemeCSS(localhostBrandingTokens)
    });
  });

  const button = page.getByRole('button', { name: 'Sign In' });
  const bgColor = await button.evaluate(el =>
    getComputedStyle(el).backgroundColor
  );

  expect(bgColor).toBe('rgb(79, 70, 229)');  // Aurora primary
});
```

### Common Mistakes & Fixes

#### Mistake 1: Modal with hardcoded gray colors
```tsx
// ❌ WRONG
<div className="fixed inset-0 bg-gray-600 bg-opacity-50">
  <div className="bg-white border-gray-300">
    <h3 className="text-gray-900">Title</h3>
    <p className="text-gray-500">Description</p>

// ✅ CORRECT
<div className="fixed inset-0 bg-surface-overlay">
  <div className="bg-surface-raised border-border-default">
    <h3 className="text-text-primary">Title</h3>
    <p className="text-text-muted">Description</p>
```

#### Mistake 2: CSS file with hardcoded gradients
```css
/* ❌ WRONG - breaks theming */
#globe-container {
  background: radial-gradient(circle, rgba(106, 13, 173, 0.2), transparent);
}
.hero {
  background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
}

/* ✅ CORRECT - uses theme tokens */
#globe-container {
  /* No background - let theme handle it */
}
.hero {
  /* Use Tailwind classes with semantic tokens in component */
}
```

#### Mistake 3: Covering the aurora background
```tsx
// ❌ WRONG - solid background blocks animation
<main className="bg-surface-base flex items-center">

// ✅ CORRECT - transparent allows aurora to show
<main className="flex items-center">
```

#### Mistake 4: Hardcoded transitions
```css
/* ❌ WRONG */
.feature-item {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ✅ CORRECT */
.feature-item {
  transition: transform
    calc(var(--motion-duration-base, 320) * 1ms)
    var(--motion-easing-standard, cubic-bezier(0.22, 1, 0.36, 1));
}

@media (prefers-reduced-motion: reduce) {
  .feature-item { transition: none; }
}
```

#### Mistake 5: Hardcoded color values in dark mode
```tsx
// ❌ WRONG - hardcoded purple in dark mode
return 'bg-interactive-secondary/10 text-interactive-primary dark:bg-purple-900/30 dark:text-purple-300';

// ✅ CORRECT - uses semantic tokens for both light and dark
return 'bg-interactive-secondary/10 text-interactive-primary dark:bg-interactive-secondary/30 dark:text-interactive-secondary';
```

---

### How to Fix Tenant-Specific Issues

**Problem: "I want to change the Aurora theme but not the Brutalist theme"**

**CORRECT Solution:** Change the Aurora branding tokens in `packages/shared/src/fixtures/branding-tokens.ts`

```typescript
// packages/shared/src/fixtures/branding-tokens.ts
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#090b19',  // ← Change this for Aurora only
      raised: '#0f1219',
    },
  },
};

// Brutalist tokens remain unchanged
const brutalistSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#fafafa',  // ← Different value for Brutalist
      raised: '#ffffff',
    },
  },
};
```

Then regenerate themes:
```bash
cd firebase
npm run generate:test-data
cd ../webapp-v2
npm run build
```

**WRONG Solution:** ❌ Hardcoding values in components
```tsx
// ❌ NEVER DO THIS - affects ALL tenants
<header style="background-color: rgba(5, 6, 10, 0.7)">
```

---

**Problem: "The body background is too dark on Aurora"**

**CORRECT Solution:** Update Aurora's `surface.base` token

```typescript
// packages/shared/src/fixtures/branding-tokens.ts
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#0a0d15',  // ← Lighter than #05060a
    },
  },
};
```

**WRONG Solutions:**
- ❌ Adding `bg-gray-900` to components
- ❌ Adding `:root { --surface-base-rgb: ... }` to global.css
- ❌ Using inline styles

---

**Problem: "I want glassmorphism on Aurora but not Brutalist"**

**CORRECT Solution:** Add glassmorphism colors to Aurora tokens only

```typescript
// Aurora gets glass effects
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      glass: 'rgba(9, 11, 25, 0.65)',
      glassBorder: 'rgba(255, 255, 255, 0.07)',
    },
  },
};

// Brutalist stays flat
const brutalistSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      glass: '#ffffff',  // Solid white (no transparency)
      glassBorder: '#e5e7eb',  // Solid gray
    },
  },
};
```

Then use in components:
```tsx
<div className="bg-[var(--semantics-colors-surface-glass)]">
  {/* Aurora: transparent glass, Brutalist: solid white */}
</div>
```

---

### Debugging Theme Issues

#### Issue: "All pages look the same regardless of hostname"

**Diagnosis:**
```bash
# 1. Check which tenant is resolving
curl http://localhost:5001/splitifyd-dev/us-central1/api/config

# 2. Verify theme CSS exists
curl http://localhost:5001/splitifyd-dev/us-central1/api/theme.css | head -5

# 3. Check if hardcoded CSS variables are overriding
grep -r ":root {" webapp-v2/src/styles/
```

**Fix:**
- Ensure `firebase/scripts/start-with-data.ts` created tenants
- Check `firebase/scripts/test-data-generator.ts` published themes
- Remove any `:root { --*-rgb: ... }` from `global.css`

#### Issue: "Tailwind classes aren't working"

**Diagnosis:**
```bash
# Check Tailwind config includes semantic tokens
grep "surface-base" webapp-v2/tailwind.config.js
```

**Fix:**
- Ensure `tailwind.config.js` maps all semantic tokens
- Rebuild: `cd webapp-v2 && npm run build`

#### Issue: "Inline styles showing in production"

**Diagnosis:**
```bash
# Lint check will catch these
cd webapp-v2
npm run lint
```

**Fix:**
- Remove `style={{...}}` props
- Use Tailwind utilities or CSS variables instead
- Add `data-testid` for E2E tests instead of targeting classes

---

## State & Stores
- Stores are singleton classes built on `@preact/signals`; expose getters and `ReadonlySignal`s only.
- Reference-counted `registerComponent`/`deregisterComponent` keeps Firebase listeners and activity feeds alive only while in use.
- Auth flow bootstraps the API client (token refresh queueing), theme hydration, user-scoped storage, and downstream stores.
- User-specific persistence (`createUserScopedStorage`) backs recent currencies, draft expenses, etc.; always clear on logout.

---

## API & Data Flow
- `apiClient` centralizes HTTP with buildUrl helpers, request/response interceptors, retry for idempotent verbs, and runtime validation of every payload through ApiSerializer + zod.
- Always pass schemas for new endpoints or add them to the shared schema map; surface validation errors via `ApiError`.
- Hooks compose behavior: e.g. `useExpenseForm` stitches init, form state, and submission hooks; prefer composition over monolith hooks.

---

## Navigation & Routing
- Use `navigationService` for any imperative routing—ensures logging, URL-change detection, and consistent async semantics.
- `ProtectedRoute` gates authenticated pages; defer redirects to effects to avoid navigation from render.
- Route helpers live in `constants/routes.ts`; never hard-code paths.

---

## UI Components & Styling

### Component Library
UI kit under `components/ui` provides audited components:
- `Button` - All variants use semantic tokens
- `Card` - Surfaces with semantic backgrounds
- `Input` - Form controls with semantic borders/text
- `Typography` - Text components with semantic colors
- `Modal`, `Alert`, `Badge` - Status-aware components

### Component Guidelines

#### ✅ DO: Use semantic tokens in all components

```tsx
// Good: Button component using semantic tokens
export function Button({ variant, children }) {
  const classes = {
    primary: 'bg-interactive-primary text-interactive-primary-foreground',
    secondary: 'bg-interactive-secondary text-interactive-secondary-foreground',
    ghost: 'bg-transparent text-text-primary hover:bg-surface-raised',
  };

  return (
    <button className={`${classes[variant]} px-4 py-2 rounded-md`}>
      {children}
    </button>
  );
}
```

#### ❌ DON'T: Hardcode colors in components

```tsx
// Bad: Hardcoded colors
export function Button({ variant, children }) {
  const classes = {
    primary: 'bg-blue-600 text-white',        ❌
    secondary: 'bg-gray-200 text-gray-900',   ❌
  };

  return <button className={classes[variant]}>{children}</button>;
}
```

### Creating New Components

1. **Use semantic tokens only**
2. **Add TypeScript types**
3. **Include accessibility attributes**
4. **Add data-testid for E2E tests**
5. **Log user interactions** (via `logUserAction`)

Example:
```tsx
import { logUserAction } from '@/utils/browser-logger';

export interface CardProps {
  children: ComponentChildren;
  variant?: 'default' | 'elevated' | 'sunken';
  className?: string;
}

export function Card({ children, variant = 'default', className = '' }: CardProps) {
  const baseClasses = 'rounded-lg border';

  const variantClasses = {
    default: 'bg-surface-base border-border-default',
    elevated: 'bg-surface-raised border-border-subtle shadow-md',
    sunken: 'bg-surface-sunken border-border-default',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      data-testid="card"
    >
      {children}
    </div>
  );
}
```

---

## Error & Financial Semantics
- Errors: include `role="alert"` and/or `data-testid="*error*"`; maintain accessible labeling (`aria-invalid`, `aria-describedby`) on inputs.
- Financial amounts that appear red must opt out of error detection with semantic attributes: `data-financial-amount="balance|debt|split|settlement"` (or `data-balance` / `data-debt` when legacy code demands).
- These markers keep e2e error harvesting reliable; new components must follow the pattern.

---

## Testing & Tooling
- Vitest + Testing Library (jsdom) for unit/component coverage; thresholds: branches/functions ≥75%, lines/statements ≥80%.
- Playwright integration tests reuse a shared Chromium instance (`global-setup.ts`) and MSW-style fixtures (`mock-firebase-service.ts`) to fake Firebase+API.
- Prefer MSW handlers and navigationService waits over bespoke polling in tests.
- Page-object models and broader testing conventions live in `docs/guides/testing.md`, `docs/guides/end-to-end_testing.md`, and `docs/guides/building-and-testing.md`—skim those before adding suites.

---

## Observability & Resilience
- `TokenRefreshIndicator` and auth store refresh timers keep sessions alive; `usePolicyAcceptance` polls with abortable requests.
- `streamingMetrics` tracks realtime vs REST fallback health—call `trackRestRefresh` on manual reloads.
- `navigationService.cleanup` and store disposals must run in test teardown to avoid dangling timers/listeners.

---

## Quick Reference

### Semantic Token Cheat Sheet

| Use Case | Tailwind Class | CSS Variable |
|----------|---------------|--------------|
| Main background | `bg-surface-base` | `var(--surface-base-rgb)` |
| Card background | `bg-surface-raised` | `var(--surface-raised-rgb)` |
| Primary text | `text-text-primary` | `var(--text-primary-rgb)` |
| Muted text | `text-text-muted` | `var(--text-muted-rgb)` |
| Primary button | `bg-interactive-primary` | `var(--interactive-primary-rgb)` |
| Button text | `text-interactive-primary-foreground` | `var(--interactive-primary-foreground-rgb)` |
| Border | `border-border-default` | `var(--border-default-rgb)` |
| Success state | `bg-semantic-success` | `var(--semantic-success-rgb)` |
| Error state | `bg-semantic-error` | `var(--semantic-error-rgb)` |

### Commands

```bash
# Start emulator with default tenant only
cd firebase && npm run start:with-data

# Generate all demo tenants (localhost + loopback)
cd firebase && npm run generate:test-data

# Build webapp
cd webapp-v2 && npm run build

# Run linting
cd webapp-v2 && npm run lint
cd webapp-v2 && npm run lint:styles

# Test theme CSS output
curl -H "Host: localhost" http://localhost:5001/splitifyd-dev/us-central1/api/theme.css
curl -H "Host: 127.0.0.1" http://localhost:5001/splitifyd-dev/us-central1/api/theme.css
```

### Common Patterns

```tsx
// Pattern 1: Button with semantic tokens
<Button
  variant="primary"
  className="hover:opacity-90 transition-opacity"
>
  Click Me
</Button>

// Pattern 2: Card with semantic background
<Card className="bg-surface-raised p-6">
  <h2 className="text-text-primary mb-2">Title</h2>
  <p className="text-text-muted">Description</p>
</Card>

// Pattern 3: Status badge
<Badge className="bg-semantic-success text-white">
  Active
</Badge>

// Pattern 4: Form input
<Input
  className="border-border-default focus:border-border-strong"
  error={error}
/>

// Pattern 5: Alert
<Alert className="bg-surface-warning border-border-warning">
  <span className="text-semantic-warning">Warning message</span>
</Alert>
```

---

## Further Reading

- **White-label theming**: `tasks/white-label-plan-1.md` - Complete theming architecture
- **Admin guide**: `docs/guides/white-label-admin-guide.md` - Publishing tenant themes
- **Developer guide**: `docs/guides/white-label-developer-guide.md` - Using semantic tokens
- **Debug runbook**: `docs/guides/white-label-debug-runbook.md` - Troubleshooting themes
- **Testing**: `docs/guides/testing.md`, `docs/guides/end-to-end_testing.md`
- **Building**: `docs/guides/building.md`

# Webapp-v2 Architecture & Style Guide

## Table of Contents
1. [🚨 MANDATORY UX CHANGE RULES 🚨](#-mandatory-ux-change-rules-)
2. [CRITICAL: Tenant Configuration Rules](#critical-tenant-configuration-rules)
3. [Tenant Theming System](#tenant-theming-system)
4. [Motion Enhancement System (Phase 2)](#motion-enhancement-system-phase-2)
5. [Stack & Layout](#stack--layout)
6. [State & Stores](#state--stores)
7. [API & Data Flow](#api--data--flow)
8. [Navigation & Routing](#navigation--routing)
9. [UI Components & Styling](#ui-components--styling)
10. [Error & Financial Semantics](#error--financial-semantics)
11. [Testing & Tooling](#testing--tooling)
12. [Observability & Resilience](#observability--resilience)

---

# 🚨 MANDATORY UX CHANGE RULES 🚨

## THE GOLDEN RULE: NEVER HARDCODE COLORS OR STYLES

**THIS IS A MULTI-TENANT WHITE-LABEL APPLICATION**

Every tenant must have their own unique branding. Any hardcoded color, font, or spacing **BREAKS THE ENTIRE SYSTEM**.

---

## ⛔ ABSOLUTE PROHIBITIONS

### 1. NEVER HARDCODE COLORS IN COMPONENTS

```tsx
// ❌ FORBIDDEN - Will break for all other tenants
<div className="bg-gray-600 text-blue-500">
<div className="bg-white text-black">
<button className="bg-purple-600 hover:bg-purple-700">

// ❌ FORBIDDEN - Inline styles with hardcoded colors
<div style={{ backgroundColor: '#ffffff', color: '#000000' }}>

// ✅ CORRECT - Use semantic tokens ONLY
<div className="bg-surface-raised text-text-primary">
<button className="bg-interactive-primary text-interactive-primary-foreground">
```

**Why this matters:** When Tenant A wants a dark purple brand and Tenant B wants a light blue brand, hardcoded `bg-gray-600` will appear on BOTH tenants and look terrible on one or both.

---

### 2. NEVER ADD CSS VARIABLES TO GLOBAL.CSS OR COMPONENT FILES

```css
/* ❌ FORBIDDEN in global.css or any .css file */
:root {
  --surface-base-rgb: 255 255 255;
  --text-primary-rgb: 0 0 0;
}

/* ❌ FORBIDDEN - Hardcoded gradients in CSS files */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* ✅ CORRECT - No color definitions in CSS files */
/* Colors come ONLY from /api/theme.css which is generated per-tenant */
```

**Why this matters:** CSS variables in global.css will override the tenant's theme CSS, making every tenant look identical.

---

### 3. NEVER USE HARDCODED OPACITY VALUES ON BACKGROUNDS

```tsx
// ❌ FORBIDDEN - Creates see-through unreadable menus
<div className="bg-surface-raised/50">  // 50% transparent - text will be unreadable

// ❌ FORBIDDEN - Semi-transparent overlays that break on light backgrounds
<div className="bg-black/30">

// ✅ CORRECT - Use solid semantic tokens for dropdowns/menus
<div className="bg-surface-raised">     // Fully opaque and readable

// ✅ CORRECT - Use semantic tokens designed for transparency
<div className="bg-surface-glass">      // Controlled glassmorphism from theme
```

**Why this matters:** Dropdown menus, modals, and overlays MUST be readable. Semi-transparent backgrounds make text illegible when content scrolls behind them.

---

### 4. NEVER FORGET TO REPUBLISH THEMES AFTER CHANGES

```bash
# ❌ FORBIDDEN - Making changes without republishing
# You edit branding-tokens.ts
# You refresh the browser
# Nothing changed! You wasted 10 minutes debugging.

# ✅ CORRECT - Always republish after theme changes
cd firebase
npm run theme:publish-local
# Now refresh browser with Cmd+Shift+R (hard refresh)
```

**Why this matters:** Theme changes don't auto-apply. The CSS is cached in Cloud Storage. You MUST regenerate and republish.

---

## ✅ MANDATORY REQUIREMENTS

### 1. EVERY UI CHANGE MUST USE SEMANTIC TOKENS

**Available Semantic Tokens:**

| Category | Token | Usage |
|----------|-------|-------|
| **Surfaces** | `bg-surface-base` | Page background |
| | `bg-surface-raised` | Cards, dropdowns, menus (OPAQUE) |
| | `bg-surface-overlay` | Modals, toasts (OPAQUE) |
| | `bg-surface-glass` | Glassmorphism effects (controlled transparency) |
| **Text** | `text-text-primary` | Headings, primary content |
| | `text-text-secondary` | Subheadings, labels |
| | `text-text-muted` | Captions, metadata |
| **Interactive** | `bg-interactive-primary` | Primary buttons |
| | `text-interactive-primary` | Links, accents |
| | `bg-interactive-primary/10` | Hover backgrounds |
| **Borders** | `border-border-default` | Standard borders |
| | `border-border-subtle` | Light dividers |
| **Status** | `text-semantic-error` | Error messages |
| | `text-semantic-success` | Success states |
| | `text-semantic-warning` | Warning states |

---

### 2. WHEN YOU NEED A NEW COLOR/STYLE

If a semantic token doesn't exist, **DO NOT HARDCODE IT**. Instead:

**Step 1:** Add to schema (`packages/shared/src/types/branding.ts`)
```typescript
const BrandingSemanticColorSchema = z.object({
  surface: z.object({
    base: CssColorSchema,
    raised: CssColorSchema,
    // ✅ Add new token here
    dropdown: CssColorSchema,  // NEW: Solid opaque for dropdowns
  }),
});
```

**Step 2:** Update TenantEditorModal to include the new field
The new token will be configurable via the TenantEditorModal UI. All design values come from Firestore, not code.

**Step 3:** Update CSS generator (`firebase/functions/src/services/theme/ThemeArtifactService.ts`)
```typescript
private generateSemanticCss(semantics: BrandingSemantics): string {
  const rgbVars: string[] = [];

  // Add new token to CSS generation
  rgbVars.push(
    `--surface-dropdown-rgb: ${this.hexToRgb(semantics.colors.surface.dropdown)};`
  );

  return rgbVars.sort().join('\n  ');
}
```

**Step 4:** Update Tailwind config (`webapp-v2/tailwind.config.js`)
```javascript
{
  colors: {
    'surface-dropdown': 'rgb(var(--surface-dropdown-rgb) / <alpha-value>)',
  }
}
```

**Step 5:** Republish themes
```bash
cd firebase
npm run theme:publish-local
```

**Step 6:** Use it
```tsx
<div className="bg-surface-dropdown">
  Now configurable per tenant!
</div>
```

---

### 3. OPACITY RULES FOR READABILITY

**OPAQUE (No transparency) - For text readability:**
- Dropdowns / menus: `bg-surface-raised` (100% opaque)
- Modals / overlays: `bg-surface-overlay` (100% opaque)
- Cards with text: `bg-surface-raised` or `bg-surface-base`

**TRANSPARENT (Controlled) - For visual effects only:**
- Glassmorphism: `bg-surface-glass` (theme-defined transparency)
- Hover states: `bg-interactive-primary/10` (10% opacity)
- Disabled states: `opacity-50`

**Anti-Pattern:**
```tsx
// ❌ NEVER do this - text will be unreadable
<div className="bg-surface-raised/60 backdrop-blur-xl">
  <p>This text is unreadable when content scrolls behind it</p>
</div>

// ✅ CORRECT - fully opaque background
<div className="bg-surface-raised">
  <p>This text is always readable</p>
</div>
```

---

### 4. WORKFLOW FOR UI CHANGES

**Before making ANY UI change, ask yourself:**

1. ✅ Am I using semantic tokens? (`bg-surface-*`, `text-text-*`, etc.)
2. ✅ Is this change configurable per tenant?
3. ✅ Will this work for BOTH Aurora (vibrant dark) AND Brutalist (minimal dark) themes?
4. ✅ Did I avoid hardcoding any colors, fonts, or spacing?
5. ✅ If this uses transparency, is the text still readable?

**After making UI changes:**

1. ✅ Test on both `localhost` (Aurora - vibrant) and `127.0.0.1` (Brutalist - minimal)
2. ✅ Run: `cd firebase && npm run theme:publish-local`
3. ✅ Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
4. ✅ Check for hardcoded colors: `grep -r "bg-gray\|bg-blue\|text-gray" webapp-v2/src/components`
5. ✅ Check for inline styles: `grep -r "style={{" webapp-v2/src/components`

---

## 🔍 DEBUGGING CHECKLIST

### "My theme changes aren't showing up"

- [ ] Did you update the tenant via TenantEditorModal?
- [ ] Did you run `cd firebase && npm run theme:publish-local`?
- [ ] Did you hard refresh the browser (Cmd+Shift+R)?
- [ ] Check browser console: Is `/api/theme.css` loading?
- [ ] Run: `curl http://localhost:6005/api/theme.css | head -20` - Do you see your changes?

### "Text is unreadable / too dark / too light"

- [ ] Is the background using a semantic token? (not hardcoded)
- [ ] Is the background OPAQUE (100% opacity) for text content?
- [ ] Are you using `text-text-primary` (not `text-text-secondary` or darker)?
- [ ] Check the theme fixture - is the color actually light/dark enough?
- [ ] Example: Aurora `text-primary: '#ffffff'` (pure white) for dark backgrounds

### "The menu/dropdown looks transparent and unreadable"

- [ ] Are you using `bg-surface-raised` (opaque) instead of `bg-surface-glass` (transparent)?
- [ ] Did you accidentally add `/50` or opacity to the background?
- [ ] Remove any `backdrop-blur` that conflicts with solid backgrounds
- [ ] Check Aurora theme: `surface.raised` should be `#252944` (solid color, no rgba)

### "Everything looks the same on all tenants"

- [ ] Did you hardcode colors in components? (`bg-gray-600`, etc.)
- [ ] Did you add `:root` variables to `global.css`? (forbidden!)
- [ ] Are you using Tailwind's default colors? (forbidden!)
- [ ] Check: `grep -r "bg-gray\|bg-white\|bg-black" webapp-v2/src/components`

---

## 📝 EXAMPLES

### Example 1: Creating a User Menu Dropdown

```tsx
// ❌ WRONG - Hardcoded, breaks theming, unreadable
export function UserMenu() {
  return (
    <div className="relative">
      <button className="bg-gray-800 text-white px-4 py-2">
        Menu
      </button>
      <div className="absolute bg-white/80 backdrop-blur-xl shadow-lg">
        <a className="text-gray-900 hover:bg-blue-500">Dashboard</a>
        <a className="text-gray-900 hover:bg-blue-500">Settings</a>
      </div>
    </div>
  );
}

// ✅ CORRECT - Uses semantic tokens, readable, tenant-branded
export function UserMenu() {
  return (
    <div className="relative z-50">
      <button className="bg-interactive-primary text-interactive-primary-foreground px-4 py-2 rounded-lg border border-border-default">
        Menu
      </button>
      <div className="absolute bg-surface-raised border border-border-default rounded-xl shadow-2xl">
        <a className="text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary">
          Dashboard
        </a>
        <a className="text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary">
          Settings
        </a>
      </div>
    </div>
  );
}
```

### Example 2: Creating a Glassmorphic Card

```tsx
// ❌ WRONG - Hardcoded transparency, will break
export function Card({ children }) {
  return (
    <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-700">
      {children}
    </div>
  );
}

// ✅ CORRECT - Uses glass token from theme
export function Card({ children, variant = 'base' }) {
  return (
    <Surface variant={variant === 'glass' ? 'glass' : 'base'}>
      {children}
    </Surface>
  );
}

// Usage:
<Card variant="glass">Glassmorphic effect</Card>
<Card variant="base">Solid background</Card>
```

### Example 3: Improving Theme Readability

```typescript
// In packages/shared/src/fixtures/branding-tokens.ts

// ❌ WRONG - Aurora theme is too dark to read
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      raised: 'rgba(30, 35, 55, 0.85)',  // 85% transparent - UNREADABLE!
    },
    text: {
      primary: '#cbd5e1',  // Too gray - hard to read
      secondary: '#64748b',  // Too dark - invisible
    },
  },
};

// ✅ CORRECT - Aurora theme with proper contrast
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      raised: '#252944',  // 100% OPAQUE - fully readable
    },
    text: {
      primary: '#ffffff',  // Pure white - excellent contrast
      secondary: '#e2e8f0',  // Light gray - still readable
    },
  },
};

// Then republish:
// cd firebase && npm run theme:publish-local
```

---

## 🎯 QUICK REFERENCE

### When to Use Each Surface Token

| Situation | Token | Opacity | Reasoning |
|-----------|-------|---------|-----------|
| Page background | `bg-surface-base` | 100% | Main background color |
| Card / Panel | `bg-surface-raised` | 100% | Contains text - must be opaque |
| Dropdown menu | `bg-surface-raised` | 100% | Contains text - must be opaque |
| Modal dialog | `bg-surface-overlay` | 100% | Contains text - must be opaque |
| Glassmorphic effect | `bg-surface-glass` | Theme-defined | Visual effect only, minimal text |
| Hover highlight | `bg-interactive-primary/10` | 10% | Subtle feedback |

### When to Use Each Text Token

| Situation | Token | Example |
|-----------|-------|---------|
| Page title | `text-text-primary` | "Dashboard" |
| Section heading | `text-text-primary` | "Your Groups" |
| Body text | `text-text-primary` | "You have 5 groups" |
| Label / Caption | `text-text-secondary` | "Updated 2 hours ago" |
| Metadata / Muted | `text-text-muted` | "test@example.com" |
| Link / Accent | `text-interactive-primary` | "Learn more" |
| Error message | `text-semantic-error` | "Invalid email" |

---

## 🔒 ADMIN PAGES: EXCEPTION TO BRANDING RULES

### Admin Pages DO NOT Follow Tenant Branding

**✅ CURRENT STATUS (2025-11-21): Admin page isolation is FULLY IMPLEMENTED.**

Admin pages are now completely isolated from tenant theming via AdminLayout component and admin.css stylesheet. Phase 4 (Admin Page Isolation) is complete.

**Current behavior** (implemented): Admin pages (tenant management, system configuration, analytics) have their own **fixed, consistent style** that is **completely separate** from tenant branding.

**Why this matters:**
- Admins need a consistent experience across all tenants
- Clear visual distinction between "admin mode" and "user mode"
- Admin UI should never change when switching between tenants
- Professional, neutral appearance for system management

---

### Admin Page Styling Rules

**Admin pages CAN use hardcoded colors** (exception to the golden rule):

```tsx
// ✅ ALLOWED in admin pages only
// File: webapp-v2/src/pages/admin/TenantsPage.tsx
export function TenantsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <h1 className="text-slate-900 font-semibold">Tenant Management</h1>
      </header>
      <main className="max-w-7xl mx-auto p-6">
        <Card className="bg-white border-slate-200">
          <button className="bg-blue-600 hover:bg-blue-700 text-white">
            Create Tenant
          </button>
        </Card>
      </main>
    </div>
  );
}

// ❌ FORBIDDEN in user-facing pages
// File: webapp-v2/src/pages/DashboardPage.tsx
export function DashboardPage() {
  return (
    <div className="bg-slate-50">  {/* WRONG - breaks tenant branding */}
      <h1 className="text-slate-900">Dashboard</h1>
    </div>
  );
}
```

---

### Admin Theme Specification

**Fixed color palette for admin pages:**

```typescript
// Admin pages use a neutral, professional palette
{
  background: {
    page: '#f8fafc',        // Slate 50
    card: '#ffffff',        // White
    hover: '#f1f5f9',       // Slate 100
  },
  text: {
    primary: '#0f172a',     // Slate 900
    secondary: '#475569',   // Slate 600
    muted: '#94a3b8',       // Slate 400
  },
  border: {
    default: '#e2e8f0',     // Slate 200
    strong: '#cbd5e1',      // Slate 300
  },
  interactive: {
    primary: '#2563eb',     // Blue 600
    primaryHover: '#1d4ed8', // Blue 700
    danger: '#dc2626',      // Red 600
    success: '#16a34a',     // Green 600
  }
}
```

---

### Identifying Admin vs User Pages

**Admin pages** are located in:
- `webapp-v2/src/pages/admin/` - All admin pages
- `webapp-v2/src/components/admin/` - Admin-only components

**User-facing pages** (MUST use tenant branding):
- `webapp-v2/src/pages/` (root level) - DashboardPage, GroupDetailPage, etc.
- `webapp-v2/src/components/` (non-admin) - All user-facing components

**How to tell if you're in an admin page:**

```tsx
// ✅ Admin page - can use hardcoded colors
// File path contains /admin/
webapp-v2/src/pages/admin/TenantsPage.tsx
webapp-v2/src/components/admin/TenantTable.tsx

// ❌ User page - MUST use semantic tokens
// File path does NOT contain /admin/
webapp-v2/src/pages/DashboardPage.tsx
webapp-v2/src/components/dashboard/GroupCard.tsx
```

---

### Admin Page Checklist

**✅ NOTE:** Admin isolation is fully implemented as of Phase 4 completion (2025-11-21).

When creating an admin page (current implementation):

- [x] File is in `src/pages/admin/` or `src/components/admin/`
- [x] Wrapped in `<AdminLayout>` component (not BaseLayout)
- [x] Uses fixed Tailwind colors (gray, indigo, amber) or admin.css variables
- [x] Does NOT use semantic tokens (`bg-surface-*`, `text-text-*`)
- [x] Does NOT load `/api/theme.css` styling (AdminLayout disables it)
- [x] Has AdminHeader with "System Admin" title and logout button
- [x] Uses consistent admin color palette from admin.css

When creating a user page (mandatory requirement):

- [ ] File is NOT in `/admin/` directory
- [ ] Uses ONLY semantic tokens
- [ ] Works for both Aurora (vibrant dark) and Brutalist (minimal dark) themes
- [ ] NO hardcoded colors (except in `/admin/` pages - future exception)
- [ ] Loads tenant branding from `/api/theme.css`

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
    "isDefault": false,                    // ONE tenant must be default
    "branding": {
      "appName": "Splitifyd Demo",
      "logoUrl": "/logo.svg",
      "faviconUrl": "/favicon.ico",
      "primaryColor": "#3B82F6",           // Main interactive color (buttons, links)
      "secondaryColor": "#8B5CF6",         // Secondary actions
      "accentColor": "#EC4899",            // Highlights, focus states (optional)
      "surfaceColor": "#EFF6FF",           // Cards, containers, borders
      "textColor": "#DBEAFE",              // Primary text, headings, overlays
      "marketingFlags": {
        "showLandingPage": true,
        "showMarketingContent": true,
        "showPricingPage": true
      }
    }
  }
]
```

**Branding Field Reference:**

| Field | Description | Used For |
|-------|-------------|----------|
| `primaryColor` | Main brand color | Buttons, links, primary actions |
| `secondaryColor` | Secondary brand color | Secondary buttons, accents |
| `accentColor` | Highlight color (optional) | Focus rings, highlights, text accents |
| `surfaceColor` | Container color | Card backgrounds, borders (derives `surface.base`, `surface.raised`, `border.*`) |
| `textColor` | Text color | Primary text, headings, overlay backgrounds (derives `text.primary`, `text.secondary`, `surface.overlay`) |

### How Tenants Are Loaded

**On emulator startup:**
1. `start-with-data.ts` runs
2. Calls `createDefaultTenant()` → syncs ONLY default tenant
3. Calls `publishLocalThemes({ defaultOnly: true })` → publishes ONLY default tenant theme

**When you run `generate:test-data`:**
1. Calls `createAllDemoTenants()` → syncs ALL tenants from tenant-configs.json
2. Calls `publishLocalThemes()` → publishes ALL tenant themes

### Creating Tenants

**ALL design values come from Firestore, set via TenantEditorModal.**

There are NO fixtures or presets. To create a tenant:

1. Start the emulator
2. Log in as admin
3. Go to Admin → Tenants
4. Click "Create Tenant"
5. Choose "Start from empty" or "Copy from existing tenant"
6. Fill in all required fields (colors, fonts, etc.)
7. Save and publish

**To add a new tenant for development:**
1. Create tenant via TenantEditorModal UI
2. The tenant data is stored in Firestore
3. Run `cd firebase && npm run theme:publish-local` to publish CSS

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
- Tenant data via TenantEditorModal
- Tenant configs (`firebase/scripts/tenant-configs.json`)

You MUST run: `cd firebase && npm run theme:publish-local`

---

## Tenant Theming System

### Overview
BillSplit uses a **white-label theming system** where each tenant gets their own branded UI via design tokens. The system generates CSS from structured token data stored in Firestore, ensuring consistent branding across all pages without hardcoded colors or inline styles.

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
    Cloud Storage (gs://billsplit-themes/)
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
- Dark atmospheric background (`#1a1d2e`)
- Glassmorphic surfaces with `backdrop-filter: blur(24px)`
- Neon accent colors (teal `#34d399`, cyan `#22d3ee`)
- Animated aurora backgrounds (gradients moving over 24s)
- Fluid typography with responsive `clamp()` scales
- Smooth animations (320ms cubic-bezier easing)
- Magnetic hover effects, scroll reveals

**Primary colors:**
```typescript
{
  primary: '#34d399',           // Teal
  accent: '#22d3ee',            // Cyan
  surface: {
    base: '#1a1d2e',            // Dark blue-gray
    raised: '#252944',          // SOLID opaque - fully readable
    overlay: '#1e2336',         // SOLID opaque - fully readable
    glass: 'rgba(25, 30, 50, 0.45)',  // Controlled transparency
  },
  text: {
    primary: '#ffffff',         // Pure white - excellent contrast
    secondary: '#e2e8f0',       // Light gray - still readable
    muted: 'rgba(255, 255, 255, 0.65)',
  }
}
```

#### 2. Brutalist Theme (`127.0.0.1` / loopback)
**"Dark Minimalism"** - A dark, minimal grayscale UI with zero animations

**Visual characteristics:**
- Dark background (`#171717` - neutral-900)
- Flat surfaces (no glassmorphism, no gradients)
- Grayscale palette (neutrals only, no pure white or black)
- Sharp corners (4px border radius everywhere)
- Zero animations (all durations set to 0ms)
- No parallax, no hover effects
- Inter font only

**Primary colors:**
```typescript
{
  primary: '#737373',           // Neutral 500
  secondary: '#525252',         // Neutral 600
  accent: '#a3a3a3',            // Neutral 400
  surface: {
    base: '#171717',            // Neutral 900 (dark)
    raised: '#262626',          // Neutral 800
    overlay: '#404040',         // Neutral 700
  },
  text: {
    primary: '#e5e5e5',         // Neutral 200 (off-white, not pure white)
    secondary: '#a3a3a3',       // Neutral 400
  }
}
```

---

## Motion Enhancement System (Phase 2)

### Overview
BillSplit's motion system provides **tenant-controlled animations and interactions** that enhance UX while maintaining accessibility. Each tenant can enable/disable motion effects via CSS variables, allowing Aurora to have rich animations while Brutalist remains static.

### Tenant-Controlled Motion Flags

Each tenant's theme defines motion behavior via CSS variables:

```css
/* Aurora theme - motion enabled */
:root {
  --motion-enable-magnetic-hover: true;
  --motion-enable-scroll-reveal: true;
  --motion-enable-parallax: true;
}

/* Brutalist theme - motion disabled */
:root {
  --motion-enable-magnetic-hover: false;
  --motion-enable-scroll-reveal: false;
  --motion-enable-parallax: false;
}
```

**Motion respects `prefers-reduced-motion`**: All animations automatically disable when the user has reduced motion preferences.

---

### Motion Hooks

#### `useThemeConfig` - Read Motion Flags

Reads motion configuration from CSS variables:

```tsx
import { useThemeConfig } from '@/app/hooks/useThemeConfig';

export function MyComponent() {
  const { motion } = useThemeConfig();

  if (motion.enableMagneticHover) {
    // Enable magnetic hover effect
  }

  return <div>Content</div>;
}
```

#### `useMagneticHover` - Cursor-Following Effect

Makes elements smoothly follow the cursor with magnetic attraction:

```tsx
import { useMagneticHover } from '@/app/hooks/useMagneticHover';

export function MagneticCard() {
  const ref = useMagneticHover<HTMLDivElement>({
    strength: 0.3,        // How far element moves (0.0 - 1.0)
    transitionDuration: 400,  // Spring-back duration (ms)
    disabled: false,      // Disable for specific elements
  });

  return (
    <div ref={ref} className="card">
      Follows your cursor!
    </div>
  );
}
```

**Automatic behavior:**
- Enabled by default on Aurora theme (`--motion-enable-magnetic-hover: true`)
- Disabled automatically on Brutalist theme (`--motion-enable-magnetic-hover: false`)
- Disabled when button/element is `disabled={true}`
- Uses GPU-accelerated transforms for 60fps performance
- Respects `prefers-reduced-motion`

#### `useScrollReveal` - Fade-In Animations

Reveals elements with fade-up animation when they scroll into view:

```tsx
import { useScrollReveal } from '@/app/hooks/useScrollReveal';

export function RevealCard() {
  const { ref, isVisible } = useScrollReveal({
    threshold: 0.25,  // Trigger when 25% visible
    delay: 100,       // Delay before revealing (ms)
  });

  return (
    <div
      ref={ref}
      className={`fade-up ${isVisible ? 'fade-up-visible' : ''}`}
    >
      Fades in on scroll
    </div>
  );
}
```

**CSS classes** (defined in `global.css`):
```css
.fade-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.fade-up-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .fade-up {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

---

### Button Component - Magnetic Hover

The `Button` component has **magnetic hover enabled by default** via `magnetic={true}`.

```tsx
import { Button } from '@/components/ui/Button';

// ✅ Magnetic hover is enabled by default
<Button onClick={handleClick}>
  Hover me
</Button>

// ❌ Redundant: This is the default behavior
<Button magnetic={true} onClick={handleClick}>
  Magnetic button
</Button>

// ✅ Correct way to disable magnetic hover
<Button magnetic={false} onClick={handleToggle}>
  Toggle Option
</Button>
```

**When to disable magnetic hover:**
- Toggle buttons (Active/Archived filters, switches)
- Buttons in compact layouts where movement could be distracting
- Accessibility reasons (if motion conflicts with screen readers)

**Automatic behavior:**
- Aurora theme: Buttons follow cursor with 0.3 strength
- Brutalist theme: Magnetic effect automatically disabled via CSS variable
- Disabled buttons: Magnetic effect disabled via `disabled` prop

---

### Card Component - Magnetic Hover

The `Card` component supports magnetic hover via the `magnetic` prop:

```tsx
import { Card } from '@/components/ui/Card';

// ✅ Enable magnetic hover on cards
<Card magnetic={true} variant="glass">
  Hover me!
</Card>

// ❌ Default is no magnetic hover (opt-in for cards)
<Card variant="base">
  Static card
</Card>
```

---

### Testing Motion Components

#### Testing Gradient Backgrounds

Primary buttons use **CSS gradients** (`background-image`), not solid colors:

```tsx
// ❌ WRONG - Checks backgroundColor (always returns default/transparent)
const backgroundColor = await button.evaluate(el =>
  getComputedStyle(el).backgroundColor
);
expect(backgroundColor).toBe('rgb(52, 211, 153)');  // FAILS!

// ✅ CORRECT - Checks backgroundImage gradient
const backgroundImage = await button.evaluate(el =>
  getComputedStyle(el).backgroundImage
);

// Extract RGB values from gradient
const rgbMatches = backgroundImage.match(/rgba?\(([^)]+)\)/g);
expect(rgbMatches).toBeTruthy();
expect(rgbMatches![0]).toContain('52, 211, 153');
```

**Helper function** (used in tests):
```tsx
async function expectGradientContainsColor(
  locator: Locator,
  rgbTriplet: string
): Promise<void> {
  const backgroundImage = await locator.evaluate(el =>
    getComputedStyle(el).backgroundImage
  );

  const rgbMatches = backgroundImage.match(/rgba?\(([^)]+)\)/g);
  if (!rgbMatches || rgbMatches.length === 0) {
    throw new Error(`No RGB colors found in gradient: ${backgroundImage}`);
  }

  const expectedRgb = parseRgbString(rgbTriplet);
  const gradientContainsExpectedColor = rgbMatches.some(rgb => {
    const actualRgb = normalizeCssColor(rgb);
    return actualRgb[0] === expectedRgb[0]
      && actualRgb[1] === expectedRgb[1]
      && actualRgb[2] === expectedRgb[2];
  });

  expect(gradientContainsExpectedColor).toBe(true);
}

// Usage in tests:
await expectGradientContainsColor(signUpButton, '52 211 153');
```

#### Testing Theme-Specific Behavior

```tsx
test('Aurora theme has magnetic hover', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Check CSS variable
  const magneticEnabled = await page.evaluate(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--motion-enable-magnetic-hover')
      .trim();
    return value === 'true';
  });

  expect(magneticEnabled).toBe(true);
});

test('Brutalist theme disables magnetic hover', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');

  const magneticEnabled = await page.evaluate(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--motion-enable-magnetic-hover')
      .trim();
    return value === 'true';
  });

  expect(magneticEnabled).toBe(false);
});
```

---

### Motion System Architecture

**Files:**
- `webapp-v2/src/app/hooks/useThemeConfig.ts` - Reads motion flags from CSS variables
- `webapp-v2/src/app/hooks/useMagneticHover.ts` - Magnetic cursor-following effect
- `webapp-v2/src/app/hooks/useScrollReveal.ts` - Scroll-triggered fade-in animations
- `webapp-v2/src/styles/global.css` - `.fade-up` utility classes
- `webapp-v2/src/components/ui/Button.tsx` - Magnetic hover integration
- `webapp-v2/src/components/ui/Card.tsx` - Magnetic hover support

**Motion configuration is per-tenant** (set via TenantEditorModal):

Motion settings are stored in Firestore as part of the tenant's `brandingTokens.motion` field.
Each tenant can enable/disable motion effects independently. Example values:

```typescript
// Aurora-style theme - motion enabled
motion: {
  enableParallax: true,
  enableMagneticHover: true,
  enableScrollReveal: true,
  duration: { base: 250, fast: 150 },
}

// Brutalist-style theme - motion disabled
motion: {
  enableParallax: false,
  enableMagneticHover: false,
  enableScrollReveal: false,
  duration: { base: 0, fast: 0 },
}
```

---

## Stack & Layout
- **Framework**: Preact + TypeScript on Vite
- **Routing**: `preact-router` with lazy-loaded pages
- **Shared code**: Domain types and Zod schemas from `@billsplit/shared`
- **Firebase**: Wrapped by `firebaseConfigManager` + `FirebaseService` (handles emulator wiring)
- **Source structure**: Feature-first organization:
  - `components/<feature>/` - Feature-specific UI components
  - `pages/` - Route-level page components
  - `app/stores/` - Singleton state stores
  - `app/hooks/` - Reusable hooks
  - `utils/` - Utility functions
  - `__tests__/` - Co-located tests

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
UI kit under `components/ui` provides audited components (all use semantic tokens only):

**Core Components:**
- `Button` - All variants use semantic tokens, magnetic hover enabled by default (tenant-controlled)
- `Clickable` - Generic wrapper for interactive elements with analytics logging (see below)
- `Card` - Surfaces with semantic backgrounds, optional magnetic hover support
- `Input` - Form controls with semantic borders/text
- `Typography` - Text components with semantic colors
- `Modal`, `Alert`, `Badge` - Status-aware components

**Phase 3 Components (Advanced UI - COMPLETE 2025-11-21):**
- `Checkbox` - Accessible checkbox with semantic tokens (integrated: LoginPage, BalanceSummary, ExpensesList, SettlementHistory)
- `Radio` - Radio button groups with horizontal/vertical layouts (implemented, ready for integration)
- `Switch` - Toggle switches for settings and preferences (implemented, ready for integration)
- `Select` - Styled dropdown component with custom arrow (implemented, ready for integration)
- `FloatingInput` - Modern input with animated floating labels (implemented, integrated: EmailInput)
- `FloatingPasswordInput` - Password input with visibility toggle and strength meter (implemented, ready for integration)
- `FormField` - Compound wrapper for consistent form layouts with label, error, helper text (implemented, ready for use)
- `GradientText` - Text with gradient backgrounds using CSS variables (integrated: HeroSection, AdminPage)
- `EmptyState` - Reusable empty state component with icon, title, description, actions (integrated: EmptyGroupsState)
- `Toast`/`ToastContainer` - Notification system using Preact signals (integrated: App.tsx)

**Component Status (Updated 2025-11-21):**
- **Integrated:** `Checkbox`, `FloatingInput`, `GradientText`, `EmptyState`, `ToastContainer` are implemented and actively used in the app.
- **Ready for Integration:** `Radio`, `Switch`, `Select`, `FloatingPasswordInput`, `FormField` are fully implemented with semantic tokens, accessibility, and TypeScript types. They are exported from `components/ui/index.ts` and ready to be used in forms.
- **Note:** Some custom checkbox/radio implementations exist for specialized layouts (e.g., card-based radio buttons in `SplitTypeSelector`). These can be migrated to the standard components in future refactoring.

**Motion enhancements:** See [Motion Enhancement System](#motion-enhancement-system-phase-2) for details on magnetic hover, scroll reveals, and theme-controlled animations.

### Interactive Elements & Analytics

**Component-Based Click Logging:**
All interactive elements must use `Button` or `Clickable` components to ensure consistent analytics tracking. **Never use naked `onClick` handlers** on native HTML elements.

#### Button Component
Use for standard button actions:
```tsx
import { Button } from '@/components/ui/Button';

<Button
  onClick={handleSubmit}
  variant="primary"
  aria-label="Submit form"
>
  Submit
</Button>
```

#### Clickable Component
Use for non-button interactive elements (links, icons, images, custom clickables):

```tsx
import { Clickable } from '@/components/ui/Clickable';

// Modal close button
<Clickable
  as="button"              // Render as button element (important for tests!)
  type="button"            // Prevent form submission
  onClick={handleClose}
  className="p-2 rounded-full hover:bg-interactive-primary/10"
  aria-label="Close modal"
  eventName="modal_close"
  eventProps={{ modalName: 'ShareGroup' }}
>
  <XIcon className="w-5 h-5" />
</Clickable>

// Clickable card
<Clickable
  onClick={handleNavigate}
  className="p-4 rounded-lg hover:bg-surface-raised"
  aria-label="View group details"
  eventName="group_card_click"
  eventProps={{ groupId: '123', groupName: 'Trip' }}
>
  <div>Card content</div>
</Clickable>

// Footer link (non-button semantics)
<Clickable
  onClick={handleNavigation}
  className="text-text-secondary hover:text-interactive-primary"
  aria-label="View pricing"
  eventName="footer_link_click"
  eventProps={{ destination: 'pricing' }}
>
  Pricing
</Clickable>
```

**Key Props:**
- `as` - Element type to render (`'button'`, `'span'`, `'div'`, `'a'`, `'img'`). **Use `'button'` for button-like elements!**
- `type` - For buttons, use `'button'` to prevent form submission
- `onClick` - Click handler
- `eventName` - Analytics event name (e.g., `'modal_close'`, `'nav_link_click'`)
- `eventProps` - Additional context (e.g., `{ modalName, groupId, destination }`)
- `aria-label` - Required for accessibility
- `disabled` - Disables interaction and logging
- `className` - Styling classes (use semantic tokens)

**When to Use Each:**
- **Button component**: Standard button actions (submit, cancel, confirm)
- **Clickable with `as="button"`**: Icon buttons, close buttons, action buttons that need custom styling
- **Clickable without `as`**: Clickable text, images, or container elements (defaults to `span`)

**❌ Anti-patterns:**
```tsx
// NEVER: Naked onClick on native elements
<button onClick={handleClick}>...</button>
<div onClick={handleClick}>...</div>
<img onClick={handleClick} />

// NEVER: Missing `as="button"` when replacing <button>
<Clickable onClick={handleClose}>  {/* Renders as span! */}
  <XIcon />
</Clickable>

// NEVER: Missing aria-label for icon-only buttons
<Clickable as="button" onClick={handleClose}>
  <XIcon />  {/* Screen readers can't describe this! */}
</Clickable>
```

**✅ Correct patterns:**
```tsx
// Button-like elements MUST use as="button"
<Clickable
  as="button"
  type="button"
  onClick={handleClose}
  aria-label="Close dialog"
  eventName="modal_close"
>
  <XIcon />
</Clickable>

// Clickable text/links can use default span
<Clickable
  onClick={handleNavigate}
  aria-label="Go to dashboard"
  eventName="nav_link_click"
  eventProps={{ destination: 'dashboard' }}
>
  Dashboard
</Clickable>
```

### Creating New Components

1. **Use semantic tokens only**
2. **Add TypeScript types**
3. **Include accessibility attributes**
4. **Add data-testid for E2E tests**
5. **Use Button or Clickable for interactions** (no naked onClick handlers)

Example:
```tsx
import { Clickable } from '@/components/ui/Clickable';

export interface CardProps {
  children: ComponentChildren;
  variant?: 'default' | 'elevated' | 'glass';
  onClick?: () => void;
  className?: string;
}

export function Card({ children, variant = 'default', onClick, className = '' }: CardProps) {
  const baseClasses = 'rounded-lg border';

  const variantClasses = {
    default: 'bg-surface-base border-border-default',
    elevated: 'bg-surface-raised border-border-subtle shadow-md',
    glass: 'bg-surface-glass border-border-subtle backdrop-blur-xl',
  };

  const content = (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );

  // If clickable, wrap in Clickable component
  if (onClick) {
    return (
      <Clickable
        onClick={onClick}
        aria-label="Card"
        eventName="card_click"
      >
        {content}
      </Clickable>
    );
  }

  return content;
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

### Commands

```bash
# Start emulator with default tenant only
cd firebase && npm run start:with-data

# Generate all demo tenants (localhost + loopback)
cd firebase && npm run generate:test-data

# Republish themes after changes (ALWAYS RUN THIS!)
cd firebase && npm run theme:publish-local

# Build webapp
cd webapp-v2 && npm run build

# Run linting
cd webapp-v2 && npm run lint
cd webapp-v2 && npm run lint:styles

# Test theme CSS output
curl -H "Host: localhost" http://localhost:5001/billsplit-dev/us-central1/api/theme.css
curl -H "Host: 127.0.0.1" http://localhost:5001/billsplit-dev/us-central1/api/theme.css

# Find hardcoded colors (should return 0 results)
grep -r "bg-gray\|bg-blue\|bg-red\|text-gray\|text-blue\|border-gray" webapp-v2/src/components

# Find inline styles (check each one is justified)
grep -r "style={{" webapp-v2/src/components
```

---

## Further Reading

- **Admin guide**: `docs/guides/white-label-admin-guide.md` - Publishing tenant themes
- **Developer guide**: `docs/guides/white-label-developer-guide.md` - Using semantic tokens
- **Debug runbook**: `docs/guides/white-label-debug-runbook.md` - Troubleshooting themes
- **Testing**: `docs/guides/testing.md`, `docs/guides/end-to-end_testing.md`
- **Building**: `docs/guides/building.md`

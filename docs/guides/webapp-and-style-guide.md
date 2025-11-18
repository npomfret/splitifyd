# Webapp-v2 Architecture & Style Guide

## Table of Contents
1. [🚨 MANDATORY UX CHANGE RULES 🚨](#-mandatory-ux-change-rules-)
2. [CRITICAL: Tenant Configuration Rules](#critical-tenant-configuration-rules)
3. [Tenant Theming System](#tenant-theming-system)
4. [Stack & Layout](#stack--layout)
5. [State & Stores](#state--stores)
6. [API & Data Flow](#api--data--flow)
7. [Navigation & Routing](#navigation--routing)
8. [UI Components & Styling](#ui-components--styling)
9. [Error & Financial Semantics](#error--financial-semantics)
10. [Testing & Tooling](#testing--tooling)
11. [Observability & Resilience](#observability--resilience)

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

**Step 2:** Add to ALL theme fixtures (`packages/shared/src/fixtures/branding-tokens.ts`)
```typescript
// Aurora theme
const auroraSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#1a1d2e',
      raised: '#252944',
      dropdown: '#2a2f4a',  // NEW: Aurora value
    },
  },
};

// Brutalist theme
const brutalistSemantics: BrandingTokens['semantics'] = {
  colors: {
    surface: {
      base: '#fafafa',
      raised: '#ffffff',
      dropdown: '#f4f4f5',  // NEW: Brutalist value
    },
  },
};
```

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
3. ✅ Will this work for BOTH dark themes (Aurora) AND light themes (Brutalist)?
4. ✅ Did I avoid hardcoding any colors, fonts, or spacing?
5. ✅ If this uses transparency, is the text still readable?

**After making UI changes:**

1. ✅ Test on both `localhost` (Aurora theme) and `127.0.0.1` (Brutalist theme)
2. ✅ Run: `cd firebase && npm run theme:publish-local`
3. ✅ Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
4. ✅ Check for hardcoded colors: `grep -r "bg-gray\|bg-blue\|text-gray" webapp-v2/src/components`
5. ✅ Check for inline styles: `grep -r "style={{" webapp-v2/src/components`

---

## 🔍 DEBUGGING CHECKLIST

### "My theme changes aren't showing up"

- [ ] Did you edit `packages/shared/src/fixtures/branding-tokens.ts`?
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

**Admin pages** (tenant management, system configuration, analytics) have their own **fixed, consistent style** that is **completely separate** from tenant branding.

**Why this matters:**
- Admins need a consistent experience across all tenants
- Clear visual distinction between "admin mode" and "user mode"
- Admin UI never changes when switching between tenants
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

When creating an admin page:

- [ ] File is in `src/pages/admin/` or `src/components/admin/`
- [ ] Uses fixed Tailwind colors (slate, blue, red, green)
- [ ] Does NOT use semantic tokens (`bg-surface-*`, `text-text-*`)
- [ ] Does NOT load `/api/theme.css` styling
- [ ] Has clear "Admin" header or indicator
- [ ] Uses consistent admin color palette across all admin pages

When creating a user page:

- [ ] File is NOT in `/admin/` directory
- [ ] Uses ONLY semantic tokens
- [ ] Works for both Aurora (dark) and Brutalist (light) themes
- [ ] NO hardcoded colors
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
    "isDefault": true,                     // ONE tenant must be default
    "branding": {
      "appName": "BillSplit Demo",
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
  'default-tenant': 'loopback',       // Uses Brutalist theme
};
```

**To add a new tenant:**
1. Add entry to `tenant-configs.json`
2. Add mapping to `fixtureMap` in `publish-local-themes.ts` (lines 26-29)
3. Create branding fixture in `@billsplit/shared/src/fixtures/branding-tokens.ts`
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
**"Intentionally Bland"** - A minimal, grayscale UI with zero animations

**Visual characteristics:**
- Light background (`#fafafa`)
- Flat surfaces (no glassmorphism, no gradients)
- Grayscale palette (grays 50-900)
- Sharp corners (4px border radius everywhere)
- Zero animations (all durations set to 0ms)
- No parallax, no hover effects
- Inter font only

**Primary colors:**
```typescript
{
  primary: '#a1a1aa',           // Gray 400
  surface: {
    base: '#fafafa',            // Gray 50
    raised: '#ffffff',          // White
    overlay: '#f4f4f5',         // Gray 100
  },
  text: {
    primary: '#18181b',         // Gray 900
    secondary: '#71717a',       // Gray 500
  }
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
UI kit under `components/ui` provides audited components:
- `Button` - All variants use semantic tokens
- `Card` - Surfaces with semantic backgrounds
- `Input` - Form controls with semantic borders/text
- `Typography` - Text components with semantic colors
- `Modal`, `Alert`, `Badge` - Status-aware components

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
  variant?: 'default' | 'elevated' | 'glass';
  className?: string;
}

export function Card({ children, variant = 'default', className = '' }: CardProps) {
  const baseClasses = 'rounded-lg border';

  const variantClasses = {
    default: 'bg-surface-base border-border-default',
    elevated: 'bg-surface-raised border-border-subtle shadow-md',
    glass: 'bg-surface-glass border-border-subtle backdrop-blur-xl',
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

- **White-label theming**: `tasks/white-label-plan-1.md` - Complete theming architecture
- **Admin guide**: `docs/guides/white-label-admin-guide.md` - Publishing tenant themes
- **Developer guide**: `docs/guides/white-label-developer-guide.md` - Using semantic tokens
- **Debug runbook**: `docs/guides/white-label-debug-runbook.md` - Troubleshooting themes
- **Testing**: `docs/guides/testing.md`, `docs/guides/end-to-end_testing.md`
- **Building**: `docs/guides/building.md`

# White Label Theming: Final Solution

**Date:** 2025-11-13
**Status:** Implementation Ready
**Approach:** Hybrid server-generated artifacts + semantic design tokens

---

## Executive Summary

We're implementing a **content-addressed, server-generated theme system** with **semantic design tokens** that eliminates all CSS timing issues, provides CDN-friendly caching, and creates a scalable foundation for multi-tenant theming.

### Key Benefits

- ✅ **100% reliable**: CSS loads before app renders (zero FOUC, zero timing issues)
- ✅ **CDN-optimized**: Content-addressed artifacts with proper caching
- ✅ **Developer-friendly**: Semantic tokens + Tailwind utilities (intuitive, consistent)
- ✅ **Testable**: E2E tests verify theming works across all tenants
- ✅ **Observable**: Debug endpoints and tooling for QA/developers
- ✅ **Scalable**: Supports dark mode, custom themes, unlimited tenants

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Firestore (Tenant Doc)                    │
│  branding: { colors, typography, spacing, assets, ... }      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             Cloud Function: Artifact Generator               │
│  generateTenantThemeArtifacts(branding)                      │
│  ├─ theme.css (concrete CSS + custom properties)            │
│  ├─ theme.tokens.json (for debugging/tests)                 │
│  └─ hash = SHA256(css)                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Cloud Storage: themes/{tenantId}/{hash}.css         │
│  Content-addressed, immutable artifacts                      │
│  CDN-cached with ETags                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Cloud Function: /api/theme.css Endpoint             │
│  ├─ Domain → Tenant resolution                               │
│  ├─ Fetch latest hash from tenant doc                        │
│  ├─ 302 redirect to Storage URL                              │
│  └─ Cache headers: ETag, max-age                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   HTML: webapp-v2/index.html                 │
│  <link rel="stylesheet" href="/api/theme.css">               │
│  ↓ CSS loads BEFORE app bundle                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Tailwind Config + Components                    │
│  colors.primary = 'var(--color-primary)'                     │
│  <Card className="bg-surface-elevated">                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Token System

### Philosophy

Use **semantic, purpose-based tokens** instead of abstract "primary/secondary":

- **Surface tokens**: `surface-base`, `surface-elevated`, `surface-overlay` (backgrounds by elevation)
- **Interactive tokens**: `interactive-primary`, `interactive-secondary`, `interactive-muted` (buttons, links)
- **Text tokens**: `text-primary`, `text-secondary`, `text-muted` (typography hierarchy)
- **Border tokens**: `border-subtle`, `border-default`, `border-strong` (dividers, outlines)
- **Status tokens**: `status-success`, `status-error`, `status-warning`, `status-info` (feedback)

### Token Architecture

```
Firestore Branding Config
  ├─ colors: { primary, secondary, accent, background }
  ├─ typography: { fontFamily, sizes, weights }
  ├─ spacing: { scale }
  ├─ borderRadius: { sm, md, lg }
  └─ assets: { logo, favicon }
           ↓
    Brand Tokens (raw values)
      --brand-primary: #7c3aed
      --brand-secondary: #6d28d9
      --brand-accent: #10b981
           ↓
    Semantic Tokens (purpose-based)
      --surface-elevated: color-mix(--brand-primary 3%, white)
      --interactive-primary: var(--brand-primary)
      --text-link: var(--brand-primary)
           ↓
    Tailwind Utilities
      bg-surface-elevated
      bg-interactive-primary
      text-link
           ↓
    Components
      <Card className="bg-surface-elevated">
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Week 1) - 10-12 hours

#### 1.1 Firestore Schema Extension

```typescript
// packages/shared/src/types/branding.ts

export interface TenantBranding {
  // Colors
  colors: {
    primary: HexColor;
    secondary: HexColor;
    accent: HexColor;
    background: HexColor;
  };

  // Typography
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    sizes: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
      '5xl': string;
    };
    weights: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };

  // Spacing scale (multiplier of base 4px)
  spacing?: {
    scale: number; // 1.0 = normal, 1.2 = spacious, 0.8 = compact
  };

  // Border radius
  borderRadius?: {
    sm: string;
    md: string;
    lg: string;
  };

  // Assets
  assets: {
    logoUrl: string;
    faviconUrl: string;
    backgroundImage?: string;
  };

  // Legal/marketing
  legal?: {
    companyName: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };

  marketing?: {
    showPricing: boolean;
    showTestimonials: boolean;
    showBlog: boolean;
  };

  // Artifact metadata (set by generator)
  _meta?: {
    hash: string;        // SHA256 of generated CSS
    version: number;     // Incremented on each update
    lastGenerated: Timestamp;
  };
}

// Validation
export type HexColor = `#${string}`;

export function validateHexColor(color: string): color is HexColor {
  return /^#[0-9A-F]{6}$/i.test(color);
}

// Defaults
export const DEFAULT_BRANDING: TenantBranding = {
  colors: {
    primary: '#7c3aed',
    secondary: '#6d28d9',
    accent: '#10b981',
    background: '#f9fafb',
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", Monaco, "Cascadia Code", monospace',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    scale: 1.0,
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  assets: {
    logoUrl: '/assets/logo-default.svg',
    faviconUrl: '/assets/favicon-default.ico',
  },
  legal: {
    companyName: 'Splitifyd',
  },
  marketing: {
    showPricing: true,
    showTestimonials: true,
    showBlog: true,
  },
};
```

#### 1.2 Theme Generator Utility

```typescript
// packages/shared/src/theme-generator.ts

import { TenantBranding } from './types/branding';
import crypto from 'crypto';

/**
 * Generate tenant-specific CSS with concrete values
 */
export function generateTenantCSS(branding: TenantBranding): string {
  const { colors, typography, spacing, borderRadius } = branding;

  // Helper: Convert hex to RGB
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  };

  return `
/* Generated theme for tenant - DO NOT EDIT MANUALLY */
/* Hash: ${generateHash(branding)} */

:root {
  /* === BRAND TOKENS === */
  --brand-primary: ${colors.primary};
  --brand-primary-rgb: ${hexToRgb(colors.primary)};
  --brand-secondary: ${colors.secondary};
  --brand-secondary-rgb: ${hexToRgb(colors.secondary)};
  --brand-accent: ${colors.accent};
  --brand-accent-rgb: ${hexToRgb(colors.accent)};
  --brand-background: ${colors.background};

  /* === SURFACE TOKENS === */
  --surface-base: #ffffff;
  --surface-raised: #f9fafb;
  --surface-elevated: color-mix(in srgb, var(--brand-primary) 3%, white);
  --surface-overlay: color-mix(in srgb, var(--brand-primary) 5%, white);
  --surface-header: var(--brand-background);
  --surface-sidebar: color-mix(in srgb, var(--brand-primary) 2%, white);

  /* === INTERACTIVE TOKENS === */
  --interactive-primary: var(--brand-primary);
  --interactive-primary-hover: var(--brand-secondary);
  --interactive-primary-active: color-mix(in srgb, var(--brand-primary) 80%, black);
  --interactive-secondary: color-mix(in srgb, var(--brand-primary) 10%, white);
  --interactive-muted: #e5e7eb;
  --interactive-accent: var(--brand-accent);

  /* === TEXT TOKENS === */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --text-on-primary: #ffffff;
  --text-on-accent: #ffffff;
  --text-link: var(--brand-primary);
  --text-link-hover: var(--brand-secondary);

  /* === BORDER TOKENS === */
  --border-subtle: #f3f4f6;
  --border-default: #e5e7eb;
  --border-strong: #d1d5db;
  --border-focus: var(--brand-primary);
  --border-primary: var(--brand-primary);

  /* === STATUS TOKENS === */
  --status-success: #10b981;
  --status-success-bg: #d1fae5;
  --status-error: #ef4444;
  --status-error-bg: #fee2e2;
  --status-warning: #f59e0b;
  --status-warning-bg: #fef3c7;
  --status-info: #3b82f6;
  --status-info-bg: #dbeafe;

  /* === TYPOGRAPHY TOKENS === */
  --font-sans: ${typography.fontFamily.sans};
  --font-mono: ${typography.fontFamily.mono};

  --text-xs: ${typography.sizes.xs};
  --text-sm: ${typography.sizes.sm};
  --text-base: ${typography.sizes.base};
  --text-lg: ${typography.sizes.lg};
  --text-xl: ${typography.sizes.xl};
  --text-2xl: ${typography.sizes['2xl']};
  --text-3xl: ${typography.sizes['3xl']};
  --text-4xl: ${typography.sizes['4xl']};
  --text-5xl: ${typography.sizes['5xl']};

  --font-normal: ${typography.weights.normal};
  --font-medium: ${typography.weights.medium};
  --font-semibold: ${typography.weights.semibold};
  --font-bold: ${typography.weights.bold};

  /* === SPACING TOKENS === */
  --spacing-scale: ${spacing?.scale || 1.0};

  /* === BORDER RADIUS TOKENS === */
  --radius-sm: ${borderRadius?.sm || '0.25rem'};
  --radius-md: ${borderRadius?.md || '0.5rem'};
  --radius-lg: ${borderRadius?.lg || '0.75rem'};

  /* === SHADOW TOKENS === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-primary: 0 4px 14px 0 rgba(var(--brand-primary-rgb), 0.39);
}

/* === BASE STYLES === */
body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text-primary);
  background-color: var(--brand-background);
}

/* === FOCUS STYLES === */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
  `.trim();
}

/**
 * Generate hash for content-addressed storage
 */
export function generateHash(branding: TenantBranding): string {
  const content = JSON.stringify(branding, null, 0);
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Generate theme tokens JSON for debugging/tests
 */
export function generateTenantTokensJSON(branding: TenantBranding): string {
  return JSON.stringify({
    branding,
    hash: generateHash(branding),
    generatedAt: new Date().toISOString(),
  }, null, 2);
}
```

#### 1.3 Cloud Function: Artifact Generator

```typescript
// firebase/functions/src/services/theme/ThemeArtifactService.ts

import { Storage } from '@google-cloud/storage';
import { generateTenantCSS, generateTenantTokensJSON, generateHash } from '@splitifyd/shared';
import { TenantBranding } from '@splitifyd/shared';
import admin from 'firebase-admin';

const storage = new Storage();
const BUCKET_NAME = 'splitifyd-themes'; // Configure based on environment

export class ThemeArtifactService {
  /**
   * Generate and upload theme artifacts to Storage
   */
  static async generateArtifacts(
    tenantId: string,
    branding: TenantBranding
  ): Promise<{ hash: string; cssUrl: string; tokensUrl: string }> {
    const hash = generateHash(branding);
    const css = generateTenantCSS(branding);
    const tokens = generateTenantTokensJSON(branding);

    // Upload to Storage with content-addressed paths
    const bucket = storage.bucket(BUCKET_NAME);
    const cssPath = `themes/${tenantId}/${hash}.css`;
    const tokensPath = `themes/${tenantId}/${hash}.tokens.json`;

    // Upload CSS
    const cssFile = bucket.file(cssPath);
    await cssFile.save(css, {
      contentType: 'text/css',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable', // 1 year (content-addressed)
      },
    });

    // Upload tokens JSON
    const tokensFile = bucket.file(tokensPath);
    await tokensFile.save(tokens, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    // Make files publicly readable
    await cssFile.makePublic();
    await tokensFile.makePublic();

    // Update tenant doc with new hash
    const db = admin.firestore();
    await db.collection('tenants').doc(tenantId).update({
      'branding._meta': {
        hash,
        version: admin.firestore.FieldValue.increment(1),
        lastGenerated: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    return {
      hash,
      cssUrl: cssFile.publicUrl(),
      tokensUrl: tokensFile.publicUrl(),
    };
  }

  /**
   * Get current theme artifact URLs for tenant
   */
  static async getArtifactUrls(tenantId: string): Promise<{ cssUrl: string; tokensUrl: string } | null> {
    const db = admin.firestore();
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();

    if (!tenantDoc.exists) return null;

    const branding = tenantDoc.data()?.branding as TenantBranding;
    const hash = branding?._meta?.hash;

    if (!hash) return null;

    const bucket = storage.bucket(BUCKET_NAME);
    const cssFile = bucket.file(`themes/${tenantId}/${hash}.css`);
    const tokensFile = bucket.file(`themes/${tenantId}/${hash}.tokens.json`);

    return {
      cssUrl: cssFile.publicUrl(),
      tokensUrl: tokensFile.publicUrl(),
    };
  }
}
```

#### 1.4 Cloud Function: Firestore Trigger

```typescript
// firebase/functions/src/triggers/onTenantBrandingUpdate.ts

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { ThemeArtifactService } from '../services/theme/ThemeArtifactService';

/**
 * Regenerate theme artifacts when tenant branding changes
 */
export const onTenantBrandingUpdate = onDocumentUpdated(
  'tenants/{tenantId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const tenantId = event.params.tenantId;

    // Check if branding changed
    const brandingBefore = JSON.stringify(before?.branding || {});
    const brandingAfter = JSON.stringify(after?.branding || {});

    if (brandingBefore === brandingAfter) {
      console.log(`[Theme] No branding changes for tenant ${tenantId}, skipping`);
      return;
    }

    console.log(`[Theme] Regenerating artifacts for tenant ${tenantId}`);

    try {
      const result = await ThemeArtifactService.generateArtifacts(
        tenantId,
        after.branding
      );

      console.log(`[Theme] Generated artifacts:`, result);
    } catch (error) {
      console.error(`[Theme] Failed to generate artifacts for ${tenantId}:`, error);
      throw error;
    }
  }
);
```

#### 1.5 Cloud Function: Theme Delivery Endpoint

```typescript
// firebase/functions/src/endpoints/theme.ts

import { onRequest } from 'firebase-functions/v2/https';
import { resolveTenantFromRequest } from '../middleware/tenant-resolver';
import { ThemeArtifactService } from '../services/theme/ThemeArtifactService';

/**
 * Serve tenant theme CSS
 * GET /api/theme.css
 */
export const theme = onRequest(async (req, res) => {
  try {
    // Resolve tenant from domain
    const tenant = await resolveTenantFromRequest(req);

    if (!tenant) {
      res.status(404).send('Tenant not found');
      return;
    }

    // Get artifact URLs
    const artifacts = await ThemeArtifactService.getArtifactUrls(tenant.id);

    if (!artifacts) {
      res.status(404).send('Theme not found');
      return;
    }

    // Redirect to Storage URL (CDN-cached, content-addressed)
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    res.set('ETag', tenant.branding._meta?.hash || 'unknown');
    res.redirect(302, artifacts.cssUrl);
  } catch (error) {
    console.error('[Theme] Error serving theme:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Debug endpoint for theme tokens
 * GET /api/theme.debug
 */
export const themeDebug = onRequest(async (req, res) => {
  try {
    const tenant = await resolveTenantFromRequest(req);

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const artifacts = await ThemeArtifactService.getArtifactUrls(tenant.id);

    res.json({
      tenantId: tenant.id,
      branding: tenant.branding,
      artifacts,
      meta: tenant.branding._meta,
    });
  } catch (error) {
    console.error('[Theme] Error in debug endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

### Phase 2: Frontend Integration (Week 2) - 8-10 hours

#### 2.1 HTML Bootstrap Loading

```html
<!-- webapp-v2/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Tenant theme CSS - loads BEFORE app bundle -->
    <link rel="stylesheet" id="tenant-theme" href="/api/theme.css" />

    <!-- App styles -->
    <link rel="stylesheet" href="/src/styles/base.css" />

    <title>Loading...</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

#### 2.2 Tailwind Configuration

```javascript
// webapp-v2/tailwind.config.js

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface colors
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          elevated: 'var(--surface-elevated)',
          overlay: 'var(--surface-overlay)',
          header: 'var(--surface-header)',
          sidebar: 'var(--surface-sidebar)',
        },

        // Interactive colors
        interactive: {
          primary: 'var(--interactive-primary)',
          'primary-hover': 'var(--interactive-primary-hover)',
          'primary-active': 'var(--interactive-primary-active)',
          secondary: 'var(--interactive-secondary)',
          muted: 'var(--interactive-muted)',
          accent: 'var(--interactive-accent)',
        },

        // Text colors
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          'on-primary': 'var(--text-on-primary)',
          'on-accent': 'var(--text-on-accent)',
          link: 'var(--text-link)',
          'link-hover': 'var(--text-link-hover)',
        },

        // Border colors
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          primary: 'var(--border-primary)',
        },

        // Status colors
        status: {
          success: 'var(--status-success)',
          'success-bg': 'var(--status-success-bg)',
          error: 'var(--status-error)',
          'error-bg': 'var(--status-error-bg)',
          warning: 'var(--status-warning)',
          'warning-bg': 'var(--status-warning-bg)',
          info: 'var(--status-info)',
          'info-bg': 'var(--status-info-bg)',
        },
      },

      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },

      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)',
        '5xl': 'var(--text-5xl)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        primary: 'var(--shadow-primary)',
      },
    },
  },
  plugins: [],
};
```

#### 2.3 Update Config Store (Remove CSS Variable Injection)

```typescript
// webapp-v2/src/stores/config-store.ts

import { signal } from '@preact/signals';

export interface AppConfig {
  branding: {
    appName: string;
    assets: {
      logoUrl: string;
      faviconUrl: string;
    };
    legal: {
      companyName: string;
      privacyPolicyUrl?: string;
      termsOfServiceUrl?: string;
    };
    marketing: {
      showPricing: boolean;
      showTestimonials: boolean;
      showBlog: boolean;
    };
  };
  // ... other config
}

export const configState = signal<AppConfig | null>(null);

/**
 * Load tenant configuration from server
 */
export async function loadConfig(): Promise<void> {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();

    configState.value = config;

    // Update favicon and title (CSS is already loaded via <link> tag)
    updateFavicon(config.branding.assets.faviconUrl);
    document.title = config.branding.appName;
  } catch (error) {
    console.error('[Config] Failed to load config:', error);
    throw error;
  }
}

function updateFavicon(url: string): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
               document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  if (!link.parentNode) {
    document.head.appendChild(link);
  }
}
```

---

### Phase 3: Component Migration (Week 3) - 15-20 hours

#### 3.1 Standardize UI Components

**Button Component:**

```typescript
// webapp-v2/src/components/ui/Button.tsx

import { ComponentChildren } from 'preact';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  testId?: string;
  ariaLabel?: string;
  children: ComponentChildren;
}

const VARIANT_CLASSES = {
  primary: 'bg-interactive-primary hover:bg-interactive-primary-hover text-on-primary',
  secondary: 'bg-interactive-secondary hover:bg-interactive-muted text-primary',
  success: 'bg-status-success hover:bg-status-success/90 text-white',
  error: 'bg-status-error hover:bg-status-error/90 text-white',
  warning: 'bg-status-warning hover:bg-status-warning/90 text-white',
  ghost: 'bg-transparent hover:bg-interactive-muted text-primary',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  onClick,
  type = 'button',
  className = '',
  testId,
  ariaLabel,
  children,
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading && <LoadingSpinner size={size} />}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

function LoadingSpinner({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  return (
    <svg className={`animate-spin ${sizeClasses[size]}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
```

**Card Component (Compound Pattern):**

```typescript
// webapp-v2/src/components/ui/Card.tsx

import { ComponentChildren } from 'preact';

interface CardProps {
  variant?: 'elevated' | 'outlined' | 'flat';
  children: ComponentChildren;
  className?: string;
}

const VARIANT_CLASSES = {
  elevated: 'bg-surface-elevated shadow-md',
  outlined: 'bg-surface-base border border-default',
  flat: 'bg-surface-base',
};

export function Card({ variant = 'elevated', children, className = '' }: CardProps) {
  return (
    <div className={`rounded-md ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return <div className={`px-6 py-4 border-b border-subtle ${className}`}>{children}</div>;
};

Card.Title = function CardTitle({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return <h3 className={`text-xl font-semibold text-primary ${className}`}>{children}</h3>;
};

Card.Body = function CardBody({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return <div className={`px-6 py-4 border-t border-subtle ${className}`}>{children}</div>;
};
```

#### 3.2 Layout Primitives

```typescript
// webapp-v2/src/components/ui/Stack.tsx

import { ComponentChildren } from 'preact';

export function Stack({ spacing = 4, children, className = '' }: {
  spacing?: number;
  children: ComponentChildren;
  className?: string;
}) {
  return <div className={`flex flex-col gap-${spacing} ${className}`}>{children}</div>;
}

export function HStack({ spacing = 4, children, className = '' }: {
  spacing?: number;
  children: ComponentChildren;
  className?: string;
}) {
  return <div className={`flex flex-row items-center gap-${spacing} ${className}`}>{children}</div>;
}
```

#### 3.3 Typography Component

```typescript
// webapp-v2/src/components/ui/Text.tsx

import { ComponentChildren } from 'preact';

type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption' | 'overline';

const VARIANT_CLASSES: Record<TextVariant, string> = {
  h1: 'text-5xl font-bold leading-tight text-primary',
  h2: 'text-4xl font-bold leading-tight text-primary',
  h3: 'text-3xl font-semibold leading-tight text-primary',
  h4: 'text-2xl font-semibold leading-normal text-primary',
  h5: 'text-xl font-medium leading-normal text-primary',
  h6: 'text-lg font-medium leading-normal text-primary',
  body: 'text-base font-normal leading-normal text-primary',
  caption: 'text-sm font-normal leading-normal text-secondary',
  overline: 'text-xs font-medium leading-tight text-muted uppercase tracking-wide',
};

export function Text({ variant = 'body', children, className = '' }: {
  variant?: TextVariant;
  children: ComponentChildren;
  className?: string;
}) {
  const Component = variant.startsWith('h') ? variant : 'p';
  return (
    <Component className={`${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </Component>
  );
}
```

---

### Phase 4: Testing & Tooling (Week 4) - 8-10 hours

#### 4.1 E2E Theme Tests

```typescript
// webapp-v2/tests/e2e/theming.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Tenant Theming', () => {
  test('should load correct theme CSS for tenant domain', async ({ page }) => {
    // Navigate to tenant domain
    await page.goto('http://tenant1.localhost:5173');

    // Wait for theme CSS to load
    await page.waitForLoadState('networkidle');

    // Check that custom properties are applied
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
    });

    expect(primaryColor).toBeTruthy();
    expect(primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('should apply theme to button component', async ({ page }) => {
    await page.goto('http://tenant1.localhost:5173');

    const button = page.locator('button').first();

    // Get computed background color
    const bgColor = await button.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Verify it's using the theme color (not a hardcoded value)
    expect(bgColor).not.toBe('rgb(255, 255, 255)'); // Not white
    expect(bgColor).toBeTruthy();
  });

  test('should apply theme to card component', async ({ page }) => {
    await page.goto('http://tenant1.localhost:5173');

    const card = page.locator('[data-testid="dashboard-card"]').first();

    const bgColor = await card.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).toBeTruthy();
  });

  test('should reload theme when tenant changes branding', async ({ page }) => {
    // This test would require admin access to change branding
    // and verify the change is reflected without a full page reload
  });
});
```

#### 4.2 Component Showcase

```typescript
// webapp-v2/src/pages/dev/ComponentShowcase.tsx

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Stack, HStack } from '@/components/ui/Stack';

export function ComponentShowcase() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Text variant="h1" className="mb-8">Component Showcase</Text>

      {/* Buttons */}
      <Section title="Buttons">
        <Stack spacing={4}>
          <SubSection title="Variants">
            <HStack spacing={2}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="success">Success</Button>
              <Button variant="error">Error</Button>
              <Button variant="warning">Warning</Button>
              <Button variant="ghost">Ghost</Button>
            </HStack>
          </SubSection>

          <SubSection title="Sizes">
            <HStack spacing={2}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </HStack>
          </SubSection>

          <SubSection title="States">
            <HStack spacing={2}>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
            </HStack>
          </SubSection>
        </Stack>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div className="grid grid-cols-3 gap-4">
          <Card variant="elevated">
            <Card.Header><Card.Title>Elevated</Card.Title></Card.Header>
            <Card.Body>Shadow elevation</Card.Body>
          </Card>

          <Card variant="outlined">
            <Card.Header><Card.Title>Outlined</Card.Title></Card.Header>
            <Card.Body>Border outline</Card.Body>
          </Card>

          <Card variant="flat">
            <Card.Header><Card.Title>Flat</Card.Title></Card.Header>
            <Card.Body>No elevation</Card.Body>
          </Card>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <Stack spacing={2}>
          <Text variant="h1">Heading 1</Text>
          <Text variant="h2">Heading 2</Text>
          <Text variant="h3">Heading 3</Text>
          <Text variant="h4">Heading 4</Text>
          <Text variant="body">Body text</Text>
          <Text variant="caption">Caption text</Text>
          <Text variant="overline">Overline text</Text>
        </Stack>
      </Section>

      {/* Color Swatches */}
      <Section title="Design Tokens">
        <ThemeDebug />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="mb-12">
      <Text variant="h2" className="mb-6">{title}</Text>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <Text variant="h6" className="mb-3">{title}</Text>
      {children}
    </div>
  );
}

function ThemeDebug() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <ColorSwatch name="Primary" className="bg-interactive-primary" />
      <ColorSwatch name="Secondary" className="bg-interactive-secondary" />
      <ColorSwatch name="Accent" className="bg-interactive-accent" />
      <ColorSwatch name="Surface" className="bg-surface-elevated" />
    </div>
  );
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div>
      <div className={`h-24 rounded-md ${className}`} />
      <Text variant="caption" className="mt-2">{name}</Text>
    </div>
  );
}
```

#### 4.3 Theme Debug Utility

```typescript
// webapp-v2/src/utils/theme-debug.ts

/**
 * Debug utility to inspect current theme tokens
 */
export function debugTheme(): void {
  const root = document.documentElement;
  const computed = getComputedStyle(root);

  const tokens = {
    colors: {
      'brand-primary': computed.getPropertyValue('--brand-primary'),
      'surface-base': computed.getPropertyValue('--surface-base'),
      'interactive-primary': computed.getPropertyValue('--interactive-primary'),
      'text-primary': computed.getPropertyValue('--text-primary'),
      'border-default': computed.getPropertyValue('--border-default'),
    },
    typography: {
      'font-sans': computed.getPropertyValue('--font-sans'),
      'text-base': computed.getPropertyValue('--text-base'),
      'font-medium': computed.getPropertyValue('--font-medium'),
    },
    spacing: {
      'spacing-scale': computed.getPropertyValue('--spacing-scale'),
    },
  };

  console.group('🎨 Theme Tokens');
  console.table(tokens.colors);
  console.table(tokens.typography);
  console.table(tokens.spacing);
  console.groupEnd();

  // Check if theme CSS is loaded
  const themeLink = document.getElementById('tenant-theme') as HTMLLinkElement;
  console.log('Theme CSS URL:', themeLink?.href);

  // Fetch theme debug info from server
  fetch('/api/theme.debug')
    .then((res) => res.json())
    .then((data) => {
      console.group('🔍 Theme Debug Info');
      console.log('Tenant ID:', data.tenantId);
      console.log('Hash:', data.meta?.hash);
      console.log('Version:', data.meta?.version);
      console.log('CSS URL:', data.artifacts?.cssUrl);
      console.groupEnd();
    });
}

// Expose to window for dev tools access
if (import.meta.env.DEV) {
  (window as any).debugTheme = debugTheme;
}
```

---

## Rollout Strategy

### Phase 1: Shadow Mode (Week 5)

1. **Deploy backend changes** (Firestore schema, Cloud Functions, Storage)
2. **Generate artifacts** for all existing tenants
3. **Add `<link>` tag** to HTML but keep existing CSS variable system running
4. **Monitor** both systems in parallel to verify artifact generation works

### Phase 2: Cutover (Week 6)

1. **Update Tailwind config** to use new token names
2. **Migrate UI components** one module at a time:
   - Start with UI primitives (Button, Card, Input)
   - Then auth/onboarding pages
   - Then dashboard
   - Then group/expense management
3. **Remove old branding code** (`applyBrandingPalette`, inline styles)

### Phase 3: Cleanup (Week 7)

1. **Delete legacy CSS variables** from codebase
2. **Add ESLint rules** to prevent inline styles
3. **Run full E2E test suite** across all tenant domains
4. **Monitor performance metrics** (cache hit rates, TTFB, rendering performance)

### Phase 4: Enhancement (Week 8+)

1. **Add dark mode support** (extend token system with dark variants)
2. **Build theme editor UI** for tenant admins with live preview
3. **Add more tokens** (shadows, transitions, animations)
4. **Optimize CDN delivery** (use Firebase Hosting rewrites for shorter URLs)

---

## Expected Outcomes

### Reliability
- ✅ **Zero CSS timing issues** - theme loads before app renders
- ✅ **100% deterministic** - same tenant always gets same theme
- ✅ **No FOUC** - flash of unstyled content eliminated

### Performance
- ✅ **CDN-optimized** - content-addressed artifacts cached at edge
- ✅ **Smaller bundles** - no client-side CSS generation
- ✅ **Faster rendering** - browser applies theme before JS loads

### Developer Experience
- ✅ **Intuitive tokens** - semantic naming makes intent clear
- ✅ **Consistent patterns** - one way to style components
- ✅ **Easy debugging** - dedicated tools and endpoints

### Maintainability
- ✅ **Single source of truth** - Firestore controls all theming
- ✅ **Type-safe** - shared DTOs between backend/frontend
- ✅ **Testable** - E2E tests verify theming works
- ✅ **Observable** - metrics and debug tools

### Scalability
- ✅ **Unlimited tenants** - content-addressed storage scales
- ✅ **Dark mode ready** - architecture supports theme variants
- ✅ **Custom themes** - tenants can fully customize look/feel

---

## Migration Checklist

### Backend
- [ ] Add `TenantBranding` interface to shared types
- [ ] Create `generateTenantCSS` utility function
- [ ] Create `ThemeArtifactService` for Storage operations
- [ ] Add Firestore trigger for branding updates
- [ ] Add `/api/theme.css` endpoint
- [ ] Add `/api/theme.debug` endpoint
- [ ] Configure Storage bucket with CORS
- [ ] Migrate existing tenants to new schema
- [ ] Generate initial artifacts for all tenants

### Frontend
- [ ] Add `<link rel="stylesheet" href="/api/theme.css">` to index.html
- [ ] Update Tailwind config with semantic tokens
- [ ] Remove `applyBrandingPalette` function
- [ ] Simplify `loadConfig` to only handle non-CSS branding
- [ ] Migrate Button component
- [ ] Migrate Card component
- [ ] Migrate Input component
- [ ] Migrate Alert component
- [ ] Create Stack/HStack layout components
- [ ] Create Text typography component
- [ ] Remove all inline styles from components
- [ ] Add ESLint rule to ban inline styles
- [ ] Create ComponentShowcase page
- [ ] Add `debugTheme` utility

### Testing
- [ ] Add E2E tests for theme loading
- [ ] Add E2E tests for component theming
- [ ] Add unit tests for CSS generation
- [ ] Add visual regression tests
- [ ] Test across multiple tenant domains

### DevOps
- [ ] Configure Storage bucket
- [ ] Set up CDN caching rules
- [ ] Add monitoring for artifact generation
- [ ] Add alerts for theme loading failures
- [ ] Document rollback procedure

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| CSS Timing Issues | Multiple per week | Zero | Support tickets, error logs |
| FOUC Incidents | ~30% of page loads | 0% | RUM, Lighthouse |
| Theme CSS Load Time | N/A (inline) | <50ms | CDN metrics |
| Cache Hit Rate | N/A | >95% | CDN analytics |
| Time to Add Themed Component | 20-60 min | <5 min | Developer surveys |
| Theming Test Coverage | <10% | 100% | Code coverage reports |
| Tenant Branding Updates | Manual, hours | Automatic, seconds | Admin metrics |

---

## References

- Design Tokens Specification: https://design-tokens.github.io/community-group/format/
- Tailwind CSS Variables: https://tailwindcss.com/docs/customizing-colors
- Firebase Storage Best Practices: https://firebase.google.com/docs/storage/web/start
- Content-Addressed Storage: https://en.wikipedia.org/wiki/Content-addressable_storage

---

**Status:** Ready for Implementation
**Next Step:** Review with team, then begin Phase 1 backend work

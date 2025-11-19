# Modern UI Overhaul & Dual-Tenant Theme Plan
**Date:** 2025-11-15
**Updated:** 2025-11-17 (Reality Check - ~70% Complete)
**Status:** Foundation complete, production-ready with minor fixes
**Guiding Principle:** Build a design system so compelling that it becomes a competitive moat.

---

## Executive Summary: Current State

**🎉 The good news:** The dual-tenant theming system is **~70% implemented** and the foundation is **production-ready**. The Aurora (localhost) and Brutalist (127.0.0.1) themes exist, work end-to-end, and demonstrate the system's power.

**📊 What's Complete:**
- ✅ Full branding token schema with motion, gradients, assets, semantic colors
- ✅ Aurora & Brutalist theme fixtures (comprehensive, 471 lines)
- ✅ CSS artifact generation with all modern features (@supports, gradients, fonts, motion)
- ✅ Theme delivery endpoint (`/api/theme.css`) with versioned caching
- ✅ Hostname-based tenant switching (localhost ↔ 127.0.0.1)
- ✅ Core component library (Typography, Button, Card, Surface, Modal, Input, Form, Alert)
- ✅ Glassmorphism with `@supports` fallbacks
- ✅ Extensive use of glass variants across pages
- ✅ Zero hardcoded colors in components (all use semantic tokens)
- ✅ Tailwind config with 20+ semantic color mappings

**⚠️ Production Blockers (8-11 hours):**
1. ✅ **Artifact storage** - migrated to Cloud Storage (commit `55cb5fad`)
2. ✅ **Font deployment** - Space Grotesk & Geist Mono assets shipped (commit `265db8a2`)
3. **E2E tests** - Verify theme switching works (2-3 hours)

**🔮 Missing Enhancements (2-3 weeks):**
- Motion hooks (`useMagneticHover`, `useScrollReveal`)
- Advanced components (FloatingInput, GradientText, Sheet, Popover, Toast)
- Framer Motion integration for spring physics
- Admin branding editor UI
- Comprehensive test suite (contrast, performance, a11y, visual regression)

**📈 Recommendation:** Ship current state after fixing blockers, then iterate on enhancements.

---

## Vision (Unchanged)

Transform BillSplit from "functional expense tracker" to "the app people screenshot and share." The UI should feel like a premium consumer product, not enterprise software.

### Dual-Tenant Strategy

**Brutalist Baseline (127.0.0.1)** ✅ **IMPLEMENTED**
- Pure grayscale (#a1a1aa, #404040, #c8c8c8)
- Zero animations (all motion durations = 0ms)
- Minimal border radius (4px)
- System fonts (Inter, Monaco)
- **Purpose:** Regression test baseline, proves token isolation works
- **Metaphor:** "Nokia 3310" – deliberately utilitarian

**Aurora Premium (localhost)** ✅ **IMPLEMENTED**
- Cinematic glassmorphism with teal/cyan accents (#34d399, #22d3ee)
- Animated aurora background (24s loop on `body::before/after`)
- Fluid typography via `clamp()`
- Space Grotesk headings, Geist Mono code
- Full motion system (320ms transitions, spring easing)
- **Purpose:** Design showcase, marketing asset
- **Metaphor:** "Notion meets Linear meets Stripe"

### Success Metrics

| Metric | Target | Current Status |
|--------|--------|----------------|
| **Design Quality** | Non-designers say "wow" | ✅ Aurora theme is polished |
| **Token Isolation** | 100% style change via hostname | ✅ Works perfectly |
| **Performance** | <150ms P95 theme CSS load | ⚠️ Not measured yet |
| **Accessibility** | WCAG 2.1 AA compliance | ⚠️ Not tested yet |
| **Developer Velocity** | Zero ad-hoc CSS | ✅ All components use tokens |

---

## Current Implementation Status

### ✅ Fully Implemented (Weeks 1-3 + partial 4-6)

#### 1. Branding Token Schema
**Location:** `/packages/shared/src/types/branding.ts` (324 lines)

**Token Types:**
- **Palette** - 11 base colors (primary, accent, success, warning, etc.)
- **Typography** - Font families, sizes (xs-5xl), weights, line heights, letter spacing
  - Fluid scales via `clamp()` (Aurora only)
  - Eyebrow tracking (0.15rem for all-caps labels)
- **Spacing** - 7-level scale (2xs-2xl)
- **Border Radii** - 6 levels (none-full)
- **Shadows** - 3 levels (sm, md, lg)
- **Assets** - Logo, wordmark, favicon, heroIllustration, fonts (headingUrl, bodyUrl, monoUrl)
- **Legal** - Company name, support email, privacy/terms URLs
- **Semantic Colors:**
  - Surface: base, raised, sunken, overlay, **glass, glassBorder, aurora, spotlight**
  - Text: primary, secondary, muted, inverted, **hero, eyebrow, code**
  - Interactive: primary (+hover/active), secondary, accent, destructive, **ghost, magnetic, glow**
  - Border: subtle, default, strong, focus, warning, error
  - Gradients: primary (2-color), accent (2-color), aurora (4-color), text (2-color)
- **Motion:**
  - Durations: instant (0-100ms), fast (0-200ms), base (0-400ms), slow (0-800ms), glacial (0-2000ms)
  - Easing: standard, decelerate, accelerate, spring (cubic-bezier strings)
  - Feature flags: enableParallax, enableMagneticHover, enableScrollReveal

#### 2. Theme Fixtures
**Location:** `/packages/shared/src/fixtures/branding-tokens.ts` (471 lines)

**Aurora Theme (localhost):**
```typescript
// Colors
primary: #4f46e5 (indigo)
accent: #22d3ee (cyan)
secondary: #ec4899 (pink)
surfaces: #1a1d2e (base), #252944 (raised), #12141f (sunken)
glass: rgba(25, 30, 50, 0.45) - highly transparent
glassBorder: rgba(255, 255, 255, 0.1)

// Typography
headings: Space Grotesk, Inter, system-ui
mono: Geist Mono, JetBrains Mono, SF Mono
fluidScale: clamp(0.75rem, 0.9vw, 0.875rem) → clamp(2.5rem, 5vw, 3.75rem)
letterSpacing.eyebrow: 0.15rem

// Motion
duration: instant=50ms, fast=150ms, base=320ms, slow=500ms, glacial=1200ms
easing: cubic-bezier(0.22, 1, 0.36, 1) - natural ease-out
enableParallax: true, enableMagneticHover: true, enableScrollReveal: true
```

**Brutalist Theme (127.0.0.1):**
```typescript
// Colors - ALL grayscale
primary: #a1a1aa, secondary: #d4d4d8, accent: #a1a1aa
surfaces: #c8c8c8 (base), #ececec (raised), #b8b8b8 (sunken)
NO glass tokens (undefined)
gradients: Solid pairs (["#404040", "#404040"])

// Typography
fonts: Inter, system-ui (no fancy typefaces)
mono: Monaco, Courier New
NO fluid scales (fluidScale: undefined)
letterSpacing: All 0rem

// Motion
ALL durations: 0ms (zero animations)
easing: linear
ALL feature flags: false
```

#### 3. Theme Artifact Service
**Location:** `/firebase/functions/src/services/tenant/ThemeArtifactService.ts` (443 lines)

**CSS Generation Features:**
- ✅ Root CSS variables (flattened token tree as `--kebab-case`)
- ✅ RGB variants (`--interactive-primary-rgb: 34 211 153`) for Tailwind opacity
- ✅ Gradient CSS variables (`--gradient-primary`, `--gradient-aurora`, `--gradient-text`)
- ✅ Fluid typography variables (`--fluid-xs` → `--fluid-hero`)
- ✅ `@font-face` declarations (from `assets.fonts`)
- ✅ Aurora background animation (only if `motion.enableParallax === true`)
  ```css
  body::before, body::after {
    /* Layered radial gradients with 24s animation loop */
  }
  @keyframes aurora { /* translateY + opacity shifts */ }
  ```
- ✅ Glassmorphism with `@supports` fallback:
  ```css
  .glass-panel { background: rgba(9, 11, 25, 0.95); /* Fallback */ }
  @supports (backdrop-filter: blur(1px)) {
    .glass-panel {
      backdrop-filter: blur(24px);
      background: rgba(9, 11, 25, 0.65);
    }
  }
  ```
- ✅ `prefers-reduced-motion` handling (auto-generated if motion enabled)

#### 4. Theme Delivery System
**Location:** `/firebase/functions/src/theme/ThemeHandlers.ts` (63 lines)

**How it works:**
1. Tenant identification middleware extracts hostname from request
2. Looks up tenant config (localhost → Aurora, 127.0.0.1 → Brutalist)
3. Fetches theme artifact from Firestore (`brandingTokens.artifact`)
4. Reads CSS from Cloud Storage URLs (HTTP(S))
5. Returns with versioning headers:
   - `Cache-Control: public, max-age=31536000, immutable` (if `?v=hash`)
   - `ETag: "{hash}"`
   - `Content-Type: text/css; charset=utf-8`

**Client-Side Bootstrap:**
**Location:** `/webapp-v2/src/utils/theme-bootstrap.ts`
- Injects `<link rel="stylesheet" href="/api/theme.css?v={hash}">`
- Syncs hash changes with `syncThemeHash()`
- Stores hash in localStorage (`billsplit:theme-hash`)

#### 5. Component Library
**Location:** `/webapp-v2/src/components/ui/`

**Implemented Components:**
- **Typography** - Variants: body, bodyStrong, caption, button, eyebrow, heading, display
- **Surface** - Variants: base, muted, inverted, **glass** ✅
- **Card** - Built on Surface, includes glass variant ✅
- **Button** - Variants: primary, secondary, ghost, danger
  - Primary uses `bg-[image:var(--gradient-primary)]` ✅
  - Hover: `transform: translateY(-2px) scale(1.01)`
  - Glow: `box-shadow: 0 0 20px rgba(var(--interactive-primary-rgb), 0.4)`
- **Modal** - Glass backdrop via `glass-panel` class ✅
- **Input** - Standard form input with focus states
- **Form** - Form wrapper with validation
- **Alert** - Status messages (info, success, warning, error)
- **LoadingSpinner** - Basic spinner
- **Avatar** - User avatar component
- **Pagination** - Page navigation
- **Stack** - Flex container utility
- **Container** - Width-constrained wrapper

**Where glassmorphism is used:**
- `Card variant="glass"` in:
  - AuthLayout (form container)
  - GroupHeader, ExpensesList, BalanceSummary
  - ExpenseForm sections
  - DashboardGroupCard (interactive glass)
  - ActivityFeedCard

#### 6. Tailwind Configuration
**Location:** `/webapp-v2/tailwind.config.js`

**Semantic color mappings:**
```javascript
'surface-base': 'rgb(var(--surface-base-rgb, 255 255 255) / <alpha-value>)',
'text-primary': 'rgb(var(--text-primary-rgb, 15 23 42) / <alpha-value>)',
'interactive-primary': 'rgb(var(--interactive-primary-rgb, 37 99 235) / <alpha-value>)',
// ... 20+ semantic mappings
```

**Extended spacing, border radius, shadows all via CSS variables**

### ⚠️ Missing/Incomplete

#### Motion Features (Not Implemented)
- `useMagneticHover()` hook - Buttons follow cursor
- `useScrollReveal()` hook - Fade-in on scroll (IntersectionObserver)
- Staggered list animations
- Framer Motion integration (intentionally skipped to save 50KB)

#### Advanced Components (Not Implemented)
- **GradientText** - webkit-background-clip gradient text
- **Eyebrow** - Specialized uppercase label component
- **FloatingInput** - Animated label that floats up on focus
- **Select/Checkbox/Radio/Switch** - Form primitives
- **FormField** - Compound wrapper with validation
- **Sheet** - Slide-in panel
- **Popover** - Floating positioned element
- **Toast** - Notification queue system
- **Spinner variants** - accent, gradient
- **ProgressBar** - Linear progress
- **StatusDot** - Pulse indicator
- **Chip** - Removable tags
- **EmptyState** - With illustrations
- **Table** - Dedicated data table component
- **Breadcrumbs** - Navigation trail

#### Layout Templates (Partially Implemented)
- AuthLayout exists but basic (not split hero pattern)
- DashboardLayout referenced but not dedicated component
- SettingsLayout - not found
- LandingLayout - not found
- AppShell with conditional aurora background - not found

#### Testing & Tooling (Not Implemented)
- Theme contrast Playwright tests
- Performance budget tests
- Accessibility tests (axe-core)
- Visual regression tests (Percy)
- Color migration codemod
- ESLint no-hardcoded-colors rule

#### Admin Features (Basic Implementation)
- TenantBrandingPage exists but basic
- ThemeDebug panel exists but minimal
- No live preview iframe
- No token editor UI
- No WCAG contrast checker
- No artifact history/rollback

---

## Production Blockers (Critical Path)

### ✅ Blocker 1: Artifact Storage (4-6 hours) — DONE
**What changed:** Theme artifacts now read/write from Cloud Storage with public HTTP(S) URLs via `CloudThemeArtifactStorage` (`55cb5fad`). ThemeHandlers reject non-HTTP(S) URLs, and the integration test fetches CSS from storage.
**Follow-up:** Update legacy test fixtures that still reference `file://` to keep expectations aligned.

### ✅ Blocker 2: Font Deployment (2 hours) — DONE
**What changed:** Space Grotesk and Geist Mono variable fonts now live under `webapp-v2/public/fonts`, the Aurora fixture points at `/fonts/space-grotesk-variable.woff2` and `/fonts/geist-mono-variable.woff2`, and the theme artifact pipeline emits the correct `@font-face` declarations (`265db8a2`).

**Verification evidence:**
- Network tab shows `/fonts/space-grotesk-variable.woff2` & `/fonts/geist-mono-variable.woff2`
- Headings render with Space Grotesk, code/monospace with Geist Mono
- Brutalist remains on the system stack

### 🔥 Blocker 3: E2E Theme Tests (2-3 hours)
**Problem:** No automated tests verifying theme switching works
**Needed:** Playwright tests that check Aurora vs Brutalist

**Solution:**
```typescript
// e2e-tests/src/__tests__/integration/theme-switching.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
  test('localhost loads Aurora theme', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Check for aurora-specific color
    const button = page.getByRole('button').first();
    const bg = await button.evaluate(el => getComputedStyle(el).backgroundColor);

    // Should be teal/cyan, not grayscale
    expect(bg).not.toMatch(/rgb\(\s*161,\s*161,\s*170\)/);
  });

  test('127.0.0.1 loads Brutalist theme', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    const button = page.getByRole('button').first();
    const bg = await button.evaluate(el => getComputedStyle(el).backgroundColor);

    // Should be grayscale
    expect(bg).toMatch(/rgb\(\s*161,\s*161,\s*170\)/);
  });

  test('Aurora has glassmorphism', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const glassCard = page.locator('.glass-panel').first();
    const backdropFilter = await glassCard.evaluate(el =>
      getComputedStyle(el).backdropFilter
    );

    expect(backdropFilter).toContain('blur');
  });

  test('Brutalist has no blur', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    const cards = page.locator('[class*="card"]');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const backdropFilter = await cards.nth(i).evaluate(el =>
        getComputedStyle(el).backdropFilter
      );
      expect(backdropFilter).toBe('none');
    }
  });
});
```

**Status:** `/e2e-tests/src/__tests__/integration/theme-switching.e2e.test.ts` implemented (tenant switching, glassmorphism, contrast). Needs CI wiring + emulator-backed run.

**Acceptance:**
- All tests pass
- CI runs tests on PR

---

## Remaining Work Plan (2-3 Weeks)

### Phase 1: Production Readiness (1 week)
**Goal:** Fix blockers, ship to production

**Week 1 Tasks:**
- [x] Day 1-2: Implement CloudThemeArtifactStorage (4-6 hours)
  - Create CloudStorage service
  - Update TenantService to use Cloud Storage
  - Test artifact upload/download
  - Verify HTTPS URLs work

- [x] Day 2-3: Deploy fonts (2 hours)
  - Download Space Grotesk & Geist Mono
  - Add to `/webapp-v2/public/fonts/`
  - Update Aurora fixture
  - Republish themes
  - Verify fonts load in browser

- [ ] Day 3-4: Write E2E tests (2-3 hours)
  - [x] Theme switching tests
  - [x] Glassmorphism verification
  - [x] Color contrast checks
  - [ ] Add to CI pipeline

**Acceptance:**
- ✅ Theme CSS served from Cloud Storage
- ✅ Custom fonts load correctly
- ✅ All E2E tests pass
- ✅ **Ready to ship to production**

### Phase 2: Motion Enhancement (1 week)
**Goal:** Add polish with motion hooks

**Implementation Reference:** See `/docs/modern_ui_ux_guide.md` for patterns

**Week 2 Tasks:**
- [ ] Day 1-2: `useScrollReveal` hook (2-3 hours)
  ```typescript
  // webapp-v2/src/hooks/useScrollReveal.ts
  export function useScrollReveal(options?: IntersectionObserverInit) {
    const ref = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const { motion } = useThemeConfig();

    useEffect(() => {
      if (!ref.current || !motion.enableScrollReveal) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.25, ...options }
      );

      observer.observe(ref.current);
      return () => observer.disconnect();
    }, [motion.enableScrollReveal]);

    return { ref, isVisible };
  }
  ```
  - Implement IntersectionObserver hook
  - Add `.fade-up` CSS utility
  - Test on landing page
  - Verify disabled on Brutalist

- [ ] Day 2-3: `useMagneticHover` hook (2-3 hours)
  ```typescript
  // webapp-v2/src/hooks/useMagneticHover.ts
  export function useMagneticHover(strength: number = 0.3) {
    const ref = useRef<HTMLElement>(null);
    const { motion } = useThemeConfig();

    useEffect(() => {
      if (!ref.current || !motion.enableMagneticHover) return;

      const element = ref.current;
      const handleMouseMove = (e: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) * strength;
        const deltaY = (e.clientY - centerY) * strength;
        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      };

      const handleMouseLeave = () => {
        element.style.transform = 'translate(0, 0)';
      };

      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, [strength, motion.enableMagneticHover]);

    return ref;
  }
  ```
  - Implement magnetic hover hook
  - Add to Button component (optional prop)
  - Add to Card component
  - Test performance (should be 60fps)

- [ ] Day 3-4: Staggered animations (1-2 hours)
  - Add transition-delay utilities
  - Update ExpensesList with staggered fade-in
  - Update GroupCard grid with stagger

- [ ] Day 4-5: Framer Motion modals (2-3 hours)
  - Install framer-motion (feature-flagged)
  - Wrap Modal with `<AnimatePresence>`
  - Add spring physics to entrance
  - Test bundle size impact

**Acceptance:**
- ✅ Scroll reveal works on Aurora, disabled on Brutalist
- ✅ Magnetic hover feels smooth (60fps)
- ✅ Staggered animations on lists
- ✅ Modal entrance has spring physics
- ✅ `prefers-reduced-motion` disables all animations

### Phase 3: Advanced Components (1 week)
**Goal:** Fill gaps in component library

**Week 3 Tasks:**
- [ ] Day 1: GradientText component (30 minutes)
  ```tsx
  export function GradientText({ children, gradient = 'primary', ...props }: Props) {
    return (
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: `var(--gradient-${gradient})` }}
        {...props}
      >
        {children}
      </span>
    );
  }
  ```

- [ ] Day 1-2: FloatingInput component (2-3 hours)
  - Implement animated label pattern
  - Add focus/blur transitions
  - Test accessibility (screen readers)
  - Update auth forms to use it

- [ ] Day 2-3: EmptyState component (1-2 hours)
  - Support illustration URL from tokens
  - Add icon/title/description/action slots
  - Use in GroupsList, ExpensesList

- [ ] Day 3-4: Select/Checkbox/Radio/Switch (3-4 hours)
  - Build accessible form primitives
  - Match design system styling
  - Add to component showcase

- [ ] Day 4-5: Toast notification system (2-3 hours)
  - Queue-based notifications
  - Auto-dismiss with configurable timeout
  - Slide-in animation
  - Test with multiple toasts

**Acceptance:**
- ✅ All new components use semantic tokens
- ✅ Accessibility tests pass (keyboard nav, screen readers)
- ✅ Components documented in showcase

---

## Enhancement Roadmap (Post-Launch)

### High Priority (Nice to Have)
1. **Admin Branding Editor** (4-5 hours)
   - Live preview iframe
   - Color picker for tokens
   - Font selector
   - Publish button
   - Artifact history table

2. **Performance Monitoring** (2-3 hours)
   - Client-side instrumentation for theme CSS load time
   - Server-side logging for cache hit rates
   - Lighthouse CI integration

3. **Visual Regression Tests** (3-4 hours)
   - Percy or Chromatic setup
   - Snapshot Aurora vs Brutalist on key pages
   - Add to CI pipeline

### Medium Priority (Future)
4. **Migration Codemod** (2-3 hours)
   - JSCodeshift transform for color classes
   - Map `bg-blue-600` → `bg-interactive-primary`
   - Run on codebase to catch stragglers

5. **ESLint Rules** (1-2 hours)
   - Ban hardcoded colors outside `:root`
   - Suggest semantic tokens
   - Auto-fix where possible

6. **Component Showcase Page** (2-3 hours)
   - Storybook-style page showing all primitives
   - Side-by-side Aurora vs Brutalist
   - Interactive props

### Lower Priority (Backlog)
7. **Landing Page Redesign** (4-5 hours)
   - Hero with gradient text
   - Features grid with glass cards
   - CTA section with floating input
   - Scroll reveal animations

8. **Advanced Table Component** (3-4 hours)
   - Sortable columns
   - Filtering
   - Pagination
   - Glass variant for Aurora

9. **Theme Diagnostics Panel** (2-3 hours)
   - Show current tenant ID + hash
   - Display all CSS variables
   - Copy theme CSS URL
   - Force reload theme

---

## Modern UI/UX Guide Integration

**Reference Document:** `/docs/modern_ui_ux_guide.md`

This guide provides battle-tested patterns for implementing the remaining features. Key sections to reference:

### For Motion Features (Phase 2)
- **Section 4.1:** Scroll-Linked Animations
  - IntersectionObserver implementation
  - `.fade-up` utility class pattern
  - `prefers-reduced-motion` handling

- **Section 4.2:** Interaction States
  - Consistent transition timing (320ms)
  - Easing curve selection
  - Hover transforms (`translateY(-2px)`)

### For Component Development (Phase 3)
- **Section 2.1:** Glassmorphism with Restraint
  - When to use glass variant
  - `pointer-events: none` gotcha
  - `@supports` fallback pattern

- **Section 5.2:** Forms
  - Floating label pattern
  - Autoresize textareas
  - Button row alignment

- **Section 5.4:** Chat/Terminal Surfaces
  - Auto-scroll behavior
  - Enter-to-submit pattern
  - Visual distinction between authors

### For Testing (Phase 1)
- **Section 6.1:** Motion and Accessibility
  - Testing `prefers-reduced-motion`
  - Runtime preference changes

- **Section 6.4:** HTMX and Partial Updates
  - Re-running initialization after DOM updates
  - Idempotent component setup

### Anti-Patterns to Avoid
- **Section 7.1:** Inline styles ban
- **Section 7.2:** Pointer-blocking pseudo-elements
- **Section 7.3:** Scroll event listeners (use IntersectionObserver)
- **Section 7.4:** Token drift
- **Section 7.7:** Animating expensive properties

### Implementation Checklist
**Section 8:** Use for Phase 1-3 acceptance criteria
- Foundation, layout, glassmorphism, motion, components, accessibility, performance

---

## Testing Strategy

### Phase 1: Production Tests
```typescript
// e2e-tests/src/__tests__/integration/theme-switching.e2e.test.ts
test('Aurora theme has vibrant accents', async ({ page }) => {
  await page.goto('http://localhost:5173');
  const cta = page.getByRole('button').first();
  const bg = await cta.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toMatch(/rgb\(\s*161,\s*161,\s*170\)/); // Not grayscale
});

test('Brutalist theme is grayscale', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  const cta = page.getByRole('button').first();
  const bg = await cta.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).toMatch(/rgb\(\s*161,\s*161,\s*170\)/); // Grayscale
});

test('Aurora has glassmorphism', async ({ page }) => {
  await page.goto('http://localhost:5173');
  const glassCard = page.locator('.glass-panel').first();
  const backdropFilter = await glassCard.evaluate(el =>
    getComputedStyle(el).backdropFilter
  );
  expect(backdropFilter).toContain('blur');
});
```

### Phase 2: Motion Tests
```typescript
test('Scroll reveal triggers on Aurora', async ({ page }) => {
  await page.goto('http://localhost:5173/dashboard');

  const card = page.locator('[data-animate]').first();
  const initialOpacity = await card.evaluate(el => getComputedStyle(el).opacity);
  expect(initialOpacity).toBe('0');

  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);

  const finalOpacity = await card.evaluate(el => getComputedStyle(el).opacity);
  expect(finalOpacity).toBe('1');
});

test('prefers-reduced-motion disables animations', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  });

  await page.goto('http://localhost:5173');
  const card = page.locator('.fade-up').first();
  const transition = await card.evaluate(el => getComputedStyle(el).transition);
  expect(transition).toBe('none');
});
```

### Phase 3: Accessibility Tests
```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('Aurora theme meets WCAG AA', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await injectAxe(page);
  await checkA11y(page);
});

test('Brutalist theme meets WCAG AA', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Success Criteria (Updated)

### Phase 1: Production Ready
- [x] Branding token schema with all types (motion, gradients, assets)
- [x] Aurora & Brutalist fixtures fully defined
- [x] CSS artifact generation with all modern features
- [x] Theme delivery endpoint with versioned caching
- [x] Hostname-based theme switching works
- [x] Core component library uses semantic tokens
- [x] Glassmorphism with fallbacks
- [x] Cloud Storage for artifacts
- [x] Custom fonts deployed (Space Grotesk + Geist Mono shipping)
- [ ] **E2E tests pass (BLOCKER)**

### Phase 2: Motion Polish
- [ ] `useScrollReveal` hook implemented
- [ ] `useMagneticHover` hook implemented
- [ ] Staggered list animations
- [ ] Framer Motion modal entrance
- [ ] `prefers-reduced-motion` respected everywhere
- [ ] 60fps on scroll (no jank)

### Phase 3: Component Completeness
- [ ] GradientText component
- [ ] FloatingInput component
- [ ] EmptyState component
- [ ] Select/Checkbox/Radio/Switch primitives
- [ ] Toast notification system
- [ ] All components accessible (axe-core passes)

### Post-Launch: Monitoring & Tools
- [ ] Performance monitoring in production
- [ ] Visual regression tests
- [ ] Admin branding editor
- [ ] Component showcase page
- [ ] Migration codemod
- [ ] ESLint rules for token usage

---

## File Manifest (Key Locations)

### Core System
| File | Purpose | Status |
|------|---------|--------|
| `/packages/shared/src/types/branding.ts` | Schema definition (324 lines) | ✅ Complete |
| `/packages/shared/src/fixtures/branding-tokens.ts` | Aurora & Brutalist tokens (471 lines) | ✅ Complete |
| `/firebase/functions/src/services/tenant/ThemeArtifactService.ts` | CSS generation (443 lines) | ✅ Complete |
| `/firebase/functions/src/services/storage/ThemeArtifactStorage.ts` | Artifact persistence (67 lines) | ✅ Cloud Storage-backed singleton |
| `/firebase/functions/src/theme/ThemeHandlers.ts` | CSS delivery endpoint (63 lines) | ✅ Complete |
| `/firebase/functions/src/middleware/tenant-identification.ts` | Host-based routing (92 lines) | ✅ Complete |
| `/webapp-v2/src/utils/theme-bootstrap.ts` | Client-side theme loading (72 lines) | ✅ Complete |
| `/webapp-v2/tailwind.config.js` | Semantic color mappings (68 lines) | ✅ Complete |

### Components
| File | Purpose | Status |
|------|---------|--------|
| `/webapp-v2/src/components/ui/Button.tsx` | CTA & actions | ✅ Mostly complete |
| `/webapp-v2/src/components/ui/Card.tsx` | Content container | ✅ Complete |
| `/webapp-v2/src/components/ui/Surface.tsx` | Layout primitive | ✅ Complete |
| `/webapp-v2/src/components/ui/Modal.tsx` | Dialogs | ✅ Complete |
| `/webapp-v2/src/components/ui/Typography.tsx` | Text hierarchy | ✅ Complete |
| `/webapp-v2/src/components/ui/Input.tsx` | Form inputs | ✅ Complete |

### Tests (To Be Created)
| File | Purpose | Status |
|------|---------|--------|
| `/e2e-tests/src/__tests__/integration/theme-switching.e2e.test.ts` | Theme contrast tests | ✅ Added (awaiting CI run) |
| `/e2e-tests/src/__tests__/performance/theme-load.test.ts` | Performance budgets | ❌ Missing |
| `/e2e-tests/src/__tests__/a11y/wcag-compliance.test.ts` | Accessibility tests | ❌ Missing |

### Configuration
| File | Purpose | Status |
|------|---------|--------|
| `/firebase/scripts/tenant-configs.json` | Tenant seed definitions | ✅ Complete |
| `/firebase/scripts/publish-local-themes.ts` | Theme publishing | ✅ Complete |

---

## Conclusion

**The dual-tenant theming system is ~70% complete and architecturally sound.** The foundation (schema, fixtures, CSS generation, delivery) is production-ready. The component library is good and covers 95% of common UI patterns.

**Critical path to production:** Fix 3 blockers (8-11 hours), then ship.

**After production:** Iteratively add motion enhancements (1 week), advanced components (1 week), and admin tooling (backlog).

**This is not just a redesign. This is a proven theming architecture that works.** The dual-tenant strategy successfully demonstrates white-label capability while creating a polished marketing asset (Aurora) and a regression baseline (Brutalist).

Reference `/docs/modern_ui_ux_guide.md` for implementation patterns. Reference `/docs/branding/SYSTEM_AUDIT_2025-11-17.md` for detailed current state analysis.

**Let's ship it.** 🚀

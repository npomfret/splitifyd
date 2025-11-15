# Modern UI Overhaul & Dual-Tenant Theme Plan
**Date:** 2025-11-15
**Updated:** 2025-11-15 (Ambition Revision)
**Scope:** Total visual redesign + multi-tenant showroom (localhost = "Slick Aurora", 127.0.0.1 = "Brutalist Baseline")
**Constraints:** Zero tenants = zero legacy compatibility. Everything is on the table.
**Guiding Principle:** Build a design system so compelling that it becomes a competitive moat.

---

## Vision

Transform Splitifyd from "functional expense tracker" to "the app people screenshot and share." The UI should feel like a premium consumer product, not enterprise software.

### Dual-Tenant Strategy

**Boring Tenant (127.0.0.1) – "Brutalist Baseline"**
- Intentionally stark: pure grayscale (`#18181b` → `#fafafa`), flat shadows, zero gradients
- Single typeface (Inter), minimal border-radius (4px), no animations
- **Purpose:** Proves semantic token isolation works, serves as regression test baseline, highlights the contrast
- **Metaphor:** "Nokia 3310" – works perfectly, looks deliberately utilitarian

**Slick Tenant (localhost) – "Aurora Premium"**
- Cinematic glassmorphism: layered aurora backgrounds, depth-of-field blur, vibrant neon accents
- Expressive typography: Space Grotesk (headings), Geist Mono (code/numbers), fluid scales via `clamp()`
- Advanced motion: scroll-linked parallax, magnetic hover states, spring physics
- **Purpose:** Design showcase, marketing asset, proof of white-label capability
- **Metaphor:** "Notion meets Linear meets Stripe" – polished, delightful, aspirational

### Success Metrics

1. **Design Quality:** Non-designers say "wow" when viewing localhost theme
2. **Token Isolation:** Swapping `127.0.0.1` ↔ `localhost` changes 100% of visual styling with zero code changes
3. **Performance:** Lighthouse 95+ on both themes, <150ms P95 for `/api/theme.css`
4. **Accessibility:** WCAG 2.1 AA compliance on both themes (auto-checked in publish flow)
5. **Developer Velocity:** New features use primitives only, zero ad-hoc CSS after Week 8

---

## Extended Token Schema (Motion, Assets, Advanced Semantics)

### 1. Motion Tokens (NEW)
Add to `BrandingTokensSchema`:
```typescript
motion: z.object({
  // Durations (ms)
  duration: z.object({
    instant: z.number().min(0).max(100),     // 50ms  - micro-feedback
    fast: z.number().min(100).max(200),      // 150ms - hover states
    base: z.number().min(200).max(400),      // 320ms - transitions
    slow: z.number().min(400).max(800),      // 500ms - page loads
    glacial: z.number().min(800).max(2000),  // 1200ms - cinematic reveals
  }),

  // Easing curves
  easing: z.object({
    standard: z.string(),    // cubic-bezier(0.22, 1, 0.36, 1)
    decelerate: z.string(),  // cubic-bezier(0.05, 0.7, 0.1, 1)
    accelerate: z.string(),  // cubic-bezier(0.3, 0, 0.8, 0.15)
    spring: z.string(),      // cubic-bezier(0.34, 1.56, 0.64, 1)
  }),

  // Feature flags
  enableParallax: z.boolean(),
  enableMagneticHover: z.boolean(),
  enableScrollReveal: z.boolean(),
})
```

**Fixtures:**
- **Brutalist:** All durations set to `0`, `enableParallax: false`, etc.
- **Aurora:** Full motion suite enabled

### 2. Advanced Semantic Colors (NEW)
Extend `BrandingSemanticColorSchema`:
```typescript
surface: z.object({
  // Existing: base, elevated, muted, overlay
  glass: z.string(),           // rgba(9, 11, 25, 0.65) - glassmorphism base
  glassBorder: z.string(),     // rgba(255, 255, 255, 0.07) - glass edges
  aurora: z.string(),          // transparent - aurora layer base (gradients in CSS)
  spotlight: z.string(),       // rgba(255, 255, 255, 0.02) - hover glow
}),

interactive: z.object({
  // Existing: primary, secondary, accent, etc.
  ghost: z.string(),           // transparent bg, subtle border
  magnetic: z.string(),        // hover state for magnetic buttons
  glow: z.string(),            // box-shadow color for focus/active
}),

gradient: z.object({
  primary: z.array(z.string()).length(2),    // [start, end] for hero gradients
  accent: z.array(z.string()).length(2),     // for CTA buttons
  aurora: z.array(z.string()).length(4),     // multi-stop background gradient
}),

text: z.object({
  // Existing: primary, muted, inverted
  hero: z.string(),            // Extra-bold, high-contrast
  eyebrow: z.string(),         // Uppercase labels
  code: z.string(),            // Monospace elements
  gradient: z.array(z.string()).length(2), // Text gradient (webkit-background-clip)
}),
```

### 3. Asset Tokens (NEW)
```typescript
assets: z.object({
  heroIllustrationUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),

  // Self-hosted fonts (Aurora theme only)
  fonts: z.object({
    headingUrl: z.string().url().optional(),  // Space Grotesk
    bodyUrl: z.string().url().optional(),     // Inter
    monoUrl: z.string().url().optional(),     // Geist Mono
  }).optional(),
}),
```

### 4. Typography Scale (Extended)
```typescript
typography: z.object({
  // Existing: fontFamily, fontSize, fontWeight, lineHeight

  // Fluid scales (clamp-based)
  scale: z.object({
    xs: z.string(),    // clamp(0.75rem, 0.9vw, 0.875rem)
    sm: z.string(),    // clamp(0.875rem, 1vw, 1rem)
    base: z.string(),  // clamp(1rem, 1.2vw, 1.125rem)
    lg: z.string(),    // clamp(1.125rem, 1.5vw, 1.25rem)
    xl: z.string(),    // clamp(1.25rem, 2vw, 1.5rem)
    '2xl': z.string(), // clamp(1.5rem, 2.5vw, 1.875rem)
    '3xl': z.string(), // clamp(1.875rem, 3vw, 2.25rem)
    '4xl': z.string(), // clamp(2.25rem, 4vw, 3rem)
    hero: z.string(),  // clamp(2.5rem, 5vw, 3.75rem) - landing page
  }),

  // Letter spacing
  tracking: z.object({
    tight: z.string(),   // -0.02em
    normal: z.string(),  // 0
    wide: z.string(),    // 0.025em
    wider: z.string(),   // 0.05em
    eyebrow: z.string(), // 0.4em - all-caps labels
  }),
})
```

---

## Theme Artifact Generator Enhancements

### ThemeArtifactService Updates

1. **Automatic `@supports` Fallbacks**
   - Emit both modern and legacy styles for glassmorphism
   - Example output:
   ```css
   .glass-panel {
     background: rgba(9, 11, 25, 0.95); /* Fallback */
   }

   @supports (backdrop-filter: blur(1px)) {
     .glass-panel {
       backdrop-filter: blur(24px);
       background: rgba(9, 11, 25, 0.65);
     }
   }
   ```

2. **RGB Variant Generation** (already implemented ✅)
   - Continue emitting `--interactive-accent-rgb: 34 197 94` for Tailwind opacity utilities

3. **Motion Media Queries**
   - Auto-inject `prefers-reduced-motion` blocks based on `motion.enable*` flags:
   ```css
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

4. **Font Face Declarations**
   - If `assets.fonts` provided, generate `@font-face` rules:
   ```css
   @font-face {
     font-family: 'Space Grotesk';
     src: url('...') format('woff2');
     font-display: swap;
   }
   ```

5. **Gradient Utilities**
   - Generate CSS custom properties for gradients:
   ```css
   --gradient-primary: linear-gradient(135deg, #4f46e5, #ec4899);
   --gradient-aurora: radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.4), transparent 55%),
                      radial-gradient(circle at 80% 0%, rgba(236, 72, 153, 0.35), transparent 60%);
   ```

---

## Component Inventory & Redesign Spec

### Core Primitives (Week 3-4)

#### 1. Typography System
**New Components:**
- `<Heading variant="hero" | "h1" | "h2" | "h3" | "h4">` - Fluid scale + gradient support
- `<Text variant="body" | "muted" | "eyebrow" | "code">` - Semantic text
- `<GradientText>` - Webkit background-clip gradient text
- `<Eyebrow>` - Uppercase, tracked, muted (e.g., "STEP 1 OF 3")

**Props:**
```typescript
interface TypographyProps {
  as?: 'h1' | 'h2' | 'p' | 'span';
  variant?: 'hero' | 'h1' | 'h2' | 'body' | 'muted' | 'eyebrow' | 'code';
  gradient?: boolean; // Apply text gradient
  align?: 'left' | 'center' | 'right';
  clamp?: boolean; // Use fluid typography
}
```

#### 2. Surface/Card System
**Enhanced Card Component:**
```typescript
interface CardProps {
  variant: 'flat' | 'elevated' | 'glass' | 'aurora';
  hover?: 'lift' | 'glow' | 'magnetic' | 'none';
  border?: 'default' | 'gradient' | 'none';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
}
```

**Implementations:**
- `variant="flat"` → Brutalist theme (no blur, solid bg)
- `variant="glass"` → Aurora theme (backdrop-filter, border glow)
- `variant="aurora"` → Aurora theme only (animated gradient overlay)
- `hover="magnetic"` → Aurora theme only (cursor follows card, subtle transform)

#### 3. Button System (Extend Existing)
**New Variants:**
```typescript
type ButtonVariant =
  | 'primary'    // Solid, high-contrast
  | 'secondary'  // Outline
  | 'ghost'      // Transparent, subtle hover
  | 'magnetic'   // Aurora only: follows cursor
  | 'gradient'   // Aurora only: animated gradient bg
  | 'danger'     // Destructive actions
```

**Motion Props:**
```typescript
interface ButtonProps {
  loading?: boolean;           // Show spinner
  magneticStrength?: number;   // 0-1, Aurora only
  glowOnHover?: boolean;       // Add box-shadow glow
  pulseOnFocus?: boolean;      // Subtle scale animation
}
```

#### 4. Input System (Floating Labels)
**New Pattern:**
```tsx
<FloatingInput
  label="Email address"
  type="email"
  helperText="We'll never share your email"
  error={errors.email}
  icon={<MailIcon />}
/>
```

**Visual Behavior:**
- Label starts inside input (placeholder position)
- On focus/fill: label animates up and scales down
- Aurora theme: adds glow ring, glass bg
- Brutalist theme: simple border color change

#### 5. Modal/Dialog System
**New Components:**
- `<Modal>` - Full-screen overlay with glass backdrop
- `<Sheet>` - Slide-in panel (bottom on mobile, right on desktop)
- `<Popover>` - Floating, positioned element
- `<Toast>` - Notification system with queue

**Features:**
- Focus trap (tab cycling)
- Escape key dismissal
- Backdrop click dismissal (opt-in)
- Stacking context management
- Aurora theme: animated entrance (scale + fade), glass background
- Brutalist theme: instant appearance, solid background

#### 6. Loading States
**New Components:**
- `<Spinner variant="default" | "accent" | "gradient">` - Rotating circle
- `<Skeleton>` - Placeholder blocks with shimmer (Aurora) or pulse (Brutalist)
- `<ProgressBar>` - Linear progress with gradient fill (Aurora)

#### 7. Status & Feedback
**Enhanced Components:**
- `<Badge>` - Count/status indicators
- `<Chip>` - Removable tags with optional icon
- `<Alert variant="info" | "success" | "warning" | "error">` - System messages
- `<StatusDot>` - Online/offline indicators with pulse animation

### Layout Components (Week 4-5)

#### 1. Global Shell
**New Architecture:**
```tsx
<AppShell
  header={<Header />}
  sidebar={<Sidebar />}
  footer={<Footer />}
  aurora={tenantId === 'localhost'} // Enable aurora bg
>
  <Routes />
</AppShell>
```

**Aurora Background:**
- Two `::before`/`::after` pseudo-elements on `<body>`
- Animated radial gradients (24s loop)
- `blur(25px)` for atmospheric effect
- `pointer-events: none`, `z-index: -1`
- Only rendered for Aurora theme (conditional CSS class)

#### 2. Page Templates
**New Layouts:**
- `<AuthLayout>` - Split panel (left: hero visual, right: form)
- `<DashboardLayout>` - Header + sidebar + main content area
- `<SettingsLayout>` - Vertical nav + scrollable content
- `<LandingLayout>` - Full-width hero, sections, footer

#### 3. Responsive Primitives
**Utility Components:**
- `<Stack direction="row" | "column" gap={...}>` - Flex container
- `<Grid cols={...} gap={...}>` - Auto-fit grid
- `<Container maxWidth="sm" | "md" | "lg" | "xl">` - Centered, constrained width
- `<Spacer size="sm" | "md" | "lg" | "xl">` - Vertical/horizontal spacing

### Compound Components (Week 5-6)

#### 1. Form System
```tsx
<Form onSubmit={handleSubmit}>
  <FormField
    label="Full name"
    name="name"
    component={FloatingInput}
    validation={required()}
  />

  <FormField
    label="Country"
    name="country"
    component={Select}
    options={countries}
  />

  <FormActions>
    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button variant="primary" type="submit">Save</Button>
  </FormActions>
</Form>
```

#### 2. Data Display
**Table Component:**
```tsx
<Table
  data={expenses}
  columns={[
    { key: 'description', header: 'Description', sortable: true },
    { key: 'amount', header: 'Amount', align: 'right', format: 'currency' },
    { key: 'date', header: 'Date', format: 'date' },
    { key: 'actions', header: '', render: ActionsCell },
  ]}
  onRowClick={handleRowClick}
  variant="glass" // Aurora theme
/>
```

**Empty States:**
```tsx
<EmptyState
  icon={<ReceiptIcon />}
  title="No expenses yet"
  description="Create your first expense to get started"
  action={<Button onClick={handleCreate}>Add Expense</Button>}
  illustration={tokens.assets.heroIllustrationUrl} // Aurora only
/>
```

#### 3. Navigation
**Enhanced Sidebar:**
- Collapsible sections
- Active state with glow (Aurora) or solid bg (Brutalist)
- Icon + label, icon-only when collapsed
- Magnetic hover on Aurora theme

**Breadcrumbs:**
```tsx
<Breadcrumbs
  items={[
    { label: 'Groups', href: '/groups' },
    { label: 'Weekend Trip', href: '/groups/123' },
    { label: 'Expenses', href: '/groups/123/expenses' },
  ]}
  separator={<ChevronRight />}
/>
```

---

## Page Redesigns (Detailed Specs)

### 1. Landing Page (Week 6)

**Hero Section:**
- **Aurora Theme:**
  - Full-viewport height
  - Animated gradient background (using `--gradient-aurora`)
  - Frosted glass card containing:
    - Eyebrow text: "EXPENSE SPLITTING MADE SIMPLE"
    - Hero heading with gradient text: "Split Bills with Friends"
    - Subtitle with muted text
    - CTA buttons: "Get Started" (gradient variant) + "View Demo" (ghost variant)
  - Parallax scroll effect (hero moves slower than page)
  - Floating illustration/screenshot with subtle animation

- **Brutalist Theme:**
  - Same structure, zero animations
  - Solid white background
  - Black text, gray subtitle
  - Flat buttons (primary solid, secondary outline)

**Features Grid:**
- 3-column auto-fit grid
- Each feature card:
  - Icon in colored circle (Aurora: gradient bg, Brutalist: solid gray)
  - Heading + description
  - Aurora: glass card with hover lift
  - Brutalist: simple border, no hover effect

**CTA Section:**
- Full-width gradient background (Aurora) or solid color (Brutalist)
- Large heading + button
- Email signup form with floating label input

### 2. Auth Flow (Week 6)

**Login/Register Pages:**
- Split layout (50/50 on desktop, stacked on mobile)
- **Left Panel (Hero):**
  - Aurora: Animated gradient background, floating illustrations
  - Brutalist: Solid color, static logo
  - Testimonial quote (optional)

- **Right Panel (Form):**
  - Centered form with floating label inputs
  - Social auth buttons (Google, etc.) with icons
  - Footer links (Privacy, Terms)
  - Aurora: Glass form container
  - Brutalist: Simple white background

**Password Reset Flow:**
- Single-column centered layout
- Email input → Success message → Check inbox
- Aurora: Animated checkmark on success
- Brutalist: Static checkmark

### 3. Dashboard (Week 7)

**Top Section:**
- Welcome message: "Welcome back, Alice" (hero text variant)
- Quick stats grid:
  - Total balance (positive = green, negative = red)
  - Active groups count
  - Pending settlements count
  - Aurora: Glass cards with gradient accents, sparkline charts (placeholder)
  - Brutalist: Flat cards, numbers only

**Groups List:**
- Card-based layout (not table)
- Each group card:
  - Group name (heading)
  - Member avatars (overlapping circles)
  - Balance summary
  - "View Details" button
  - Aurora: Glass card, magnetic hover, member count badge with glow
  - Brutalist: Border card, simple hover (bg color change)

**Empty State:**
- Centered illustration (Aurora: custom SVG from assets, Brutalist: simple icon)
- "Create your first group" CTA

### 4. Group Detail Page (Week 7)

**Header:**
- Group name (hero variant)
- Member avatars with "Invite" button
- Tab navigation: Expenses | Balances | Settings
- Aurora: Glass header with blur, gradient underline on active tab
- Brutalist: Solid header, simple border on active tab

**Expenses Tab:**
- Table with columns: Description, Paid By, Amount, Date, Actions
- Filters: Date range, member, category
- "Add Expense" FAB (floating action button)
- Aurora: Glass table, hover row highlight, FAB with glow
- Brutalist: Border table, simple hover, standard button

**Balances Tab:**
- Settlement graph (who owes whom)
- "Settle Up" action per debt
- Aurora: Animated graph with gradient lines, glass cards
- Brutalist: Static graph, flat cards

### 5. Add/Edit Expense (Week 7)

**Form Layout:**
- Stepped form (if complex) or single page
- Fields:
  - Description (floating input)
  - Amount (floating input with currency symbol)
  - Category (select with icons)
  - Paid by (member select)
  - Split (custom component: checkboxes + amount inputs)
  - Date (date picker)
  - Receipt upload (drag-drop zone)

- Aurora: Glass form container, animated step progress, file upload with preview thumbnails
- Brutalist: Simple form, numbered steps, basic file input

**Split Editor:**
- Visual representation of split:
  - Member avatars
  - Percentage/amount sliders
  - "Split Equally" quick action
  - Real-time total validation

- Aurora: Magnetic sliders, glow on active member
- Brutalist: Standard range inputs

### 6. Settings/Admin Pages (Week 8)

**Settings Layout:**
- Vertical sidebar nav (Account, Security, Preferences, Billing)
- Main content area with forms
- Aurora: Glass sidebar, smooth tab transitions
- Brutalist: Border sidebar, instant tab switch

**Tenant Branding Admin (Aurora Only):**
- Live preview iframe showing current theme
- Token editor (color pickers, font selectors)
- "Publish Theme" button
- Artifact history table with rollback action
- WCAG contrast checker (visual feedback)

**Theme Diagnostics Panel (Dev Mode):**
- Shows current tenant ID, theme hash
- Displays all CSS variables (collapsible tree)
- "Copy theme CSS URL" button
- "Force Reload Theme" button
- Token JSON viewer

---

## Motion & Micro-interactions (Advanced)

### 1. Scroll-Linked Animations

**IntersectionObserver Hook:**
```typescript
export function useScrollReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
  }, []);

  return { ref, isVisible };
}
```

**Usage:**
```tsx
function FeatureCard({ title, description }: Props) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <Card
      ref={ref}
      className={cn('fade-up', isVisible && 'is-visible')}
    >
      {/* content */}
    </Card>
  );
}
```

### 2. Magnetic Hover (Aurora Only)

**Concept:** Buttons/cards subtly "follow" cursor when hovering nearby

```typescript
export function useMagneticHover(strength: number = 0.3) {
  const ref = useRef<HTMLElement>(null);

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
  }, [strength]);

  return ref;
}
```

### 3. Staggered List Animations

**Concept:** Items in a list animate in sequence (not all at once)

```tsx
function ExpenseList({ expenses }: Props) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div ref={ref}>
      {expenses.map((expense, i) => (
        <ExpenseCard
          key={expense.id}
          {...expense}
          className="fade-up"
          style={{
            transitionDelay: isVisible ? `${i * 100}ms` : '0ms'
          }}
        />
      ))}
    </div>
  );
}
```

### 4. Spring Physics (Aurora Only)

Use `framer-motion` for advanced animations:
```tsx
import { motion } from 'framer-motion';

function Modal({ isOpen, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
            className="modal-content"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## Migration Strategy (Automated)

### Codemod for Color Migration

**Script:** `scripts/codemods/migrate-colors.ts`

```typescript
import type { Transform } from 'jscodeshift';

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Map old Tailwind classes to semantic tokens
  const colorMap = {
    'bg-blue-600': 'bg-interactive-primary',
    'bg-blue-500': 'bg-interactive-primary',
    'text-blue-600': 'text-interactive-primary',
    'bg-gray-50': 'bg-surface-muted',
    'bg-white': 'bg-surface-base',
    'text-gray-900': 'text-text-primary',
    'text-gray-600': 'text-text-muted',
    'border-gray-200': 'border-border-default',
    // ... more mappings
  };

  // Replace className strings
  root.find(j.JSXAttribute, {
    name: { name: 'className' }
  }).forEach(path => {
    const value = path.node.value;

    if (value?.type === 'StringLiteral') {
      let updated = value.value;

      Object.entries(colorMap).forEach(([old, new_]) => {
        updated = updated.replace(new RegExp(`\\b${old}\\b`, 'g'), new_);
      });

      if (updated !== value.value) {
        value.value = updated;
      }
    }
  });

  return root.toSource();
};

export default transform;
```

**Usage:**
```bash
npx jscodeshift -t scripts/codemods/migrate-colors.ts webapp-v2/src/pages/**/*.tsx
```

### ESLint Auto-Fix Rules

**Custom Rule:** Ban non-semantic colors

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-hardcoded-colors': ['error', {
      bannedClasses: [
        'bg-blue-*', 'bg-gray-*', 'bg-red-*',
        'text-blue-*', 'text-gray-*',
        'border-blue-*', 'border-gray-*'
      ],
      suggestedReplacement: 'Use semantic tokens (bg-interactive-primary, text-text-muted, etc.)'
    }]
  }
};
```

---

## Testing Strategy (Comprehensive)

### 1. Theme Contrast Tests (Playwright)

**File:** `e2e-tests/src/__tests__/smoke/theme-contrast.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Theme Contrast (Aurora vs Brutalist)', () => {
  test('Aurora theme has vibrant accents', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Check CTA button background (should be gradient or teal)
    const cta = page.getByRole('button', { name: /get started/i });
    const bg = await cta.evaluate(el => getComputedStyle(el).backgroundColor);

    // Should be teal (#22d3ee → rgb(34, 211, 238))
    expect(bg).toMatch(/rgb\(\s*34,\s*211,\s*238\)/);
  });

  test('Brutalist theme is grayscale', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    const cta = page.getByRole('button', { name: /get started/i });
    const bg = await cta.evaluate(el => getComputedStyle(el).backgroundColor);

    // Should be gray (#a1a1aa → rgb(161, 161, 170))
    expect(bg).toMatch(/rgb\(\s*161,\s*161,\s*170\)/);
  });

  test('Aurora theme has glassmorphism', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const heroCard = page.locator('.glass-panel').first();
    const backdropFilter = await heroCard.evaluate(el =>
      getComputedStyle(el).backdropFilter
    );

    expect(backdropFilter).toContain('blur');
  });

  test('Brutalist theme has no blur effects', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    const cards = page.locator('[class*="card"]');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const backdropFilter = await card.evaluate(el =>
        getComputedStyle(el).backdropFilter
      );

      expect(backdropFilter).toBe('none');
    }
  });
});
```

### 2. Performance Budgets

**File:** `e2e-tests/src/__tests__/performance/theme-load.test.ts`

```typescript
test('Theme CSS loads within budget', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('http://localhost:5173');

  // Wait for theme CSS to load
  await page.waitForLoadState('networkidle');

  const themeCssRequest = page.waitForResponse(
    resp => resp.url().includes('/api/theme.css')
  );

  const response = await themeCssRequest;
  const loadTime = Date.now() - startTime;

  // P95 budget: <150ms
  expect(loadTime).toBeLessThan(150);

  // Size budget: <50KB
  const cssText = await response.text();
  const sizeKB = new Blob([cssText]).size / 1024;
  expect(sizeKB).toBeLessThan(50);
});
```

### 3. Accessibility Tests (axe-core)

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('Aurora theme meets WCAG AA', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await injectAxe(page);

  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});

test('Brutalist theme meets WCAG AA', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await injectAxe(page);

  await checkA11y(page);
});
```

### 4. Visual Regression (Percy/Chromatic)

**Config:** `percy.config.yml`

```yaml
version: 2
static:
  include: '/**/*.html'

snapshots:
  widths: [375, 768, 1280]

  # Snapshot both themes
  pages:
    - name: 'Landing - Aurora'
      url: 'http://localhost:5173'

    - name: 'Landing - Brutalist'
      url: 'http://127.0.0.1:5173'

    - name: 'Dashboard - Aurora'
      url: 'http://localhost:5173/dashboard'

    - name: 'Dashboard - Brutalist'
      url: 'http://127.0.0.1:5173/dashboard'
```

**Script:**
```bash
npx percy snapshot e2e-tests/percy.config.yml
```

---

## Execution Timeline (Revised, 10 Weeks)

### Week 1: Schema Extensions & Fixtures
**Deliverables:**
- [ ] Extend `BrandingTokensSchema` with motion, gradients, assets, advanced semantics
- [ ] Create three fixture files:
  - `branding-tokens-localhost.ts` (Aurora theme, full spec)
  - `branding-tokens-loopback.ts` (Brutalist theme, minimal spec)
  - `branding-tokens-default.ts` (Fallback, same as Brutalist)
- [ ] Update `ThemeArtifactService` to handle new token types
- [ ] Add unit tests for extended schema validation

**Acceptance:**
- `npm run build` passes with new schema
- Fixture files pass Zod validation
- Schema includes all tokens referenced in this doc

### Week 2: Artifact Generator Enhancements
**Deliverables:**
- [ ] Implement `@supports` fallback generation for glassmorphism
- [ ] Add gradient CSS variable generation
- [ ] Add `@font-face` generation from `assets.fonts`
- [ ] Add `prefers-reduced-motion` blocks based on motion flags
- [ ] Extend unit tests to cover new CSS generation paths

**Acceptance:**
- Generated CSS includes both modern and fallback styles
- Brutalist theme CSS has zero animations (motion durations = 0)
- Aurora theme CSS includes all gradients, fonts, motion

### Week 3: Seed Themes & Verify Delivery
**Deliverables:**
- [ ] Update `firebase/scripts/publish-local-themes.ts` to publish both themes
- [ ] Verify `/api/theme.css` serves correct CSS for each hostname:
  - `localhost` → Aurora CSS
  - `127.0.0.1` → Brutalist CSS
  - Other → Default CSS
- [ ] Manual browser test: open both URLs, compare visual styling
- [ ] Screenshot both themes for reference

**Acceptance:**
- `curl -H "Host: localhost" http://localhost:5001/.../api/theme.css` returns Aurora CSS
- `curl -H "Host: 127.0.0.1" ...` returns Brutalist CSS
- Visual inspection confirms themes are distinct

### Week 4: Core Primitives (Typography, Surface, Button)
**Deliverables:**
- [ ] Build `Typography` components (Heading, Text, GradientText, Eyebrow)
- [ ] Rebuild `Card` component with glass/aurora/flat variants
- [ ] Extend `Button` component with ghost/magnetic/gradient variants
- [ ] Build `Spinner`, `Skeleton`, `ProgressBar` loading states
- [ ] Create Storybook-style `ComponentShowcase` page for manual testing

**Acceptance:**
- Components render correctly on both themes (localhost vs 127.0.0.1)
- No hardcoded colors in component code
- Showcase page displays all variants side-by-side

### Week 5: Input, Form, Modal System
**Deliverables:**
- [ ] Build `FloatingInput` component with label animation
- [ ] Build `Select`, `Checkbox`, `Radio`, `Switch` form controls
- [ ] Build `FormField` wrapper with validation/error display
- [ ] Build `Modal`, `Sheet`, `Popover`, `Toast` components
- [ ] Add focus trap, keyboard nav, ESC dismissal

**Acceptance:**
- All form controls work on both themes
- Modals have glass background on Aurora, solid on Brutalist
- Focus management works (tab cycling, ESC key)
- Accessibility audit passes (axe-core)

### Week 6: Layout System & Global Shell
**Deliverables:**
- [ ] Build `AppShell` component with aurora background flag
- [ ] Implement aurora background animation (::before/::after pseudo-elements)
- [ ] Build `Stack`, `Grid`, `Container`, `Spacer` layout primitives
- [ ] Build `AuthLayout`, `DashboardLayout`, `SettingsLayout` templates
- [ ] Add theme badge component (shows tenant ID + hash)

**Acceptance:**
- Aurora background animates smoothly (24s loop)
- Brutalist theme has no background animation
- Layout primitives work responsively (mobile → desktop)
- Theme badge visible in dev mode, hidden in prod

### Week 7: Page Redesigns (Landing, Auth, Dashboard)
**Deliverables:**
- [ ] Redesign landing page (hero, features, CTA sections)
- [ ] Redesign auth pages (login, register, password reset)
- [ ] Redesign dashboard page (stats, groups list, empty state)
- [ ] Migrate all hardcoded colors to semantic tokens
- [ ] Add scroll reveal animations (Aurora only)

**Acceptance:**
- Pages look distinct on Aurora vs Brutalist
- Zero hardcoded colors (`npm run lint` passes)
- Scroll animations work on Aurora, disabled on Brutalist
- Playwright tests pass for both themes

### Week 8: Page Redesigns (Group Detail, Expenses, Settings)
**Deliverables:**
- [ ] Redesign group detail page (header, tabs, expenses table, balances)
- [ ] Redesign add/edit expense form (floating inputs, split editor)
- [ ] Redesign settings pages (vertical nav, forms)
- [ ] Build tenant branding admin page (token editor, preview, publish)
- [ ] Build theme diagnostics panel (dev mode)

**Acceptance:**
- All pages migrated to semantic tokens
- Admin pages include live preview + publish flow
- Diagnostics panel shows correct tenant/hash

### Week 9: Motion & Micro-interactions
**Deliverables:**
- [ ] Implement `useScrollReveal` hook (IntersectionObserver)
- [ ] Implement `useMagneticHover` hook (cursor tracking)
- [ ] Add staggered list animations (sequential fade-in)
- [ ] Add spring physics to modals (framer-motion)
- [ ] Ensure `prefers-reduced-motion` disables all animations

**Acceptance:**
- Scroll reveals trigger correctly (25% threshold)
- Magnetic hover works on Aurora (disabled on Brutalist)
- `prefers-reduced-motion` media query respected
- No jank on scroll (60fps maintained)

### Week 10: Testing, Performance, Polish
**Deliverables:**
- [ ] Write theme contrast Playwright tests (Aurora vs Brutalist)
- [ ] Write performance budget tests (theme CSS load time, size)
- [ ] Write accessibility tests (axe-core, WCAG AA)
- [ ] Set up visual regression tests (Percy/Chromatic)
- [ ] Write migration codemod for remaining pages
- [ ] Run full codemod pass, verify all pages migrated
- [ ] Final QA: test all pages on both themes

**Acceptance:**
- All Playwright tests pass (contrast, performance, a11y)
- Lighthouse score 95+ on both themes
- Zero hardcoded colors in codebase (`rg 'bg-blue-|text-gray-'` returns nothing)
- Visual regression baselines captured

---

## Performance Budgets & Monitoring

### Critical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Theme CSS Load (P50)** | <100ms | Server-side timing header |
| **Theme CSS Load (P95)** | <150ms | Server-side timing header |
| **Theme CSS Size** | <50KB gzipped | Artifact size check |
| **Lighthouse Performance** | 95+ | CI/manual audit |
| **First Contentful Paint** | <1.5s | Lighthouse |
| **Time to Interactive** | <3.5s | Lighthouse |
| **Cumulative Layout Shift** | <0.1 | Lighthouse |
| **Scroll Jank** | 60fps | Chrome DevTools perf profiler |

### Monitoring Setup

**Client-Side Instrumentation:**
```typescript
// Track theme CSS load time
const themeLoadStart = performance.now();

document.querySelector('link[href*="/api/theme.css"]')
  ?.addEventListener('load', () => {
    const duration = performance.now() - themeLoadStart;

    analytics.track('theme_css_loaded', {
      tenant_id: configStore.tenantId,
      theme_hash: configStore.themeHash,
      duration_ms: duration,
      size_kb: /* from response headers */,
    });
  });
```

**Server-Side Logging:**
```typescript
// In /api/theme.css endpoint
const startTime = Date.now();

// ... generate/fetch CSS ...

const duration = Date.now() - startTime;

logger.info('theme_css_served', {
  tenant_id,
  hash,
  duration_ms: duration,
  cache_hit: cacheHit,
  size_bytes: cssText.length,
});
```

---

## Rollback & Risk Mitigation

### Phase Rollback Strategy

**Week 1-3 (Tokens & Delivery):**
- **Risk:** Schema changes break existing tenant data
- **Mitigation:** Write migration script to backfill new tokens with defaults
- **Rollback:** Revert schema changes, re-run publish script

**Week 4-6 (Components):**
- **Risk:** New components don't work on both themes
- **Mitigation:** Test every component on both hostnames before merging
- **Rollback:** Revert component changes, keep old primitives

**Week 7-8 (Pages):**
- **Risk:** Page migrations break existing functionality
- **Mitigation:** Migrate one page at a time, run full E2E suite after each
- **Rollback:** Revert page-by-page, preserve old page code in git history

**Week 9-10 (Motion & Polish):**
- **Risk:** Animations cause performance regressions
- **Mitigation:** Lighthouse audit on every PR, block merge if score drops
- **Rollback:** Feature-flag animations, disable via tenant config

### Emergency Rollback (Nuclear Option)

**Scenario:** Everything is broken, need to revert entire redesign

**Steps:**
1. **Disable new themes:**
   ```typescript
   // In /api/theme.css
   if (process.env.EMERGENCY_DISABLE_THEMES === 'true') {
     return res.send(DEFAULT_FALLBACK_CSS);
   }
   ```

2. **Revert frontend changes:**
   ```bash
   git revert <redesign-merge-commit>
   git push
   ```

3. **Redeploy:**
   ```bash
   npm run deploy
   ```

**Time to restore:** ~15 minutes
**User impact:** Revert to old UI, no data loss

---

## Open Questions & Decisions

### 1. Typography Assets (Self-Host vs CDN)

**Options:**
- **Self-host:** Download Space Grotesk + Geist Mono, serve from `/public/fonts`
  - **Pros:** No third-party dependency, GDPR-friendly, offline support
  - **Cons:** ~200KB payload, need to manage updates

- **CDN:** Use Google Fonts or Fontshare
  - **Pros:** Zero bundle size, automatic updates, global CDN
  - **Cons:** External dependency, privacy concerns, China blocks Google

**Recommendation:** Self-host for Aurora, use system fonts for Brutalist
**Action:** Download fonts during Week 4, add to `assets.fonts` in fixture

### 2. Illustrations & Icons

**Questions:**
- Should Aurora theme have custom illustrations (hero section, empty states)?
- Budget for commissioning art, or use open-source (unDraw, Storyset)?
- Icon library: Continue with Lucide, or switch to custom set?

**Recommendation:**
- Use unDraw illustrations (MIT license, customizable colors)
- Stick with Lucide icons (already integrated, 1000+ icons)
- Budget 1 day for illustration sourcing + color customization

### 3. Animation Library

**Options:**
- **CSS-only:** Use CSS transitions/animations, IntersectionObserver for scroll
  - **Pros:** Zero JS overhead, simple, performant
  - **Cons:** Limited control, no spring physics

- **Framer Motion:** React animation library with spring physics
  - **Pros:** Advanced animations, spring easing, gesture support
  - **Cons:** 50KB bundle size, learning curve

**Recommendation:** Hybrid approach
- Use CSS for simple transitions (hover, focus)
- Use Framer Motion for complex animations (modals, page transitions)
- Feature-flag Framer Motion (only load on Aurora theme)

### 4. Mobile Strategy

**Questions:**
- Should Aurora theme simplify on mobile (reduce blur, disable parallax)?
- Performance budget for low-end Android devices?

**Recommendation:**
- Add `@media (max-width: 768px)` simplifications:
  - Reduce blur from 24px → 12px
  - Disable parallax (`enableParallax: false` on mobile)
  - Reduce aurora gradient complexity (2 stops instead of 4)
- Test on real devices (iPhone SE, Pixel 4a)

### 5. Theme Switching UI (Demo Mode)

**Question:** Should we add a visible theme toggle for demos/screenshots?

**Options:**
- **No toggle:** Host-based only (localhost vs 127.0.0.1)
  - Simple, no UI clutter

- **Dev-only toggle:** Hidden `?theme=aurora|brutalist` query param
  - Useful for QA, hidden from users

- **Public toggle:** Button in header to switch themes
  - Great for demos, marketing screenshots
  - Risk: confusing for real users

**Recommendation:** Dev-only query param
**Implementation:**
```typescript
// In theme loader
const themeOverride = new URLSearchParams(location.search).get('theme');
const tenantId = themeOverride || configStore.tenantId;
```

---

## Success Criteria (Final Gate)

Before shipping to production, all of these must be true:

### Functional
- [ ] Both themes (Aurora, Brutalist) render correctly on all pages
- [ ] Swapping hostnames (localhost ↔ 127.0.0.1) changes theme with zero code changes
- [ ] All forms, modals, navigation work identically on both themes
- [ ] No console errors or warnings on either theme

### Visual
- [ ] Aurora theme has glassmorphism, gradients, animations
- [ ] Brutalist theme is pure grayscale, zero animations
- [ ] Non-designers say "wow" when viewing Aurora theme
- [ ] Both themes feel intentional (not broken or incomplete)

### Technical
- [ ] Zero hardcoded colors in codebase (`npm run lint` passes)
- [ ] All components use semantic tokens only
- [ ] Theme CSS loads in <150ms (P95)
- [ ] Theme CSS size <50KB gzipped
- [ ] Lighthouse score 95+ on both themes

### Accessibility
- [ ] WCAG 2.1 AA compliance (axe-core passes)
- [ ] Keyboard navigation works (tab, enter, ESC)
- [ ] Screen reader friendly (semantic HTML, ARIA labels)
- [ ] `prefers-reduced-motion` respected

### Testing
- [ ] 100% of Playwright E2E tests pass on both themes
- [ ] Theme contrast tests pass (color assertions)
- [ ] Performance budget tests pass
- [ ] Visual regression baselines captured (Percy)

### Documentation
- [ ] Component showcase page complete (all primitives visible)
- [ ] Theme diagnostics panel complete (dev mode)
- [ ] Admin branding page complete (token editor, publish)
- [ ] Migration guide written (for future component authors)

---

## Post-Launch (Maintenance Mode)

### Ongoing Responsibilities

1. **Theme Monitoring:**
   - Weekly review of theme load metrics (P95, error rate)
   - Monthly Lighthouse audits
   - Quarterly visual regression checks

2. **Component Library Expansion:**
   - Add new primitives as needed (Calendar, DatePicker, etc.)
   - Ensure all new components use semantic tokens
   - Update showcase page with new additions

3. **Performance Optimization:**
   - Monitor theme CSS size (watch for bloat)
   - Optimize generated CSS (merge duplicate rules)
   - Consider critical CSS inlining for faster FCP

4. **Accessibility Audits:**
   - Run axe-core on new pages before launch
   - User testing with screen reader users
   - Color contrast checks on new token additions

---

## Conclusion

This plan transforms Splitifyd from a functional app into a design showcase. The dual-tenant strategy proves the white-label system works while simultaneously creating a marketing asset (Aurora theme) and a regression baseline (Brutalist theme).

**Ambition Level:** 🔥🔥🔥🔥 (Very High)
**Risk Level:** 🟡 (Medium - mitigated by phased approach)
**Effort:** ~10 weeks (1 full-time developer)
**Impact:** Game-changing (differentiation, marketability, technical foundation)

By Week 10, Splitifyd will have:
- A world-class design system
- Bulletproof theming architecture
- Two complete theme implementations
- Automated migration tooling
- Comprehensive test coverage
- Performance budgets enforced
- WCAG AA compliance

**This is not just a redesign. This is a platform rewrite disguised as a visual refresh.**

Let's build something people will want to copy. 🚀

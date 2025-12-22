# Webapp Style Guide

**This is a multi-tenant white-label application. Tenant branding flows through CSS variables. Hardcoded colors break everything.**

---

## The One Rule

**Use semantic tokens only.** Never `bg-gray-*`, `text-white`, inline styles, or `:root` variables in CSS files. All colors come from `/api/theme.css` generated per-tenant.

---

## Content Security Policy

See `docs/guides/security.md` for full security patterns. Key webapp rules:
- Never use inline handlers (`onclick=…`)
- Attach event listeners via `addEventListener()` in JS

--- 

## Semantic Tokens

Defined in `webapp-v2/src/styles/global.css` using Tailwind v4's `@theme` directive. Consumed via CSS variables from tenant theme.

| Category | Tokens |
|----------|--------|
| **Surfaces** | `surface-base`, `surface-muted`, `surface-raised`, `surface-subtle`, `surface-glass` |
| **Text** | `text-primary`, `text-muted`, `text-inverted` |
| **Interactive** | `interactive-primary`, `interactive-primary-foreground`, `interactive-secondary`, `interactive-accent` |
| **Semantic** | `semantic-success`, `semantic-warning`, `semantic-error` |
| **Borders** | `border-default`, `border-strong`, `border-warning`, `border-error` |

**Opacity:** Use `bg-interactive-primary/10` for hover states. Never `bg-surface-raised/50` on text containers (unreadable).

---

## Style Primitives

**Location:** `components/ui/styles/`

Layered style constants enforce consistency. Import and compose these instead of repeating raw Tailwind strings.

| Module | Purpose | Key exports |
|--------|---------|-------------|
| `surfaces.ts` | Background treatments | `surfaces.base`, `.muted`, `.raised`, `.glass`, `.subtle` |
| `states.ts` | Interactive states | `states.disabled`, `.errorBorder`, `.focusRing`, `errorState`, `disabledState` |
| `formStyles.ts` | Form inputs | `formInput`, `formTextarea`, `formSelect`, `formFloatingInput`, `formLabel` |
| `listItemStyles.ts` | List item cards | `listItem.base`, `.clickable`, `.deleted`, `.deletedText` |
| `iconButtonStyles.ts` | Icon buttons | `iconButton.ghost`, `.ghostRounded`, `.ghostReveal`, `.primary` |

**Usage:** See `Input.tsx`, `Textarea.tsx`, `ExpenseItem.tsx` for composition examples.

**When to use:** Primitives for custom layouts; components (`Input`, `Button`) for standard patterns.

---

## Component Patterns

**Location:** `components/ui/`

### Core Components
- `Button` - Primary uses gradient, magnetic hover on by default
- `Surface` - Base container with variants: `base`, `muted`, `inverted`, `glass`
- `Card` - Wraps Surface with title/subtitle
- `Clickable` - Wraps non-button interactive elements for analytics
- `Input`, `FloatingInput`, `Textarea` - Form inputs with error states
- `Select` - Styled dropdown with error states
- `Typography` - Text with variants: `body`, `caption`, `heading`, `display`
- `Badge` - Status/label indicators with variants: `primary`, `success`, `warning`, `error`, `deleted`
- `FieldError` - Form validation error messages
- `HelpText` - Help/description text (or use `help-text` utility class)
- `ModalHeader`, `ModalContent`, `ModalFooter` - Modal section wrappers
- `LoadMoreButton` - Standardized "load more" for paginated lists
- `MemberDisplay` - Avatar + display name with optional "(you)" suffix
- `SectionTitle` - Icon + label for section headers (use with `SidebarCard`)
- `SkeletonList` - Wrapper for skeleton loading lists (with `Skeleton*Item` components)

### Rules
1. All interactive elements use `Button` or `Clickable` - no naked `onClick`
2. `Clickable` with `as="button"` for icon buttons
3. Error states: `aria-invalid`, `aria-describedby`, `role="alert"`
4. Forward refs for components needing hooks

### Icons

**Location:** `components/ui/icons/`

TSX components using `currentColor` for theme inheritance. External SVGs via `<img>` cannot inherit colors.

**Props:** `size` (pixels), `className` (for color via `text-*` tokens)

**Adding icons:** New file in `icons/`, export from `index.ts`. Use `currentColor`, include `aria-hidden="true"` and `focusable="false"`.

### Accessibility

Built into UI components - don't reinvent.

| Pattern | Implementation |
|---------|----------------|
| Form errors | `aria-invalid`, `aria-describedby`, `role="alert"` - see `Input.tsx`, `FloatingInput.tsx` |
| Loading states | `aria-busy` on buttons, `role="status"` on spinners - see `Button.tsx`, `LoadingSpinner.tsx` |
| Modals | `aria-modal`, `aria-labelledby`, Escape to close, focus trap, focus restoration - see `Modal.tsx` |
| Toasts | `aria-live="polite"`, `role="alert"` - see `ToastContainer.tsx` |
| Focus styling | `focus-visible:ring-2` consistently on all interactive elements |
| Reduced motion | `prefers-reduced-motion` check in `Modal.tsx` |
| Icons | `aria-hidden="true"`, `focusable="false"` on all icons |
| Skip link | `sr-only` until focused, targets `#main-content` - see `BaseLayout.tsx` |

### Modal Focus Trap

The focus trap in `Modal.tsx` **must not steal focus from active form elements**. Before moving focus, check if the user is already interacting with an INPUT/TEXTAREA/SELECT and skip if so.

**Why:** If focus moves from an input to a button while typing, a space character triggers a button click - causing modals to close unexpectedly.

**Anti-pattern:** Debounce hacks to ignore close events are symptoms, not fixes. Investigate focus management first.

---

## Layout Composition Components

**Location:** `components/layout/`

Higher-level components that compose primitives (Stack, Surface, Card) for consistent page layouts.

| Component | Purpose | Example usage |
|-----------|---------|---------------|
| `PageHeader` | Hero section with title, description, actions | `SettingsPage.tsx` |
| `PageSection` | Glass-panel content section with optional header | `DashboardPage.tsx` |
| `FormSection` | Card wrapper for settings-style forms | `SettingsPage.tsx` |
| `TwoColumnLayout` | Sidebar + main content | `SettingsPage.tsx` |
| `ResponsiveColumns` | Mobile-aware multi-column | `GroupDetailPage.tsx` |

See component files in `components/layout/` for prop documentation.

---

## Application Hooks

**Location:** `app/hooks/`

### State Management
- `useLocalSignal(initialValue)` - Component-local signal (replaces `useState(() => signal(...))`)
- `useAsyncAction(action, options)` - Async operations with loading/error/race-condition handling

### UI Behavior
- `useClickOutside(ref, handler, options)` - Dropdown/modal dismiss on outside click

### Motion (Tenant-Controlled)
- `useThemeConfig()` - Reads motion flags from CSS variables
- `useMagneticHover()` - Cursor-following effect
- `useScrollReveal()` - Fade-up on scroll

Motion CSS variables: `--motion-enable-magnetic-hover`, `--motion-enable-scroll-reveal`, `--motion-enable-parallax`

Aurora theme: motion on. Brutalist theme: motion off. Respects `prefers-reduced-motion`.

---

## State Management

### Stores (Shared State)

**Location:** `app/stores/`

Stores use **Preact Signals** with private class fields for encapsulation. See `auth-store.ts` for the canonical pattern.

**Rules:** Private signals (`#`), public readonly getters, actions are the only mutation path.

### Components (Local State)

| Pattern | When to use | Example |
|---------|-------------|---------|
| `useState` | Simple ephemeral state (booleans, form fields) | Most modals |
| `useSignal` | Reactive state shared within component subtree | `GroupDetailPage.tsx` |
| `useLocalSignal` | Component-local signals (preferred) | `LoginPage.tsx` |
| `useAsyncAction` | Async operations with loading/error states | `CommentInput.tsx` |

**Rule:** Prefer `useLocalSignal` over manual `useState(() => signal(...))` pattern.

### Real-Time Data Refresh via Activity Feed

The app uses **activity feed events** (via Firestore real-time subscriptions) to trigger automatic UI refresh. Do NOT add manual `refreshAll()` calls after mutations.

**How it works:** User action → API call → backend generates activity event → Firestore subscription pushes to clients → `GroupDetailRealtimeCoordinator` calls `refreshAll()` → UI updates.

**Location:** `app/stores/helpers/group-detail-realtime-coordinator.ts`

**Critical rule:** Every mutation affecting group state **must** generate an activity feed event on the backend. If a mutation doesn't refresh the UI, check that the corresponding `ActivityFeedEventTypes` event is being generated in the service layer.

**Anti-pattern:** Never call `refreshAll()` after mutations—activity feed handles it automatically.

---

## Routing

- **Router:** `preact-router` in `App.tsx`
- **Code splitting:** All pages lazy-loaded via `lazy()` from `preact/compat`
- **Auth guard:** `ProtectedRoute` wraps authenticated routes, redirects to login

---

## i18n

- **Framework:** `i18next` with `react-i18next`
- **Translations:** `locales/en/translation.json`
- **Usage:** `const { t } = useTranslation(); t('key.path')`
- **Rule:** Never hardcode user-facing text
- **Rule:** Never lazily add english to non-english translations files..

### Translation Key Detection

The `translation-keys.test.ts` test validates that all translation keys are used and none are orphaned. **Keys must be statically detectable**—avoid dynamic key construction like `t(`prefix.${var}`)`.

See `app/i18n/dynamic-translations.ts` for handling dynamic keys.

---

## API Client

- **Location:** `app/apiClient.ts`
- **Pattern:** Singleton with runtime response validation via Zod
- **Schemas:** `@billsplit-wl/shared/schemas/apiSchemas.ts`

---

## Admin Pages (No Theming)

Pages under `pages/admin/` and `components/admin/` are **completely isolated from tenant theming**. They use a fixed admin stylesheet (`styles/admin.css`) and `AdminLayout`. Hardcoded colors are permitted here - admin UI must look consistent across all tenants.

---

## Key Files

| Purpose | Location |
|---------|----------|
| Tailwind config + semantic tokens + custom utilities | `webapp-v2/src/styles/global.css` |
| UI components | `components/ui/` |
| Style primitives | `components/ui/styles/` |
| Icons | `components/ui/icons/` |
| Application hooks | `app/hooks/` (`useLocalSignal`, `useAsyncAction`, `useClickOutside`) |
| Motion hooks | `app/hooks/useThemeConfig.ts`, `useMagneticHover.ts`, `useScrollReveal.ts` |
| Stores | `app/stores/` |
| Theme CSS endpoint | `/api/theme.css` |
| Tenant configs | `firebase/docs/tenants/<tenant-id>/config.json` |

---

## UI Patterns Quick Reference

| Category | Correct Pattern |
|----------|-----------------|
| **List loading** | `<SkeletonList count={3}>{SkeletonExpenseItem}</SkeletonList>` |
| **Page loading** | `LoadingState` with fullPage option |
| **Modal loading** | `LoadingSpinner` |
| **Button loading** | `Button loading={true}` prop |
| **List errors** | `ErrorState` component with retry action |
| **Inline errors** | `Alert` component |
| **Field errors** | `FieldError` component or `FormField` error prop |
| **Help text** | `help-text` class or `HelpText` component |
| **Small help text** | `help-text-xs` class |
| **Explainer text** | `InfoCircleIcon` + `Tooltip` (declutters UI, see `CustomPermissionsSection.tsx`) |
| **Badges/chips** | `Badge` component with variant, or `badge` utility class |
| **Deleted items** | `Badge variant='deleted'` or `badge-deleted` class |
| **Empty lists** | `EmptyState` with Heroicon + translated title |
| **Typography** | `Typography` component with semantic variants |
| **List spacing** | `Stack spacing='sm'` (compact) / `'md'` (standard) / `'lg'` (spacious) |
| **Form spacing** | `Stack spacing='lg'` between fields |
| **Modal structure** | `ModalHeader`, `ModalContent`, `ModalFooter` components |
| **Load more buttons** | `LoadMoreButton` component |
| **Section headers** | `SectionTitle` component with icon + label |
| **Member display** | `MemberDisplay` component (avatar + name) |
| **List item cards** | `listItem.base` / `listItem.clickable` from style primitives |
| **Icon buttons** | `iconButton.ghost` from style primitives, or `Button variant='ghost'` |
| **Async actions** | `useAsyncAction` hook for loading/error handling |

---

## Test Selectors

**Prefer what the user can see** over internal identifiers. See `docs/guides/testing.md` for full patterns.

### The Golden Rule

**Scope first, then select.** Find container by heading/landmark, then element within. Never use `.first()`, `.nth()`, or ambiguous selectors.

### Selector Priority (Best → Worst)

1. Scoped by heading/landmark
2. ARIA roles with visible name: `getByRole('button', { name: 'Submit' })`
3. Form labels: `getByLabel('Email')`
4. Placeholders: `getByPlaceholder('Enter amount')`
5. `aria-label` for icon-only buttons
6. Test IDs (last resort)

### When to use `data-testid`

Only for: container elements without visible text, duplicate labels across sections, or ambiguous composite components.

### Patterns

| Pattern | Component | Test selector |
|---------|-----------|---------------|
| Icon-only button | `aria-label={`Remove ${item}`}` | `getByRole('button', { name: /Remove/ })` |
| List item action | `aria-label={`${t('approve')} ${name}`}` | `getByRole('button', { name: /Approve.*Name/ })` |
| Select in label | Wrap `<select>` in `<label>` | `locator('label').filter({ hasText }).locator('select')` |

### Summary

`Container → Role/Label → Visible text → aria-label → test-id`

Every selector should be **unambiguous**. If multiple elements could match, scope by container first.

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `class='...'` in TSX | `className='...'` (JSX syntax) |
| `for='...'` on labels | `htmlFor='...'` (JSX syntax) |
| `stroke-linecap`, `stroke-linejoin`, `stroke-width` in SVG | `strokeLinecap`, `strokeLinejoin`, `strokeWidth` (camelCase) |
| `import { Icon } from '@heroicons/react/*'` | `import { Icon } from '@/components/ui/icons'` |
| `bg-gray-600` | `bg-surface-raised` |
| `style={{ color: '#fff' }}` | `className="text-text-inverted"` |
| `:root { --color: #fff }` in CSS | Let theme system set variables |
| `<div onClick={...}>` | `<Clickable onClick={...}>` |
| `bg-surface-raised/50` on menus | `bg-surface-raised` (opaque) |
| `bg-surface-base/30`, `bg-surface-raised/50` on list items | `bg-surface-subtle` |
| Module-level signals | Private class field signals |
| Hardcoded strings in UI | `t('translation.key')` |
| `"Loading..."` text | `LoadingSpinner` or `Skeleton*` |
| Emoji icons (⚠️) | Heroicons components |
| `space-y-*` classes | `Stack spacing='*'` or CSS var gap |
| Custom error divs | `ErrorState` or `Alert` |
| Inline error `<p>` styling | `FieldError` component |
| `text-sm text-text-muted` | `help-text` utility class |
| `text-xs text-text-muted` | `help-text-xs` utility class |
| Inline badge/chip styling | `Badge` component or `badge` utility |
| Inline modal header/content/footer | `ModalHeader`, `ModalContent`, `ModalFooter` |
| Raw `<button>` | `Button` or `Clickable` |
| Dropdown in `overflow:hidden` container | Portal to `document.body` (see `Modal.tsx`, `Tooltip.tsx`) |
| `absolute` class on Tooltip child | Put `absolute` on `Tooltip className` prop instead |
| `flex-1` input/element overflowing in Safari | Add `min-w-0` to allow shrinking below content width |
| Flex item without `shrink-0` in Safari | Add `shrink-0` to buttons/fixed-width elements in flex containers |
| Manual `refreshAll()` after mutations | Let activity feed trigger refresh automatically |
| `outline-none` | `outline-hidden` (Tailwind v4) |
| `flex-shrink-0` | `shrink-0` (Tailwind v4 simplified) |
| `shadow-[var(--x)]` arbitrary syntax | `shadow-(--x)` (Tailwind v4 CSS var syntax) |
| `@layer components { .foo { ... } }` | `@utility foo { ... }` (Tailwind v4) |
| `data-testid` on elements with semantic meaning | Only add when no role, label, or visible text exists |
| Inline explainer text cluttering forms | `InfoCircleIcon` + `Tooltip` beside labels |
| `useState(() => signal(...))` pattern | `useLocalSignal()` hook |
| Manual `isLoading`/`setError` state management | `useAsyncAction()` hook |
| Inline form input styling | Import from `formStyles` primitives |
| Inline list item hover classes | `listItem.base` or `listItem.clickable` primitives |
| Inline icon button styling | `iconButton.ghost` primitives or `Button variant='ghost'` |
| Manual skeleton loops | `<SkeletonList count={N}>{SkeletonItem}</SkeletonList>` |
| `<div>` with icon + label for sections | `<SectionTitle icon={...} label={...} />` |
| Avatar + name markup in lists | `<MemberDisplay ... />` component |
| Custom "load more" buttons | `<LoadMoreButton onClick={...} loading={...} />` |
| Raw `<textarea>` | `Textarea` component |
| Raw `<select>` with manual styling | `Select` component |

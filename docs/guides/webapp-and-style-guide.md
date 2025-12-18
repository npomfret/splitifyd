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

## Component Patterns

**Location:** `components/ui/`

### Core Components
- `Button` - Primary uses gradient, magnetic hover on by default
- `Surface` - Base container with variants: `base`, `muted`, `inverted`, `glass`
- `Card` - Wraps Surface with title/subtitle
- `Clickable` - Wraps non-button interactive elements for analytics
- `Input`, `FloatingInput` - Form inputs with error states
- `Typography` - Text with variants: `body`, `caption`, `heading`, `display`
- `Badge` - Status/label indicators with variants: `primary`, `success`, `warning`, `error`
- `FieldError` - Form validation error messages
- `HelpText` - Help/description text (or use `help-text` utility class)
- `ModalHeader`, `ModalContent`, `ModalFooter` - Modal section wrappers

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

### PageHeader - Hero section
```tsx
<PageHeader
  label="Account"           // optional eyebrow label
  title="Settings"          // required
  description="Manage..."   // optional
  actions={<Button>...</Button>}  // optional right-side actions
/>
```

### PageSection - Content section wrapper
```tsx
<PageSection
  title="Recent Groups"
  actions={<Button>Create</Button>}  // optional header actions
  glass={true}                        // glass-panel styling (default: true)
>
  {children}
</PageSection>
```

### FormSection - Card wrapper for forms
```tsx
<FormSection
  title="Change Password"
  description="Tooltip content for info icon"
  moreInfoLabel="More info"  // aria-label for tooltip trigger
>
  <Input label="Current" />
  <Button>Save</Button>
</FormSection>
```

### TwoColumnLayout - Sidebar + main content
```tsx
<TwoColumnLayout
  sidebar={<ProfileCard />}
  sidebarWidth="medium"      // 'narrow' | 'medium' | 'wide'
  stickyHeader               // sidebar sticks on scroll
  gap="md"                   // gap between columns
>
  {mainContent}
</TwoColumnLayout>
```

### ResponsiveColumns - Mobile-aware multi-column
```tsx
<ResponsiveColumns
  left={<MembersList />}
  main={<ExpensesList />}
  right={<BalancesSection />}
  mobileOrder={['main', 'right', 'left']}  // stack order on mobile
  mobileHidden={['left']}                   // hide on mobile
/>
```

**Usage rules:**
- Use `PageHeader` for all page hero sections
- Use `PageSection` for glass-panel content sections with optional headers
- Use `FormSection` for settings-style form cards
- Use `TwoColumnLayout` for sidebar + main layouts (like SettingsPage)
- Use `ResponsiveColumns` for complex multi-column layouts

---

## Motion System

**Location:** `app/hooks/`

Tenant-controlled via CSS variables:
- `--motion-enable-magnetic-hover`
- `--motion-enable-scroll-reveal`
- `--motion-enable-parallax`

### Hooks
- `useThemeConfig()` - Reads motion flags
- `useMagneticHover()` - Cursor-following effect
- `useScrollReveal()` - Fade-up on scroll

Aurora theme: motion on. Brutalist theme: motion off. Respects `prefers-reduced-motion`.

---

## State Management

### Stores (Shared State)

**Location:** `app/stores/`

Stores use **Preact Signals** with private class fields for encapsulation:

```typescript
class StoreImpl {
    readonly #dataSignal = signal<Data[]>([]);

    get data() { return this.#dataSignal.value; }
    get dataSignal(): ReadonlySignal<Data[]> { return this.#dataSignal; }

    async load() { this.#dataSignal.value = await api.fetch(); }
}
export const store = new StoreImpl();
```

**Rules:** Private signals (`#`), public readonly getters, actions are the only mutation path.

### Components (Local State)

Local state management in components uses a mix of Preact's `useState` hook and Signals, depending on the component's needs. The codebase follows three main patterns.

#### 1. `useState` for Simple, Ephemeral State
For simple component-local state that doesn't need to be shared (e.g., form inputs, loading flags, modal visibility), the standard `useState` hook is used. This is the simplest and most direct way to handle local state.

```typescript
function MyComponent() {
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // ...
}
```

#### 2. `useSignal` for Reactive Local State
When a component's local state needs to be reactive and shared between multiple functions or child components within that component's tree, the `useSignal` hook is used.

```typescript
function GroupDetailPage() {
    const isInitialized = useSignal(false);
    const showLeaveGroupDialog = useSignal(false);
    // ...
}
```

#### 3. `useState` with `signal` for Component-Local Signals
In many components, you will find a pattern that combines `useState` and `signal` to create a component-local signal:

```typescript
function LoginPage() {
    // Component-local signals - initialized within useState to avoid stale state across instances
    const [emailSignal] = useState(() => signal(''));
    const [passwordSignal] = useState(() => signal(''));
    // ...
}
```

This pattern uses `useState`'s initializer function to create a signal only on the first render. The comment found throughout the codebase, "initialized within useState to avoid stale state across instances," suggests this is a deliberate pattern to ensure that each component instance gets a fresh signal, possibly to address issues with component reuse or Hot Module Replacement (HMR).

**Guidance:**
-   Use `useState` for simple, non-shared local state.
-   Use `useSignal` for reactive local state that needs to be shared within a component's subtree.
-   The `useState(() => signal(...))` pattern is prevalent in the codebase for creating component-local signals. While `useSignal` should be preferred for new components, be aware of this pattern and its intended purpose of avoiding stale state.

### Real-Time Data Refresh via Activity Feed

The app uses **activity feed events** (via Firestore real-time subscriptions) to trigger automatic UI refresh. Do NOT add manual `refreshAll()` calls after mutations.

**How it works:**
1. User action triggers API call (create/update/delete expense, settlement, etc.)
2. Backend generates an activity feed event for the action
3. Firestore subscription pushes the event to subscribed clients
4. `GroupDetailRealtimeCoordinator` receives event and calls `refreshAll()`
5. UI updates automatically

**Location:** `app/stores/helpers/group-detail-realtime-coordinator.ts`

**Critical rule:** Every mutation that affects group state **must** generate an activity feed event on the backend, or other clients will not see the change. If a mutation doesn't refresh the UI, check that the corresponding `ActivityFeedEventTypes` event is being generated in the service layer.

| Event Type | Generated By |
|------------|--------------|
| `group-created` | `GroupService.createGroup()` |
| `expense-created/updated/deleted` | `ExpenseService` methods |
| `settlement-created/updated/deleted` | `SettlementService` methods |
| `member-joined/left` | `GroupMemberService` methods |

**Anti-pattern:**
```typescript
// ❌ Don't manually refresh after mutations
await apiClient.createExpense(data);
await groupDetailStore.refreshAll(); // Unnecessary!

// ✅ Activity feed handles refresh automatically
await apiClient.createExpense(data);
onClose(); // Just close the modal, Firestore subscription will trigger refresh
```

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

The `translation-keys.test.ts` test validates that all translation keys are used and none are orphaned. For this to work, **translation keys must be statically detectable**.

**Always use literal string keys and avoid dynamic key construction:**
```typescript
// BAD - test cannot detect these keys
t(`admin.tabs.${tab.labelKey}`)
t(`securitySettingsModal.permissions.${key}.label`)
const translationKey = 'foo.bar'; t(translationKey)
```

See @webapp-v2/src/app/i18n/dynamic-translations.ts for examples of dynamic key construction

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
| Icons | `components/ui/icons/` |
| Motion hooks | `app/hooks/useThemeConfig.ts`, `useMagneticHover.ts`, `useScrollReveal.ts` |
| Stores | `app/stores/` |
| Theme CSS endpoint | `/api/theme.css` |
| Tenant configs | `firebase/docs/tenants/<tenant-id>/config.json` |

---

## UI Patterns Quick Reference

| Category | Correct Pattern |
|----------|-----------------|
| **List loading** | Use `Skeleton*Item` components (SkeletonExpenseItem, etc.) |
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
| **Empty lists** | `EmptyState` with Heroicon + translated title |
| **Typography** | `Typography` component with semantic variants |
| **List spacing** | `Stack spacing='sm'` (compact) / `'md'` (standard) / `'lg'` (spacious) |
| **Form spacing** | `Stack spacing='lg'` between fields |
| **Modal structure** | `ModalHeader`, `ModalContent`, `ModalFooter` components |

---

## Test Selectors

When adding attributes to elements for testing, **prefer what the user can see** over internal identifiers. The goal is to make tests resilient to refactoring while staying tied to user-visible behavior.

### The Golden Rule

**Scope first, then select.** Use a container's heading or landmark to narrow scope, then find the element within. Never use `.first()`, `.nth()`, or ambiguous selectors that could match multiple elements.

If you must deviate (global selector, generic role, index-based selection), add a brief justification comment explaining why it’s unique/stable.

```typescript
// ✅ Scoped by section heading - unambiguous
const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Currency Settings' }) });
const toggle = section.getByRole('switch');

// ❌ Ambiguous - which switch? Fragile if page changes
const toggle = page.getByRole('switch').first();
```

### Selector Priority (Best → Worst)

1. **Scoped by heading/landmark** - Find container by heading, then element within
2. **ARIA roles with visible name** - `getByRole('button', { name: 'Submit' })`
3. **Form labels** - `getByLabel('Email address')`
4. **Placeholders** - `getByPlaceholder('Enter amount')`
5. **aria-label** - For icon-only buttons: `<button aria-label="Remove USD">`
6. **Test IDs (last resort)** - Only when semantic options don't exist

### When `data-testid` is Appropriate

- Container elements without visible text (wrappers, grids)
- Elements with duplicate labels across sections (e.g., multiple "Primary" color inputs)
- Complex composite components where role-based selection is ambiguous

### When `data-testid` is NOT Needed

- Buttons with visible text → use `getByRole('button', { name: '...' })`
- Inputs with labels → use `getByLabel('...')`
- Links with visible text → use `getByRole('link', { name: '...' })`
- Headings → use `getByRole('heading', { name: '...' })`

### Pattern: Icon-Only Buttons

For buttons with only an icon and no visible text, add `aria-label`:

```tsx
// ✅ Component
<button onClick={onRemove} aria-label={`Remove ${currency}`}>
    <XIcon size={16} />
</button>

// ✅ Test selector
getByRole('button', { name: `Remove ${currency}` })
```

### Pattern: Items in Lists/Loops

For buttons or elements inside mapped lists, include identifying context in the aria-label:

```tsx
// ✅ Component - button shows visible text, aria-label adds context
<Button
    onClick={() => onApprove(member.uid)}
    aria-label={`${t('approve')} ${member.groupDisplayName}`}
>
    {t('approve')}
</Button>

// ✅ Test selector - find by aria-label pattern
getByRole('button', { name: /^Approve\s+.*JohnDoe/i })
```

### Pattern: Selects Inside Labels

For `<select>` elements wrapped in `<label>`, use the label text:

```tsx
// ✅ Component
<label>
    <span>{t('permissions.expenseEditing.label')}</span>
    <select value={value} onChange={handleChange}>
        <option>...</option>
    </select>
</label>

// ✅ Test selector - find label by text, then select inside
locator('label').filter({ hasText: labelText }).locator('select')
```

### Anti-Patterns

| Don't | Do |
|-------|-----|
| `.first()`, `.nth(0)`, `.last()` | Scope by heading/section first |
| `data-testid={`item-${id}`}` on buttons with text | `aria-label` or just use visible text |
| `data-testid="submit-button"` | `getByRole('button', { name: 'Submit' })` |
| `data-testid="email-input"` | `getByLabel('Email')` |
| Index-based IDs (`remove-${index}`) | Content-based IDs (`aria-label={`Remove ${item}`}`) |

### Summary

```
Container (heading/landmark) → Role/Label → Visible text → aria-label → test-id
```

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

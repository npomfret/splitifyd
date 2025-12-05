# Webapp Style Guide

**This is a multi-tenant white-label application. Tenant branding flows through CSS variables. Hardcoded colors break everything.**

---

## The One Rule

**Use semantic tokens only.** Never `bg-gray-*`, `text-white`, inline styles, or `:root` variables in CSS files. All colors come from `/api/theme.css` generated per-tenant.

---

## Semantic Tokens

Defined in `tailwind.config.js`, consumed via CSS variables from tenant theme.

| Category | Tokens |
|----------|--------|
| **Surfaces** | `surface-base`, `surface-muted`, `surface-raised`, `surface-glass` |
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

### Rules
1. All interactive elements use `Button` or `Clickable` - no naked `onClick`
2. `Clickable` with `as="button"` for icon buttons
3. Error states: `aria-invalid`, `aria-describedby`, `role="alert"`
4. Forward refs for components needing hooks

### Icons

**Location:** `components/ui/icons/`

Icons are TSX components, not external SVG files. This is required for theming - external SVGs loaded via `<img>` cannot use `currentColor` to inherit text colors.

```tsx
import { CheckIcon } from '@/components/ui/icons';

<CheckIcon size={20} className="text-semantic-success" />
```

**Props:** `size` (pixels), `className` (for color via `text-*` tokens)

**Adding icons:** Create a new file in `icons/`, export from `icons/index.ts`. Use `currentColor` for stroke/fill, include `aria-hidden="true"` and `focusable="false"`.

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

Components use **`useState`** from `preact/hooks` for local/ephemeral state:

```typescript
function MyComponent() {
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // ...
}
```

**Why this distinction:**
- Signals provide encapsulation benefits in stores where state is shared across components
- `useState` is simpler and sufficient for component-local state (form inputs, loading states, modals)
- Avoid mixing `useSignal` and `useState` in the same component

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

---

## API Client

- **Location:** `app/apiClient.ts`
- **Pattern:** Singleton with runtime response validation via Zod
- **Schemas:** `@billsplit/shared/schemas/apiSchemas.ts`

---

## Admin Pages (No Theming)

Pages under `pages/admin/` and `components/admin/` are **completely isolated from tenant theming**. They use a fixed admin stylesheet (`styles/admin.css`) and `AdminLayout`. Hardcoded colors are permitted here - admin UI must look consistent across all tenants.

---

## Key Files

| Purpose | Location |
|---------|----------|
| Semantic tokens | `tailwind.config.js` |
| UI components | `components/ui/` |
| Icons | `components/ui/icons/` |
| Motion hooks | `app/hooks/useThemeConfig.ts`, `useMagneticHover.ts`, `useScrollReveal.ts` |
| Stores | `app/stores/` |
| Global animations | `styles/global.css` |
| Theme CSS endpoint | `/api/theme.css` |
| Tenant configs | `firebase/docs/tenants/<tenant-id>/config.json` |

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `bg-gray-600` | `bg-surface-raised` |
| `style={{ color: '#fff' }}` | `className="text-text-inverted"` |
| `:root { --color: #fff }` in CSS | Let theme system set variables |
| `<div onClick={...}>` | `<Clickable onClick={...}>` |
| `bg-surface-raised/50` on menus | `bg-surface-raised` (opaque) |
| Module-level signals | Private class field signals |
| Hardcoded strings in UI | `t('translation.key')` |

---

## After UI Changes

1. Test on `localhost` (Aurora) and `127.0.0.1` (Brutalist)
2. Run: `cd firebase && npm run theme:publish-local`
3. Hard refresh: Cmd+Shift+R
4. Verify no hardcoded colors: `grep -r "bg-gray\|bg-blue\|text-white" webapp-v2/src/components`

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

**Location:** `app/stores/`

Signal-based with private fields:

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

---

## Admin Exception

Pages in `pages/admin/` and `components/admin/` **can** use hardcoded colors. These use `AdminLayout` which isolates from tenant theming. See `styles/admin.css`.

---

## Key Files

| Purpose | Location |
|---------|----------|
| Semantic tokens | `tailwind.config.js` |
| UI components | `components/ui/` |
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

---

## After UI Changes

1. Test on `localhost` (Aurora) and `127.0.0.1` (Brutalist)
2. Run: `cd firebase && npm run theme:publish-local`
3. Hard refresh: Cmd+Shift+R
4. Verify no hardcoded colors: `grep -r "bg-gray\|bg-blue\|text-white" webapp-v2/src/components`

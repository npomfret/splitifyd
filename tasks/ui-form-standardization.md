# UI Component Standardization

## Problem

Styling is inconsistent across UI components:
- Semantic tokens exist but aren't enforced
- Patterns are duplicated instead of shared
- Easy to use wrong values (hardcoded colors, wrong surface tokens)
- No guardrails to prevent violations

Example bug: CreateGroupModal textarea used `bg-surface-base` while Input uses `bg-surface-raised`.

## Goal

Make the right thing easy and the wrong thing hard:
- Clear patterns in code that are easy to follow
- Shared primitives that make correct usage the path of least resistance
- Components that are impossible to style incorrectly

---

## Solution: Layered Style Primitives

### Layer 1: Surface Tokens (`styles/surfaces.ts`)

```typescript
export const surfaces = {
    base: 'bg-surface-base',
    muted: 'bg-surface-muted',
    raised: 'bg-surface-raised backdrop-blur-xs',
    glass: 'bg-surface-glass backdrop-blur-md',
    subtle: 'bg-surface-subtle',
} as const;
```

### Layer 2: Interactive States (`styles/states.ts`)

```typescript
export const states = {
    disabled: 'opacity-60 cursor-not-allowed',
    disabledBg: 'bg-surface-muted text-text-muted',
    errorBorder: 'border-border-error',
    errorText: 'text-semantic-error',
    errorFocus: 'focus-visible:ring-semantic-error focus-visible:border-semantic-error',
    focusRing: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',
    focusRingOffset: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
} as const;

export const errorState = `${states.errorBorder} ${states.errorText} ${states.errorFocus}`;
export const disabledState = `${states.disabled} ${states.disabledBg}`;
```

### Layer 3: Component Primitives (`styles/formStyles.ts`)

```typescript
export const formInput = {
    base: [
        'block w-full rounded-md border border-border-default px-3 py-2 shadow-sm',
        'text-text-primary placeholder:text-text-muted/70',
        states.focusRing,
        'sm:text-sm sm:leading-6 transition-colors duration-200',
        surfaces.raised,
    ] as const,
    error: errorState,
    disabled: disabledState,
} as const;

export const formTextarea = {
    base: [...formInput.base, 'resize-none'] as const,
    error: formInput.error,
    disabled: formInput.disabled,
} as const;

export const formSelect = {
    base: [...formInput.base, 'pr-10 appearance-none cursor-pointer'] as const,
    error: formInput.error,
    disabled: formInput.disabled,
} as const;

export const formFloatingInput = {
    base: [
        'block w-full rounded-md border border-border-default px-3 pt-6 pb-2 shadow-sm',
        'text-text-primary placeholder:text-transparent',
        states.focusRing,
        'sm:text-sm transition-all duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        surfaces.raised,
    ] as const,
    error: errorState,
    disabled: disabledState,
} as const;

export const formLabel = {
    base: 'mb-2 block text-sm font-medium text-text-primary',
    required: 'text-semantic-error ml-1',
} as const;
```

### Layer 4: Component Usage

Components import primitives and compose:

```typescript
// Input.tsx
import { formInput, formLabel } from './styles';

const inputClasses = cx(
    ...formInput.base,
    error && formInput.error,
    disabled && formInput.disabled,
    className,
);
```

---

## Files Created

```
webapp-v2/src/components/ui/styles/
├── index.ts         # Re-exports all primitives
├── surfaces.ts      # Surface tokens (raised, muted, base, etc.)
├── states.ts        # Interactive states (disabled, error, focus)
└── formStyles.ts    # Form input/textarea/select primitives
```

## Files Modified

| File | Changes |
|------|---------|
| `Input.tsx` | Uses `formInput` + `formLabel` primitives |
| `Textarea.tsx` | NEW - Uses `formTextarea` + `formLabel` primitives |
| `Select.tsx` | Uses `formSelect` + `formLabel` primitives |
| `FloatingInput.tsx` | Uses `formFloatingInput` primitives |
| `ColorInput.tsx` | Fixed `border-gray-400` → `border-border-strong` |
| `Checkbox.tsx` | Uses `FieldError` for consistent error display |
| `TimeInput.tsx` | Uses `FieldError` + proper ARIA attributes + `id` prop |
| `ImageUploadField.tsx` | Uses `FieldError` for consistent error display |
| `index.ts` | Exports `Textarea` |

## Consumer Updates

| File | Change |
|------|--------|
| `CreateGroupModal.tsx` | Replace raw textarea with `<Textarea>` component |
| `GroupGeneralTabContent.tsx` | Replace raw textarea with `<Textarea>` component |

---

## Benefits

1. **Single source of truth** - All form styling defined in one place
2. **Impossible to use wrong surface** - Import primitives, not raw classes
3. **Consistent error/disabled states** - Shared across all components
4. **Easy to audit** - Search for primitive imports to verify usage
5. **Future changes propagate** - Update primitive, all components update

---

## Future: Automated Enforcement

Add ESLint rules to catch:
- Hardcoded color classes (`bg-gray-*`, `text-white`, etc.)
- Inline style objects with color values
- Direct Tailwind color usage instead of semantic tokens

Note: No ESLint currently in project. Can add as follow-up task.

---

## Verification

- [x] Style primitives created
- [x] ColorInput hardcoded color fixed
- [x] Form components refactored to use primitives
- [x] Textarea component exported
- [x] Consumer components updated
- [x] Checkbox/TimeInput/ImageUploadField use FieldError consistently
- [x] Build passes

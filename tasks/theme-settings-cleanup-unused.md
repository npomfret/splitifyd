# Theme Settings Cleanup - Unused Tokens

Remove or wire up unused theme settings discovered during audit.

## Background

Audit of theme settings (see `docs/theme-settings-guide.md`) found several settings that are:
- Configured in admin UI but never consumed
- Defined in schema but have no Tailwind/component mappings
- Used in components but missing from Tailwind config

---

## Tasks

### 1. Remove `enableButtonGradient` flag

**Status:** Unused - button gradient is always applied when `--gradient-primary` exists

**Files:**
- `webapp-v2/src/components/admin/tenant-editor/types.ts` - Remove from `TenantData`
- `webapp-v2/src/components/admin/tenant-editor/transformers.ts` - Remove extraction/building logic
- `webapp-v2/src/components/admin/tenant-editor/sections/` - Remove UI section if exists
- `packages/shared/src/types/branding.ts` - No change needed (gradient itself is optional)

**Decision:** Remove flag entirely. Gradient applies automatically when gradient colors are defined.

---

### 2. Remove `enableGlassmorphism` flag

**Status:** Unused - glass panels always apply `.glass-panel` class regardless of flag

**Files:**
- `webapp-v2/src/components/admin/tenant-editor/types.ts` - Remove from `TenantData`
- `webapp-v2/src/components/admin/tenant-editor/transformers.ts` - Remove extraction/building logic
- `webapp-v2/src/components/admin/tenant-editor/sections/` - Remove UI section if exists

**Decision:** Remove flag entirely. Glassmorphism applies automatically when `surface.glass` color is defined.

---

### 3. Add missing `border-subtle` to Tailwind config

**Status:** Used in `Header.tsx` but not defined in Tailwind

**Files:**
- `webapp-v2/tailwind.config.js` - Add `subtle` to borderColor extend

**Fix:**
```js
borderColor: {
  'border-subtle': 'rgb(var(--border-subtle-rgb) / <alpha-value>)',
  // ... existing entries
}
```

---

### 4. Remove unused optional text colors from schema

**Status:** Defined but never used

**Tokens to evaluate:**
- `text.disabled` - No Tailwind class, no component usage
- `text.hero` - No Tailwind class, no component usage
- `text.eyebrow` - No Tailwind class, no component usage
- `text.code` - No Tailwind class, no component usage

**Decision:** Keep in schema (they're optional), but don't add Tailwind mappings until needed. Document as "reserved for future use" in the guide.

---

### 5. Remove unused optional interactive colors from schema

**Status:** Defined but never used

**Tokens to evaluate:**
- `interactive.ghost` - No Tailwind class, no component usage
- `interactive.magnetic` - No Tailwind class, no component usage
- `interactive.glow` - No Tailwind class, no component usage

**Decision:** Keep in schema (they're optional), but don't add Tailwind mappings until needed.

---

### 6. Remove `typography.fontFamily.serif` if unused

**Status:** Defined but no component references serif fonts

**Files to check:**
- `webapp-v2/tailwind.config.js` - Is `font-serif` extended?
- `webapp-v2/src/` - Any usage of `font-serif` class?

**Decision:** Keep in schema (optional field), remove from tenant configs if not used.

---

## Order of Operations

1. Fix `border-subtle` Tailwind mapping (prevents silent failures)
2. Remove `enableButtonGradient` flag
3. Remove `enableGlassmorphism` flag
4. Update `docs/theme-settings-guide.md` to note optional/reserved tokens

---

## Validation

After changes:
- `npm run build` passes
- TenantEditorModal still works (minus removed sections)
- Header border renders correctly
- Glass panels still work when `surface.glass` is defined
- Button gradients still work when `gradient.primary` is defined

# Theme Settings Cleanup - Unused Tokens ✅ DONE

Removed unused theme settings discovered during audit.

## Completed Tasks

### 1. ✅ Removed `enableButtonGradient` flag

Removed from:
- `types.ts`, `defaults.ts`, `transformers.ts`
- `InteractiveColorsSection.tsx` (toggle removed)
- `translation.json`
- Tests updated

### 2. ✅ Removed `enableGlassmorphism` flag

Removed from:
- `types.ts`, `defaults.ts`, `transformers.ts`
- `MotionEffectsSection.tsx` (toggle removed)
- `GlassmorphismSection.tsx` (now shows always, empty = disabled)
- `translation.json`
- Tests updated

Glass now applies automatically when `glassColor` is set.

### 3. ✅ Added `border-subtle` to Tailwind config

Added to `tailwind.config.js`:
```js
'border-subtle': 'rgb(var(--border-subtle-rgb, 241 245 249) / <alpha-value>)',
```

### 4. ✅ Removed unused text color token from schema

Removed from `packages/shared/src/types/branding.ts`:
- `text.disabled` (not referenced anywhere in CSS or components)

**Kept** (have CSS fallbacks in `global.css`):
- `text.hero` - used in `.hero-heading`
- `text.eyebrow` - used in `.eyebrow`
- `text.code` - used in `code` elements

### 5. ✅ Wired interactive effect tokens into webapp

**Added back and wired in** (per user request):
- `interactive.ghost` - Ghost button hover background color
- `interactive.magnetic` - Magnetic hover glow color
- `interactive.glow` - Focus state outer glow color

Files modified:
- `packages/shared/src/types/branding.ts` - Added as optional CssColorSchema
- `webapp-v2/src/components/admin/tenant-editor/types.ts` - Form fields
- `webapp-v2/src/components/admin/tenant-editor/defaults.ts` - Empty defaults
- `webapp-v2/src/components/admin/tenant-editor/transformers.ts` - Extract/build
- `webapp-v2/tailwind.config.js` - Tailwind color definitions with fallbacks
- `webapp-v2/src/components/ui/Button.tsx` - Ghost variant uses ghost token, primary uses magnetic/glow via CSS utilities
- `webapp-v2/src/styles/global.css` - `.focus-glow`, `.magnetic-glow` utilities
- `webapp-v2/src/components/admin/tenant-editor/sections/InteractiveColorsSection.tsx` - Color pickers
- `firebase/docs/tenants/localhost-tenant/config.json` - Example values

### 6. Serif font - KEPT (not unused)

The `typography.fontFamily.serif` field is:
- Optional in schema
- Editable in TenantEditorModal (TypographySection)
- Stored and transformed correctly
- Not consumed by webapp (no `font-serif` class)

**Decision:** Keep - it's correctly optional and may be used by future themes.

---

## Validation

- ✅ `npm run build` passes
- ✅ Transformer tests pass (18/18)
- ✅ Glass panels work when `glassColor` is set
- ✅ Header `border-border-subtle` now resolves correctly

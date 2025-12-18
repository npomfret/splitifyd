# Tenant Editor Field Registry Refactor

## Status: COMPLETE

## Summary

Successfully refactored the tenant editor to use a Field Registry as the single source of truth for all 160+ fields. Adding a new field now requires changes in just **2 places** (registry entry + TenantData interface line in same module) instead of 5-6 files.

### Results

| Metric | Before | After |
|--------|--------|-------|
| Places to add new field | 5-6 files | 2 lines (registry + interface) |
| Lines of transformer code | ~350 | ~80 |
| Section components | 14 files | 0 (auto-generated) |
| AdminPage bundle size | ~128 KB | ~113 KB |
| Tests | 15 passing | 15 passing |

---

## What Was Done

### Phase 1: Created Field Registry Module

Created `webapp-v2/src/components/admin/tenant-editor/field-registry/`:

- **`field-types.ts`** - Discriminated union type definitions (ColorFieldDef, StringFieldDef, etc.)
- **`registry.ts`** - All 160+ field entries with tokenPath mappings
- **`defaults.ts`** - Generated EMPTY_TENANT_DATA from registry
- **`transformers.ts`** - Generic path-based extract/build using getByPath/setByPath
- **`validation.ts`** - Generated validation from registry required flags
- **`index.ts`** - Public exports

### Phase 2: Created Auto-Rendering Components

Created `webapp-v2/src/components/admin/tenant-editor/components/`:

- **`FieldRenderer.tsx`** - Renders correct input component based on field.type (color, rgba, string, number, boolean, colorArray, select). Includes inline `ColorArrayField` component for aurora gradient (array of 2-4 colors)
- **`AutoSection.tsx`** - Auto-renders all fields for a section from registry, handles subsections and grid layout

### Phase 3: Created Section Configuration

Created **`section-config.ts`** with:
- Section metadata (id, title, description, testId)
- Advanced-only flags
- Conditional visibility (e.g., aurora only shown when parallax enabled)
- Default open state

### Phase 4: Migration & Cleanup

- Updated **`TenantEditorModal.tsx`** to use AutoSection components
- Kept **`PaletteColorsSection.tsx`** for its special color derivation UI
- **Deleted 14 section component files** (SurfaceColorsSection, TextColorsSection, etc.)
- **Deleted old infrastructure** (defaults.ts, transformers.ts, validation.ts)

---

## Architecture

```
FIELD_REGISTRY (field-registry/registry.ts)
       │
       ├─► EMPTY_TENANT_DATA (generated from registry defaults)
       ├─► extractFormDataFromTokens() (generic path-based using tokenPath)
       ├─► buildBrandingTokensFromForm() (generic path-based using tokenPath)
       ├─► validateTenantData() (generated from registry required flags)
       └─► AutoSection/FieldRenderer (auto-rendered from registry)
```

---

## How to Add a New Field

1. Add entry to `FIELD_REGISTRY` in `field-registry/registry.ts`:
```typescript
{
    key: 'newField',           // Must match TenantData property
    type: 'string',            // color | rgba | string | number | boolean | colorArray | select
    label: 'New Field',
    section: 'surfaces',       // Which section to render in
    required: true,
    default: '',
    tokenPath: 'path.to.token', // Path in BrandingTokens for extract/build
    testId: 'new-field-input',
    placeholder: 'Enter value',
}
```

2. Add property to `TenantData` interface in `types.ts`:
```typescript
newField: string;
```

That's it! The field will automatically:
- Have the correct default value
- Be extracted/built from BrandingTokens
- Be validated if required
- Render in the correct section with correct input type

---

## Files Created

| File | Purpose |
|------|---------|
| `field-registry/field-types.ts` | Type definitions for FieldDef |
| `field-registry/registry.ts` | Single source of truth (160+ entries) |
| `field-registry/defaults.ts` | Generated EMPTY_TENANT_DATA |
| `field-registry/transformers.ts` | Generic extract/build |
| `field-registry/validation.ts` | Generated validation |
| `field-registry/index.ts` | Public exports |
| `components/FieldRenderer.tsx` | Type-based field rendering (includes inline ColorArrayField) |
| `components/AutoSection.tsx` | Auto-generated sections |
| `section-config.ts` | Section metadata |

## Files Deleted

Old infrastructure:
- `defaults.ts`
- `transformers.ts`
- `validation.ts`

Old section components:
- `sections/SurfaceColorsSection.tsx`
- `sections/TextColorsSection.tsx`
- `sections/BorderColorsSection.tsx`
- `sections/StatusColorsSection.tsx`
- `sections/InteractiveColorsSection.tsx`
- `sections/TypographySection.tsx`
- `sections/SpacingSection.tsx`
- `sections/RadiiSection.tsx`
- `sections/ShadowsSection.tsx`
- `sections/MotionEffectsSection.tsx`
- `sections/AuroraGradientSection.tsx`
- `sections/GlassmorphismSection.tsx`
- `sections/LegalSection.tsx`
- `sections/MarketingSection.tsx`

## Files Modified

| File | Change |
|------|--------|
| `tenant-editor/index.ts` | Updated exports |
| `TenantEditorModal.tsx` | Use AutoSection instead of 14 manual section imports |
| `sections/index.ts` | Only exports PaletteColorsSection |

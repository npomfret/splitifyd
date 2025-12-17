# Tenant Editor Field Registry Refactor

## Problem

Adding a new field to the tenant editor requires changes in **5-6 places**:
- `types.ts` - TenantData interface
- `defaults.ts` - EMPTY_TENANT_DATA
- `transformers.ts` - extractFormDataFromTokens AND buildBrandingTokensFromForm (mirror code)
- `validation.ts` - field validation arrays
- `color-derivation.ts` - DerivedColors interface (if derived)
- Section component - ColorInput/AdminFormInput JSX

**160+ fields** × **6 locations** = high maintenance friction and error potential.

## Solution: Field Registry as Single Source of Truth

Create a field metadata registry that drives types, defaults, transformers, validation, and UI rendering.

### After This Refactor
Adding a new field = **2 places** (registry entry + TenantData interface line) - both in same module, compile-time verified to match

---

## Architecture

```
FIELD_REGISTRY + TenantData interface (co-located, compile-time verified)
       │
       ├─► EMPTY_TENANT_DATA (generated from registry defaults)
       ├─► Transformers (generic path-based extract/build using tokenPath)
       ├─► Validation (generated from registry required flags)
       └─► Section UI (auto-rendered via FieldRenderer + AutoSection)
```

---

## Implementation Plan

### Phase 1: Create Field Registry Module

**New files in `webapp-v2/src/components/admin/tenant-editor/field-registry/`:**

#### 1.1 `field-types.ts` - Type definitions
```typescript
type FieldType = 'color' | 'rgba' | 'string' | 'number' | 'boolean' | 'colorArray' | 'select' | 'domains';

interface BaseFieldDef {
  key: string;              // TenantData property name
  label: string;            // Display label
  section: SectionId;       // Which section
  subsection?: string;      // Optional grouping
  required?: boolean;
  placeholder?: string;
  testId?: string;
}

// Discriminated union for each field type with tokenPath for BrandingTokens mapping
```

#### 1.2 `registry.ts` - The single source of truth (~160 entries)
```typescript
export const FIELD_REGISTRY: readonly FieldDef[] = [
  {
    key: 'primaryColor',
    type: 'color',
    label: 'Primary',
    section: 'palette',
    required: true,
    default: '',
    tokenPath: 'palette.primary',
    testId: 'primary-color-input',
  },
  // ... all 160+ fields
] as const;
```

#### 1.3 `defaults.ts` - Generated from registry
```typescript
export const EMPTY_TENANT_DATA = generateDefaults(FIELD_REGISTRY);
```

#### 1.4 `transformers.ts` - Generic path-based extract/build
```typescript
// Uses getByPath/setByPath utilities instead of 350+ lines of manual mapping
export function extractFormDataFromTokens(tokens: BrandingTokens): Partial<TenantData>
export function buildBrandingTokensFromForm(formData: TenantData): TenantBranding
```

#### 1.5 `validation.ts` - Generated from registry required flags
```typescript
export function validateTenantData(formData: TenantData, t: TFunction): string | null
```

#### 1.6 `index.ts` - Public exports

---

### Phase 2: Create Auto-Rendering Components

**New files in `webapp-v2/src/components/admin/tenant-editor/components/`:**

#### 2.1 `FieldRenderer.tsx`
Renders correct input component based on field.type:
- `color` → ColorInput
- `rgba` → RgbaColorInput
- `string` → AdminFormInput
- `number` → AdminFormInput type="number"
- `boolean` → AdminFormToggle
- `colorArray` → ColorArrayField (aurora)

#### 2.2 `AutoSection.tsx`
```typescript
<AutoSection
  sectionId="surfaces"
  title="Surface Colors"
  description="Background, card, overlay colors (8 required)"
  formData={formData}
  update={update}
  isSaving={isSaving}
/>
```
Auto-renders all fields for that section from registry, handles subsections and grid layout.

#### 2.3 `ColorArrayField.tsx`
Special handler for aurora gradient (array of 2-4 colors)

---

### Phase 3: Section Configuration

**New file: `section-config.ts`**
```typescript
export const SECTION_CONFIG: SectionConfig[] = [
  { id: 'palette', title: 'Palette Colors', description: '...', gridCols: 2 },
  { id: 'surfaces', title: 'Surface Colors', description: '...', advancedOnly: true },
  { id: 'aurora', condition: (fd) => fd.enableParallax },  // Conditional
  // ...
];
```

---

### Phase 4: Wire It Up

1. **Run bootstrap script** → generates initial registry entries
2. **Create field-registry module** with types, registry, defaults, transformers, validation
3. **Create auto-rendering components** - FieldRenderer, AutoSection, DomainList
4. **Update TenantEditorModal** → use AutoSection components
5. **Delete old code** - section components, old transformers/defaults/validation
6. **Build & test** → done

---

## Special Cases

| Case | Handling |
|------|----------|
| **tenantId** | `readonlyInEdit: true` flag, custom render |
| **domains** | `type: 'domains'` with custom DomainsField component |
| **logo/favicon** | `type: 'image'` with ImageUploadField |
| **derivation controls** | Keep custom UI in PaletteColorsSection, mark fields `uiOnly: true` |
| **aurora gradient** | `type: 'colorArray'` with ColorArrayField |
| **conditional sections** | `condition` function in SECTION_CONFIG |

---

## Files to Create

| File | Purpose |
|------|---------|
| `field-registry/field-types.ts` | Type definitions for FieldDef |
| `field-registry/registry.ts` | Single source of truth (160+ entries) |
| `field-registry/defaults.ts` | Generated EMPTY_TENANT_DATA |
| `field-registry/transformers.ts` | Generic extract/build |
| `field-registry/validation.ts` | Generated validation |
| `field-registry/index.ts` | Public exports |
| `components/FieldRenderer.tsx` | Type-based field rendering |
| `components/AutoSection.tsx` | Auto-generated sections |
| `components/ColorArrayField.tsx` | Aurora gradient handler |
| `section-config.ts` | Section metadata |

## Files to Modify

| File | Change |
|------|--------|
| `types.ts` | Add registry key exhaustiveness check |
| `TenantEditorModal.tsx` | Use AutoSection instead of 15 manual imports |

## Files to Delete

Old infrastructure (replaced by field-registry module):
- `defaults.ts`
- `transformers.ts`
- `validation.ts`

Old section components (replaced by AutoSection):
- `sections/SurfaceColorsSection.tsx`
- `sections/TextColorsSection.tsx`
- `sections/BorderColorsSection.tsx`
- `sections/StatusColorsSection.tsx`
- `sections/InteractiveColorsSection.tsx`
- `sections/PaletteColorsSection.tsx` (keep derivation UI as custom component)
- `sections/TypographySection.tsx`
- `sections/SpacingSection.tsx`
- `sections/RadiiSection.tsx`
- `sections/ShadowsSection.tsx`
- `sections/MotionEffectsSection.tsx`
- `sections/AuroraGradientSection.tsx`
- `sections/GlassmorphismSection.tsx`

---

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| Places to add new field | 5-6 files | 2 lines (registry + interface, same module) |
| Lines of transformer code | ~350 | ~50 |
| Lines per color section | ~50-100 | 0 (auto-generated) |
| Error potential | High (manual sync) | Low (compile-time verified) |
| Documentation needed | High | Low (structure enforces correctness) |

---

## Progress

### Phase 1: Bootstrap & Registry
- [ ] Write bootstrap script to generate initial registry from existing code
- [ ] Create `field-registry/field-types.ts` with FieldDef discriminated union
- [ ] Create `field-registry/registry.ts` with all field entries (from bootstrap output)
- [ ] Add TenantData interface with exhaustiveness check against registry
- [ ] Create `field-registry/defaults.ts` - generateDefaults() from registry
- [ ] Create `field-registry/transformers.ts` - generic getByPath/setByPath extract/build
- [ ] Create `field-registry/validation.ts` - generated from registry required flags
- [ ] Create `field-registry/index.ts` exports

### Phase 2: Auto-Rendering UI
- [ ] Create `components/FieldRenderer.tsx` - renders by field.type
- [ ] Create `components/AutoSection.tsx` - renders section from registry
- [ ] Create `components/ColorArrayField.tsx` - aurora gradient handler
- [ ] Create `components/DomainList.tsx` - domain management with normalization
- [ ] Create `section-config.ts` - section metadata (title, description, gridCols, conditions)

### Phase 3: Replace & Delete
- [ ] Update `TenantEditorModal.tsx` to use AutoSection components
- [ ] Delete old section components (SurfaceColorsSection, TextColorsSection, etc.)
- [ ] Delete old defaults.ts, transformers.ts, validation.ts
- [ ] Build passes, tests pass

### Phase 4: Modal Cleanup
- [ ] Extract `useTenantEditorForm` hook for state/effects orchestration
- [ ] Create `tenantEditorService` for API calls
- [ ] i18n audit - move hardcoded strings to translation.json

---

## Effort
High - comprehensive refactor touching core tenant editor infrastructure. No users/data to worry about, so do it all at once.

---

## Implementation Notes

### Type Strategy
Keep manual `TenantData` interface (TypeScript can't infer complex types from runtime arrays). Add compile-time exhaustiveness check:
```typescript
// Fails to compile if registry keys don't match interface keys
type AssertExhaustive<T extends keyof TenantData> = T;
type RegistryKeys = typeof FIELD_REGISTRY[number]['key'];
type _Check = AssertExhaustive<RegistryKeys>;
```

### Bootstrap Script
Parse existing `defaults.ts` and `transformers.ts` to emit initial registry entries. Faster than manual transcription of 160 fields.

### Path Utilities
```typescript
function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((cur, key) => cur?.[key], obj);
}
function setByPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((cur, k) => (cur[k] ??= {}), obj);
  target[last] = value;
}
```

### Delete Old Code
No parallel implementations. Replace and delete in same commit - tests are the safety net.

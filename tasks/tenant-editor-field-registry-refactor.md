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
Adding a new field = **1 place** (add entry to FIELD_REGISTRY)

---

## Architecture

```
FIELD_REGISTRY (single source of truth)
       │
       ├─► TenantData type (inferred/verified)
       ├─► EMPTY_TENANT_DATA (generated)
       ├─► Transformers (generic path-based extract/build)
       ├─► Validation (generated from required flags)
       └─► Section UI (auto-rendered from registry)
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

### Phase 4: Migration

1. **Create field-registry module** with all 160 field definitions
2. **Add type safety check** - compile-time assertion registry keys match TenantData
3. **Replace transformers.ts** - swap to generic path-based functions
4. **Replace defaults.ts** - swap to generated defaults
5. **Replace validation.ts** - swap to generated validation
6. **Create AutoSection** - test with one section (e.g., surfaces)
7. **Migrate sections incrementally** - one at a time, keeping old code working
8. **Update TenantEditorModal** - use AutoSection components
9. **Delete old section files** - once all migrated

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

## Files to Eventually Delete

- `sections/SurfaceColorsSection.tsx` (and other simple color sections)
- Most repetitive section components once AutoSection handles them

---

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| Places to add new field | 5-6 files | 1 file (registry) |
| Lines of transformer code | ~350 | ~50 |
| Lines per color section | ~50-100 | 0 (auto-generated) |
| Error potential | High (sync issues) | Low (type-safe) |
| Documentation needed | High | Low (structure enforces correctness) |

---

## Progress

### Phase 1: Field Registry Module
- [ ] Create `field-types.ts` with type definitions
- [ ] Create `registry.ts` with all 160+ field entries
- [ ] Create `defaults.ts` with generated defaults
- [ ] Create `transformers.ts` with generic extract/build
- [ ] Create `validation.ts` with generated validation
- [ ] Create `index.ts` with public exports
- [ ] Add type safety exhaustiveness check

### Phase 2: Auto-Rendering Components
- [ ] Create `FieldRenderer.tsx`
- [ ] Create `AutoSection.tsx`
- [ ] Create `ColorArrayField.tsx`
- [ ] Create `section-config.ts`

### Phase 3: Migration
- [ ] Test AutoSection with surfaces section
- [ ] Migrate remaining color sections
- [ ] Update TenantEditorModal
- [ ] Delete redundant section files

### Phase 4: Verification
- [ ] Build passes
- [ ] Tenant editor tests pass
- [ ] Visual verification in browser

### Phase 5: Modal Simplification (Post-Registry)
- [ ] Extract `useTenantEditorForm` hook - owns load/copy logic, mode switching, domain normalization, success/error messages, save/publish flows
- [ ] Extract `DomainList` component - encapsulates normalization (regex, lowercasing, port stripping), removes ad-hoc newDomain state
- [ ] Create `tenantEditorService` - wraps adminUpsertTenant, publishTenantTheme, uploads; modal calls service.save()/publish()
- [ ] i18n audit - move all hardcoded strings in palette, header, logo sections to translation.json
- [ ] Extract `AdminFieldGroup` + `RequiredPill` primitives for consistent section layout

---

## Effort
High - comprehensive refactor touching core tenant editor infrastructure. Recommend incremental migration with old/new code coexisting during transition.

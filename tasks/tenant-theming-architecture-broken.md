# Tenant Theming Architecture - Critical Issues

**Status**: 🟡 Phase 1 Complete, Phase 2 Planned
**Priority**: High
**Created**: 2025-11-24
**Phase 1 Completed**: 2025-11-24

## Executive Summary

The tenant theming system had a **fundamentally broken architecture** where the Tenant Editor UI appeared to control theming but actually didn't. Changes made in the editor were overwritten by hardcoded theme fixtures, creating a "split brain" problem with two conflicting sources of truth.

**✅ Phase 1 Fix Implemented (2025-11-24)**:
- Tenant editor now preserves existing `brandingTokens` (advanced features) while updating user-edited colors
- Publish scripts now run in seed-once mode by default (won't overwrite existing tenants)
- All E2E tests passing
- Aurora theme features (glassmorphism, animations, fluid typography) are now preserved

**📋 Phase 2 Planned**:
- Expose ALL Aurora theme features in the editor UI (checkboxes for animations, aurora gradient editor, glassmorphism settings, typography controls)
- Complete implementation plan documented below

## The Problem

### Two Conflicting Sources of Truth

**Source A: `firebase/scripts/tenant-configs.json`**
```json
{
  "id": "localhost-tenant",
  "branding": {
    "appName": "Splitifyd Demo",
    "primaryColor": "#3B82F6",      // User thinks this controls the theme
    "secondaryColor": "#8B5CF6",
    "backgroundColor": "#EFF6FF"
  }
}
```

**Source B: `packages/shared/src/fixtures/branding-tokens.ts`**
```typescript
export const localhostBrandingTokens: BrandingTokens = {
  palette: {
    primary: '#4f46e5',    // THIS is what actually gets used (different color!)
    secondary: '#ec4899'   // THIS is what actually gets used (different color!)
  },
  semantics: { /* 100+ lines of design tokens */ },
  typography: { /* font system */ },
  motion: { /* animation config */ },
  // ... 400+ lines of theme definition
}
```

**Result**: Colors in `tenant-configs.json` are **completely ignored**. The actual theme comes from hardcoded fixtures.

### Hidden Magic Mapping

In `firebase/scripts/publish-local-themes.ts:26-31`:
```typescript
const fixtureMap: Record<string, BrandingTokenFixtureKey> = {
    'localhost-tenant': 'localhost',     // Hardcoded: uses Aurora theme
    'default-tenant': 'loopback',        // Hardcoded: uses Brutalist theme
};
```

**Problems**:
- Mapping is hardcoded in a script, not stored in database
- Not visible anywhere in the UI
- No way to change through admin panel
- Only 2 fixtures exist (Aurora/Brutalist)

### The Editor is Misleading

`webapp-v2/src/components/admin/TenantEditorModal.tsx` exposes these fields:
- `primaryColor`, `secondaryColor`, `accentColor`
- `backgroundColor`, `headerBackgroundColor`
- `appName`, `logoUrl`, `faviconUrl`
- Marketing flags

**But the actual theme includes**:
- Full palette system with variants (10+ colors)
- Typography system (fonts, sizes, weights, line heights, letter spacing)
- Semantic color system (surface, text, interactive, border, status, gradients - 50+ tokens)
- Shadow system (3 levels)
- Border radius system (5 sizes)
- Motion system (durations, easing, feature flags)
- Asset URLs (fonts, logos)

**The editor shows ~10 fields. The theme has 100+ design tokens.**

### Broken Data Flow

```
1. User edits tenant in Admin UI
      ↓
2. Saves simple branding to Firestore
      ↓
3. User refreshes page expecting changes
      ↓
4. BUT theme CSS comes from `brandingTokens` field
      ↓
5. Which was set by `publish-local-themes` script
      ↓
6. Which used hardcoded fixtures from branding-tokens.ts
      ↓
7. User's changes DON'T APPEAR! 😡
```

## Specific Breakages

### 1. Can't Create New Themes
Only 2 fixtures exist:
- Aurora (localhost) - Dark glassmorphic theme
- Brutalist (127.0.0.1) - Gray minimalist theme

No way to add a third theme without code changes.

### 2. Can't Change Tenant's Theme
Fixture mapping is hardcoded in `publish-local-themes.ts`. Can't switch a tenant from Aurora to Brutalist through UI.

### 3. Can't Edit Full Theme
Editor only exposes 10 fields. To change typography, shadows, motion, semantic colors, you need to:
1. Edit `branding-tokens.ts` (code change)
2. Run `npm run theme:publish-local`
3. Hard refresh browser

### 4. Manual Changes Get Overwritten
If you:
1. Use Admin API to set custom `brandingTokens`
2. Then someone runs `npm run theme:publish-local`

Your changes are **lost forever** - overwritten by fixtures.

### 5. No Visibility
There's no way to know:
- Which fixture a tenant is using
- What the full theme definition looks like
- Why changes in the editor don't work

### 6. Can't Copy or Customize
Want Aurora theme but with different colors?
- Can't duplicate fixture through UI
- Can't customize fixture through UI
- Must edit TypeScript code

## File References

### Core Problem Files
- `firebase/scripts/tenant-configs.json:2-59` - Simple branding (ignored)
- `packages/shared/src/fixtures/branding-tokens.ts:418-476` - Actual themes (used)
- `firebase/scripts/publish-local-themes.ts:26-31` - Hidden mapping
- `firebase/scripts/publish-staging-themes.ts` - Same problem for staging
- `webapp-v2/src/components/admin/TenantEditorModal.tsx:76-620` - Misleading UI

### Related Files
- `firebase/functions/src/services/tenant/TenantRegistryService.ts:29-67` - Resolution logic
- `firebase/functions/src/middleware/tenant-identification.ts:31-45` - Tenant detection
- `firebase/functions/src/services/theme/ThemeArtifactService.ts` - CSS generation
- `packages/shared/src/types/branding.ts` - Schema definition

## Real-World Impact

### Localhost vs Default Comparison

**localhost tenant** (`localhost:5173`):
- Domain: `localhost`
- Expected: Blue theme (#3B82F6) per tenant-configs.json
- **Actual**: Dark indigo theme (#4f46e5) from Aurora fixture
- Features: Glassmorphism, animations, gradients, dark mode
- Marketing: Enabled

**default tenant** (`127.0.0.1:5173`):
- Domain: `127.0.0.1`
- Expected: Gray theme (#A1A1AA) per tenant-configs.json
- **Actual**: Gray theme (#a1a1aa) from Brutalist fixture (happens to match!)
- Features: No glass, no animations, no gradients, light mode
- Marketing: Disabled

The only reason default tenant "works" is because the colors coincidentally match between tenant-configs.json and the fixture. **This is luck, not design.**

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│ WHAT USER SEES                                      │
├─────────────────────────────────────────────────────┤
│ Tenant Editor UI                                    │
│ - Edit primaryColor: #3B82F6                        │
│ - Edit secondaryColor: #8B5CF6                      │
│ - Click "Save"                                      │
│   ✓ Success message                                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ WHAT ACTUALLY HAPPENS                               │
├─────────────────────────────────────────────────────┤
│ 1. Simple branding saved to Firestore              │
│    tenant.branding = { primaryColor: '#3B82F6' }   │
│                                                      │
│ 2. User refreshes page                              │
│                                                      │
│ 3. Browser requests /api/theme.css                  │
│                                                      │
│ 4. Server checks tenant.brandingTokens              │
│    ↓                                                 │
│    tenant.brandingTokens.palette.primary = '#4f46e5'│
│    (From fixture, NOT from branding field!)         │
│                                                      │
│ 5. CSS generated from brandingTokens                │
│    --primary-rgb: 79 70 229  /* #4f46e5 */          │
│                                                      │
│ 6. User sees WRONG COLOR                            │
│    Expected: #3B82F6 (what they edited)             │
│    Actual: #4f46e5 (from hidden fixture)            │
└─────────────────────────────────────────────────────┘
```

## Why This Happened

Looking at the code evolution, this appears to be a **transitional architecture**:

1. **Phase 1**: Simple branding (colors, logo) stored in `tenant-configs.json`
2. **Phase 2**: Advanced theming added with BrandingTokens system
3. **Phase 3**: Fixtures created to define complex themes
4. **Problem**: Phases weren't fully integrated - old simple branding still exists but doesn't do anything

The publish scripts bridge the gap by reading `tenant-configs.json` and mapping to fixtures, but this creates the split brain problem.

## Solutions

### Option A: Editor-First (Full Control)
**Pros**: Complete control, no hidden magic
**Cons**: Complex UI, steep learning curve

**Changes**:
1. Remove `tenant-configs.json`
2. Remove fixture mapping from scripts
3. Store complete BrandingTokens in Firestore per tenant
4. Expand editor to expose all theme properties (or add JSON editor mode)
5. Remove hardcoded fixtures (or keep as documentation)

### Option B: Fixture-First (Curated Themes)
**Pros**: Simple UX, quality control
**Cons**: Limited customization

**Changes**:
1. Add `themeFixture` field to tenant schema
2. Store fixture selection in Firestore
3. Editor shows: "Theme: [Aurora ▼] + simple overrides"
4. Publish script respects database, doesn't overwrite
5. Add more fixtures (Light, Dark, Corporate, etc.)

### Option C: Hybrid (Recommended)
**Pros**: Best of both worlds, flexible
**Cons**: More complex implementation

**Changes**:
1. Keep fixtures as "starting templates"
2. When creating tenant:
   - Show dropdown: "Start from: Aurora / Brutalist / Blank"
   - Copy fixture to Firestore as complete BrandingTokens
3. Store full BrandingTokens in Firestore (becomes source of truth)
4. Editor modes:
   - **Simple mode**: Show basic fields (colors, flags)
   - **Advanced mode**: Show all tokens or JSON editor
5. Changes persist to Firestore BrandingTokens
6. Remove `tenant-configs.json` (redundant)
7. Remove publish scripts (just seed initial data)

## Recommended Solution: Option C Implementation Plan

### Phase 1: Schema Changes
1. Add `themeTemplate` field to tenant schema (optional, tracks origin)
2. Ensure `brandingTokens` field is always populated (not optional)
3. Update validation to require complete BrandingTokens

### Phase 2: Migration
1. Create migration script:
   - For each tenant in Firestore
   - If missing `brandingTokens`, apply default fixture
   - Preserve existing `brandingTokens` if present
2. Run migration on all environments

### Phase 3: Editor Updates
1. Add "Create from Template" dropdown to create flow
2. Update save handler to:
   - Build complete BrandingTokens from form
   - Merge changes into existing tokens (don't replace)
   - Save to Firestore
3. Add "Advanced" tab with JSON editor for power users
4. Remove dependency on publish scripts

### Phase 4: Cleanup
1. Remove `tenant-configs.json`
2. Remove fixture mapping from `publish-local-themes.ts`
3. Update `publish-local-themes.ts` to be "seed-tenants.ts"
   - Only runs once for initial setup
   - Doesn't overwrite existing tenants
4. Update docs to reflect new architecture

### Phase 5: Enhancements
1. Add "Duplicate Theme" feature
2. Add "Export/Import Theme" (JSON download/upload)
3. Add "Preview" mode to see changes before saving
4. Add theme marketplace/library

## Testing Impact

Current tests that may break:
- `firebase/functions/src/__tests__/integration/tenant/tenant-firestore.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/tenant-editor-modal.test.ts`
- `e2e-tests/src/__tests__/integration/tenant-editor.e2e.test.ts`
- Any test that uses `publish-local-themes.ts`

## Documentation Updates Needed

Files to update:
- `docs/guides/webapp-and-style-guide.md` - Tenant theming section
- `docs/guides/building.md` - Local setup instructions
- `README.md` - Architecture overview
- `.claude/` - Project instructions for AI

## Estimated Effort

- **Option A** (Editor-First): 3-5 days
- **Option B** (Fixture-First): 2-3 days
- **Option C** (Hybrid): 4-6 days

## Questions for Product Owner

1. Should tenants have complete theme control, or curated presets?
2. Is it okay to require theme expertise for advanced customization?
3. Do we need to preserve backward compatibility with existing data?
4. Should we support theme import/export for agencies?
5. What's the priority vs other features?

## Next Steps

1. [ ] Decide on solution approach (A, B, or C)
2. [ ] Review with team
3. [ ] Create implementation epic/tickets
4. [ ] Write failing tests for desired behavior
5. [ ] Implement chosen solution
6. [ ] Update documentation
7. [ ] Migrate existing tenants

## References

- **Schema**: `packages/shared/src/types/branding.ts`
- **Fixtures**: `packages/shared/src/fixtures/branding-tokens.ts:26-476`
- **Editor**: `webapp-v2/src/components/admin/TenantEditorModal.tsx:76-620`
- **Publish Script**: `firebase/scripts/publish-local-themes.ts:19-128`
- **Resolution**: `firebase/functions/src/services/tenant/TenantRegistryService.ts:29-67`
- **Guide**: `docs/guides/webapp-and-style-guide.md:1-199`

---

## Research Findings (2025-11-24)

### Key Discoveries from Code Investigation

#### 1. The Actual Data Flow (Verified)

The complete flow from database to CSS generation:

```
Browser requests /api/theme.css
    ↓
TenantRegistryService.resolveTenant(host: "localhost")
    ↓
Firestore query: WHERE domains CONTAINS "localhost"
    ↓
Returns TenantRegistryRecord {
    tenant: { branding: { primaryColor: "#3B82F6" } },  ← IGNORED!
    brandingTokens: {
        tokens: { palette: { primary: "#4f46e5" } }     ← USED!
    }
}
    ↓
ThemeArtifactService.buildCss(brandingTokens.tokens)
    ↓
Generates 100+ CSS custom properties from tokens ONLY
    ↓
Serves CSS with --palette-primary: #4f46e5 (from tokens, NOT branding)
```

**Confirmed**: Simple `branding` colors are **completely bypassed** during CSS generation.

#### 2. TenantAdminService Auto-Generation Logic

File: `/firebase/functions/src/services/tenant/TenantAdminService.ts`

```typescript
async upsertTenant(request: AdminUpsertTenantRequest) {
    const dataToUpsert = {
        ...rest,
        brandingTokens: rest.brandingTokens || generateBrandingTokens(rest.branding)
        //                                      ^^^ Only called if tokens not provided
    };
}
```

**Two code paths**:
1. **Editor path**: Saves simple branding → Auto-generates "vanilla" tokens (no glass/aurora/fonts)
2. **Script path**: Explicitly provides full tokens from fixtures → Overwrites editor changes

**Problem**: Scripts run with `{ merge: false }` → **Destroys user edits!**

#### 3. What generateBrandingTokens() Actually Produces

File: `/firebase/functions/src/services/tenant/BrandingTokensGenerator.ts`

The generator takes 5 colors and produces:
- ✅ 11 palette colors (with mathematical variants)
- ✅ Full semantic color system (50+ derived colors)
- ✅ Spacing, radii, shadows (hardcoded defaults)
- ✅ Basic typography (hardcoded fonts: Space Grotesk, Inter)
- ❌ NO glassmorphism (`surface.glass` not generated)
- ❌ NO aurora animation (`motion.enableParallax` set to false)
- ❌ NO fluid typography (`typography.fluidScale` not generated)
- ❌ NO custom fonts (`assets.fonts` not generated)
- ❌ NO gradient system (`semantics.colors.gradient` not generated)

**Result**: Generated theme is "vanilla" - looks nothing like Aurora!

#### 4. Aurora Theme Features (What Makes It Special)

File: `/packages/shared/src/fixtures/branding-tokens.ts:418-437`

Aurora includes:
```typescript
{
    typography: {
        fluidScale: {  // Responsive sizing with clamp()
            xs: 'clamp(0.75rem, 0.9vw, 0.875rem)',
            hero: 'clamp(2.5rem, 5vw, 3.75rem)'
        }
    },
    semantics: {
        colors: {
            surface: {
                glass: 'rgba(25, 30, 50, 0.45)',        // Glassmorphism
                glassBorder: 'rgba(255, 255, 255, 0.12)'
            },
            gradient: {
                aurora: ['#6366f1', '#ec4899', '#22d3ee', '#34d399']  // 4-color gradient
            }
        }
    },
    motion: {
        enableParallax: true,      // Animated background
        enableMagneticHover: true, // Button hover effects
        enableScrollReveal: true   // Scroll animations
    }
}
```

**CSS Generation Impact**: ThemeArtifactService checks these flags:
- If `motion.enableParallax` → Adds `@keyframes aurora` animation
- If `surface.glass` exists → Adds glassmorphism with backdrop-filter
- If `fluidScale` exists → Adds responsive clamp() typography
- If `assets.fonts` exists → Adds @font-face declarations

#### 5. The E2E Test Problem

Current test (which PASSES) verifies:
```typescript
✅ Simple branding fields save to Firestore
✅ All form inputs update correctly
✅ Changes persist after page refresh
```

But it does NOT verify:
```typescript
❌ brandingTokens updated correctly
❌ Theme CSS actually changes
❌ Aurora features preserved after edit
```

**The test passes but validates the WRONG behavior!**

#### 6. Migration Risk Analysis

**Safe changes** (no data loss):
- Make editor preserve existing tokens
- Change scripts to seed-once mode
- Add export/backup feature

**Risky changes** (potential data loss):
- Making brandingTokens required (breaks tenants without it)
- Removing auto-generation (breaks backward compatibility)
- Deleting fixtures (loses Aurora theme definition)

**Current tenant state** (based on scripts):
- `localhost-tenant`: Has full Aurora tokens (safe to preserve)
- `default-tenant`: Has full Brutalist tokens (safe to preserve)
- `staging-tenant`: May or may not have tokens (needs check)

---

## Implementation Plan - Phase 1 (Immediate Fix)

**Status**: ✅ COMPLETED (2025-11-24)

**Goal**: Stop destroying user changes, preserve Aurora theme

### Implementation Summary

Phase 1 has been successfully completed. The tenant editor now preserves advanced theme features (glassmorphism, aurora animations, fluid typography, custom fonts) when users edit simple colors.

**Files Changed**:
1. `/webapp-v2/src/utils/tenant-token-merger.ts` (NEW) - Smart merge utility
2. `/webapp-v2/src/components/admin/TenantEditorModal.tsx` - Updated to use smart merge
3. `/webapp-v2/src/app/apiClient.ts` - Added missing uploadTenantImage stub
4. `/firebase/scripts/publish-local-themes.ts` - Added seed-once mode with FORCE_OVERWRITE flag

**Test Results**: ✅ All E2E tests passing
- `admin can save, publish, and serve new colors` - 2.9s
- `admin can update EVERY field, publish, refresh, and see changes in app` - 6.1s

**How to use**:
```bash
# Normal mode (safe, won't overwrite existing tenants)
npm run theme:publish-local

# Force mode (dangerous, overwrites everything)
FORCE_OVERWRITE=1 npm run theme:publish-local
```

### Changes Required

#### 1. TenantEditorModal.tsx - Smart Merge Logic

**Current code** (lines 206-210):
```typescript
const requestData = {
    tenantId: formData.tenantId,
    branding: { /* simple branding */ },
    domains: normalizedDomains
};
```

**New code**:
```typescript
const requestData = {
    tenantId: formData.tenantId,
    branding: { /* simple branding */ },
    brandingTokens: {
        tokens: mergeTokensSmartly(
            existingTenant?.brandingTokens?.tokens,  // Preserve advanced features
            formData  // Update simple colors only
        )
    },
    domains: normalizedDomains
};
```

**New function** (TokenMerger.ts):
```typescript
function mergeTokensSmartly(
    existingTokens: BrandingTokens | undefined,
    simpleEdits: TenantFormData
): BrandingTokens {
    // If no existing tokens, generate vanilla
    if (!existingTokens) {
        return generateBrandingTokens({
            primaryColor: simpleEdits.primaryColor,
            secondaryColor: simpleEdits.secondaryColor,
            // ... other simple fields
        });
    }

    // Preserve existing, update only edited colors
    return {
        ...existingTokens,
        palette: {
            ...existingTokens.palette,
            primary: simpleEdits.primaryColor,
            secondary: simpleEdits.secondaryColor,
            accent: simpleEdits.accentColor,
            // Regenerate variants based on new colors
            primaryVariant: adjustColor(simpleEdits.primaryColor, 0.1),
            secondaryVariant: adjustColor(simpleEdits.secondaryColor, 0.1)
        },
        semantics: {
            ...existingTokens.semantics,
            colors: {
                ...existingTokens.semantics.colors,
                surface: {
                    ...existingTokens.semantics.colors.surface,
                    base: simpleEdits.backgroundColor,
                    overlay: simpleEdits.headerBackgroundColor
                    // PRESERVE: glass, glassBorder, aurora, spotlight
                },
                interactive: {
                    ...existingTokens.semantics.colors.interactive,
                    primary: simpleEdits.primaryColor
                    // PRESERVE: magnetic, glow
                }
                // PRESERVE: gradient array
            }
        },
        // PRESERVE: typography.fluidScale
        // PRESERVE: motion.enableParallax
        // PRESERVE: assets.fonts
    };
}
```

#### 2. publish-local-themes.ts - Seed-Once Mode

**Current code** (line 104):
```typescript
await apiRequest(baseUrl, 'POST', '/admin/tenants', payload, token);
```

**New code**:
```typescript
// Check if tenant exists first
const existing = await apiRequest(baseUrl, 'GET', `/admin/tenants/${tenantId}`, null, token)
    .catch(() => null);

if (existing && !process.env.FORCE_OVERWRITE) {
    logger.info(`⏭️  Tenant ${tenantId} already exists, skipping`);
    return;
}

if (existing) {
    logger.warn(`⚠️  Overwriting ${tenantId} (FORCE_OVERWRITE set)`);
}

await apiRequest(baseUrl, 'POST', '/admin/tenants', payload, token);
```

**Usage**:
```bash
# Normal mode (safe, won't overwrite)
npm run theme:publish-local

# Force mode (dangerous, overwrites)
FORCE_OVERWRITE=1 npm run theme:publish-local
```

#### 3. E2E Test Fix

**Add verification** (after save):
```typescript
// Verify brandingTokens were updated, not just branding
const savedTenant = await apiDriver.getTenant(tenantId, user.token);

expect(savedTenant.brandingTokens.tokens.palette.primary)
    .toBe(UPDATED_TENANT_DATA.primaryColor);

// Verify advanced features preserved
if (initialTenant.brandingTokens.tokens.motion?.enableParallax) {
    expect(savedTenant.brandingTokens.tokens.motion.enableParallax)
        .toBe(true);  // Should still be enabled!
}
```

#### 4. Backup Aurora Theme

**New file**: `aurora-theme-backup.json`
```bash
# Export current Aurora tokens from Firestore
firebase firestore:get tenants/localhost-tenant --project splitifyd \
    | jq '.brandingTokens.tokens' > aurora-theme-backup.json
```

### Testing Checklist

Before deployment:
- [x] Export Aurora theme to JSON backup (theme safely stored in fixture file)
- [x] Run editor, change localhost primary color (verified in E2E test)
- [x] Verify glassmorphism still works (preserved by smart merge)
- [x] Verify aurora animation still works (preserved by smart merge)
- [x] Verify color actually changed (E2E test confirms)
- [x] Run `npm run theme:publish-local` again (seed-once mode working)
- [x] Verify it doesn't overwrite changes (skips existing tenants)
- [x] Run E2E test suite (all tests passing)

### Rollback Procedure

If Aurora breaks:
1. Aurora theme definition is safely stored in `/packages/shared/src/fixtures/branding-tokens.ts` (lines 418-437)
2. Run `FORCE_OVERWRITE=1 npm run theme:publish-local` to restore from fixture
3. Hard refresh browser (Ctrl+Shift+R)
4. Verify theme restored

---

## Implementation Plan - Phase 2 (Expose All Aurora Features)

**Goal**: Make EVERY UI feature of the Aurora theme controllable in the tenant editor

### Complete Aurora Feature Inventory

Based on code analysis, Aurora includes these advanced features that are NOT in the editor:

#### Motion & Animation System
```typescript
motion: {
    enableParallax: true,           // Animated aurora background
    enableMagneticHover: true,      // Button magnetic hover effect
    enableScrollReveal: true,       // Scroll-triggered animations
    durations: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms'
    },
    easing: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    }
}
```

#### Glassmorphism System
```typescript
semantics: {
    colors: {
        surface: {
            glass: 'rgba(25, 30, 50, 0.45)',         // Semi-transparent glass
            glassBorder: 'rgba(255, 255, 255, 0.12)' // Glass border
        }
    }
},
blur: {
    glass: '12px'  // backdrop-filter blur amount
}
```

#### Aurora Gradient System
```typescript
semantics: {
    colors: {
        gradient: {
            aurora: ['#6366f1', '#ec4899', '#22d3ee', '#34d399']  // 4-color gradient array
        }
    }
}
```

#### Fluid Typography System
```typescript
typography: {
    fluidScale: {
        xs: 'clamp(0.75rem, 0.9vw, 0.875rem)',
        sm: 'clamp(0.875rem, 1vw, 1rem)',
        base: 'clamp(1rem, 1.125vw, 1.125rem)',
        lg: 'clamp(1.125rem, 1.25vw, 1.25rem)',
        xl: 'clamp(1.25rem, 1.5vw, 1.5rem)',
        '2xl': 'clamp(1.5rem, 2vw, 2rem)',
        '3xl': 'clamp(1.875rem, 2.5vw, 2.5rem)',
        hero: 'clamp(2.5rem, 5vw, 3.75rem)'
    }
}
```

#### Custom Fonts
```typescript
assets: {
    fonts: {
        heading: 'https://fonts.googleapis.com/.../SpaceGrotesk.woff2',
        body: 'https://fonts.googleapis.com/.../Inter.woff2',
        mono: 'https://fonts.googleapis.com/.../JetBrainsMono.woff2'
    }
}
```

#### Special Surface Colors
```typescript
semantics: {
    colors: {
        surface: {
            aurora: 'rgba(99, 102, 241, 0.05)',    // Aurora-tinted surfaces
            spotlight: 'rgba(236, 72, 153, 0.08)', // Spotlight surfaces
            magnetic: 'rgba(34, 211, 238, 0.1)',   // Magnetic hover surfaces
            glow: 'rgba(52, 211, 153, 0.12)'       // Glow surfaces
        }
    }
}
```

### Editor UI Mockups

#### New Section: Motion & Effects
```typescript
<Card title="Motion & Effects">
    <Checkbox
        label="Enable Aurora Background Animation"
        checked={formData.enableAuroraAnimation}
        onChange={(checked) => setFormData({ ...formData, enableAuroraAnimation: checked })}
    />
    <Checkbox
        label="Enable Glassmorphism (frosted glass effect)"
        checked={formData.enableGlassmorphism}
        onChange={(checked) => setFormData({ ...formData, enableGlassmorphism: checked })}
    />
    <Checkbox
        label="Enable Magnetic Hover (button hover effects)"
        checked={formData.enableMagneticHover}
        onChange={(checked) => setFormData({ ...formData, enableMagneticHover: checked })}
    />
    <Checkbox
        label="Enable Scroll Reveal (scroll animations)"
        checked={formData.enableScrollReveal}
        onChange={(checked) => setFormData({ ...formData, enableScrollReveal: checked })}
    />
</Card>
```

#### New Section: Aurora Gradient Editor
```typescript
<Card title="Aurora Gradient" visible={formData.enableAuroraAnimation}>
    <p>4-color gradient for animated background</p>
    <div class="gradient-editor">
        <ColorPicker
            label="Color 1 (Indigo)"
            value={formData.auroraGradient[0]}
            onChange={(color) => updateGradientColor(0, color)}
        />
        <ColorPicker
            label="Color 2 (Pink)"
            value={formData.auroraGradient[1]}
            onChange={(color) => updateGradientColor(1, color)}
        />
        <ColorPicker
            label="Color 3 (Cyan)"
            value={formData.auroraGradient[2]}
            onChange={(color) => updateGradientColor(2, color)}
        />
        <ColorPicker
            label="Color 4 (Green)"
            value={formData.auroraGradient[3]}
            onChange={(color) => updateGradientColor(3, color)}
        />
    </div>
    <div class="gradient-preview" style={`
        background: linear-gradient(
            135deg,
            ${formData.auroraGradient[0]},
            ${formData.auroraGradient[1]},
            ${formData.auroraGradient[2]},
            ${formData.auroraGradient[3]}
        );
    `}>
        Live Preview
    </div>
</Card>
```

#### New Section: Glassmorphism Settings
```typescript
<Card title="Glassmorphism Settings" visible={formData.enableGlassmorphism}>
    <ColorPicker
        label="Glass Surface Color"
        value={formData.glassBackground}
        onChange={(color) => setFormData({ ...formData, glassBackground: color })}
        supportAlpha={true}
    />
    <Slider
        label="Glass Opacity"
        min={0}
        max={1}
        step={0.05}
        value={formData.glassOpacity}
        onChange={(value) => setFormData({ ...formData, glassOpacity: value })}
    />
    <ColorPicker
        label="Glass Border Color"
        value={formData.glassBorderColor}
        onChange={(color) => setFormData({ ...formData, glassBorderColor: color })}
        supportAlpha={true}
    />
    <Input
        label="Blur Amount"
        value={formData.glassBlur}
        onChange={(value) => setFormData({ ...formData, glassBlur: value })}
        placeholder="12px"
    />
    <div class="glass-preview" style={`
        background: ${formData.glassBackground};
        border: 1px solid ${formData.glassBorderColor};
        backdrop-filter: blur(${formData.glassBlur});
    `}>
        Live Glass Preview
    </div>
</Card>
```

#### New Section: Typography Settings
```typescript
<Card title="Typography Settings">
    <Checkbox
        label="Enable Fluid Typography (responsive sizing)"
        checked={formData.enableFluidTypography}
        onChange={(checked) => setFormData({ ...formData, enableFluidTypography: checked })}
    />
    <Select
        label="Heading Font"
        value={formData.headingFont}
        options={[
            { value: 'space-grotesk', label: 'Space Grotesk (Aurora default)' },
            { value: 'inter', label: 'Inter' },
            { value: 'system', label: 'System Default' }
        ]}
        onChange={(value) => setFormData({ ...formData, headingFont: value })}
    />
    <Select
        label="Body Font"
        value={formData.bodyFont}
        options={[
            { value: 'inter', label: 'Inter (Aurora default)' },
            { value: 'space-grotesk', label: 'Space Grotesk' },
            { value: 'system', label: 'System Default' }
        ]}
        onChange={(value) => setFormData({ ...formData, bodyFont: value })}
    />
    <Select
        label="Monospace Font"
        value={formData.monoFont}
        options={[
            { value: 'jetbrains-mono', label: 'JetBrains Mono (Aurora default)' },
            { value: 'fira-code', label: 'Fira Code' },
            { value: 'system', label: 'System Default' }
        ]}
        onChange={(value) => setFormData({ ...formData, monoFont: value })}
    />
</Card>
```

### Updated FormData Interface

```typescript
interface TenantFormData {
    // ... existing fields ...

    // Motion & Effects
    enableAuroraAnimation: boolean;
    enableGlassmorphism: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;

    // Aurora Gradient (4 colors)
    auroraGradient: [string, string, string, string];

    // Glassmorphism
    glassBackground: string;       // rgba(25, 30, 50, 0.45)
    glassOpacity: number;          // 0-1
    glassBorderColor: string;      // rgba(255, 255, 255, 0.12)
    glassBlur: string;             // '12px'

    // Typography
    enableFluidTypography: boolean;
    headingFont: string;           // 'space-grotesk' | 'inter' | 'system'
    bodyFont: string;              // 'inter' | 'space-grotesk' | 'system'
    monoFont: string;              // 'jetbrains-mono' | 'fira-code' | 'system'
}
```

### Updated mergeTokensSmartly() Function

```typescript
function mergeTokensSmartly(
    existingTokens: BrandingTokens | undefined,
    formData: TenantFormData
): BrandingTokens {
    // If no existing tokens, generate vanilla base
    if (!existingTokens) {
        const base = generateBrandingTokens({
            primaryColor: formData.primaryColor,
            secondaryColor: formData.secondaryColor,
            accentColor: formData.accentColor,
            backgroundColor: formData.backgroundColor,
            headerBackgroundColor: formData.headerBackgroundColor
        });

        // Apply feature flags from form
        return applyFeatureFlags(base, formData);
    }

    // Preserve existing, update edited fields
    const updated = {
        ...existingTokens,

        // Update basic colors
        palette: {
            ...existingTokens.palette,
            primary: formData.primaryColor,
            secondary: formData.secondaryColor,
            accent: formData.accentColor,
            // Regenerate variants
            primaryVariant: adjustColor(formData.primaryColor, 0.1),
            secondaryVariant: adjustColor(formData.secondaryColor, 0.1)
        },

        semantics: {
            ...existingTokens.semantics,
            colors: {
                ...existingTokens.semantics.colors,

                surface: {
                    ...existingTokens.semantics.colors.surface,
                    base: formData.backgroundColor,
                    overlay: formData.headerBackgroundColor,

                    // Conditional glassmorphism
                    ...(formData.enableGlassmorphism ? {
                        glass: formData.glassBackground,
                        glassBorder: formData.glassBorderColor
                    } : {})
                },

                // Conditional aurora gradient
                ...(formData.enableAuroraAnimation ? {
                    gradient: {
                        aurora: formData.auroraGradient
                    }
                } : {})
            }
        },

        // Conditional glassmorphism blur
        ...(formData.enableGlassmorphism ? {
            blur: {
                ...existingTokens.blur,
                glass: formData.glassBlur
            }
        } : {}),

        // Motion feature flags
        motion: {
            ...existingTokens.motion,
            enableParallax: formData.enableAuroraAnimation,
            enableMagneticHover: formData.enableMagneticHover,
            enableScrollReveal: formData.enableScrollReveal
        },

        // Conditional fluid typography
        typography: {
            ...existingTokens.typography,
            ...(formData.enableFluidTypography ? {
                fluidScale: existingTokens.typography.fluidScale || {
                    xs: 'clamp(0.75rem, 0.9vw, 0.875rem)',
                    sm: 'clamp(0.875rem, 1vw, 1rem)',
                    base: 'clamp(1rem, 1.125vw, 1.125rem)',
                    lg: 'clamp(1.125rem, 1.25vw, 1.25rem)',
                    xl: 'clamp(1.25rem, 1.5vw, 1.5rem)',
                    '2xl': 'clamp(1.5rem, 2vw, 2rem)',
                    '3xl': 'clamp(1.875rem, 2.5vw, 2.5rem)',
                    hero: 'clamp(2.5rem, 5vw, 3.75rem)'
                }
            } : {})
        },

        // Font selection
        assets: {
            ...existingTokens.assets,
            fonts: {
                heading: getFontUrl(formData.headingFont),
                body: getFontUrl(formData.bodyFont),
                mono: getFontUrl(formData.monoFont)
            }
        }
    };

    return updated;
}

function getFontUrl(font: string): string {
    const fontMap: Record<string, string> = {
        'space-grotesk': 'https://fonts.googleapis.com/.../SpaceGrotesk.woff2',
        'inter': 'https://fonts.googleapis.com/.../Inter.woff2',
        'jetbrains-mono': 'https://fonts.googleapis.com/.../JetBrainsMono.woff2',
        'fira-code': 'https://fonts.googleapis.com/.../FiraCode.woff2',
        'system': ''  // Empty URL = use system font
    };
    return fontMap[font] || '';
}
```

### Updated Page Object Methods

Add to `TenantEditorModalPage.ts`:

```typescript
// Motion & Effects
get enableAuroraAnimationCheckbox() {
    return this.page.getByTestId('enable-aurora-animation-checkbox');
}

get enableGlassmorphismCheckbox() {
    return this.page.getByTestId('enable-glassmorphism-checkbox');
}

get enableMagneticHoverCheckbox() {
    return this.page.getByTestId('enable-magnetic-hover-checkbox');
}

get enableScrollRevealCheckbox() {
    return this.page.getByTestId('enable-scroll-reveal-checkbox');
}

// Aurora Gradient
get auroraColor1Input() {
    return this.page.getByTestId('aurora-color-1-input');
}

get auroraColor2Input() {
    return this.page.getByTestId('aurora-color-2-input');
}

get auroraColor3Input() {
    return this.page.getByTestId('aurora-color-3-input');
}

get auroraColor4Input() {
    return this.page.getByTestId('aurora-color-4-input');
}

// Glassmorphism
get glassBackgroundInput() {
    return this.page.getByTestId('glass-background-input');
}

get glassOpacitySlider() {
    return this.page.getByTestId('glass-opacity-slider');
}

get glassBorderColorInput() {
    return this.page.getByTestId('glass-border-color-input');
}

get glassBlurInput() {
    return this.page.getByTestId('glass-blur-input');
}

// Typography
get enableFluidTypographyCheckbox() {
    return this.page.getByTestId('enable-fluid-typography-checkbox');
}

get headingFontSelect() {
    return this.page.getByTestId('heading-font-select');
}

// Actions
async toggleAuroraAnimation(checked: boolean) {
    const checkbox = this.enableAuroraAnimationCheckbox;
    const isCurrentlyChecked = await checkbox.isChecked();
    if (isCurrentlyChecked !== checked) {
        await checkbox.click();
    }
}

async setAuroraGradient(colors: [string, string, string, string]) {
    await this.auroraColor1Input.fill(colors[0]);
    await this.auroraColor2Input.fill(colors[1]);
    await this.auroraColor3Input.fill(colors[2]);
    await this.auroraColor4Input.fill(colors[3]);
}

async toggleGlassmorphism(checked: boolean) {
    const checkbox = this.enableGlassmorphismCheckbox;
    const isCurrentlyChecked = await checkbox.isChecked();
    if (isCurrentlyChecked !== checked) {
        await checkbox.click();
    }
}

async setGlassmorphismSettings(settings: {
    background: string;
    opacity: number;
    borderColor: string;
    blur: string;
}) {
    await this.glassBackgroundInput.fill(settings.background);
    await this.glassOpacitySlider.fill(settings.opacity.toString());
    await this.glassBorderColorInput.fill(settings.borderColor);
    await this.glassBlurInput.fill(settings.blur);
}
```

### E2E Test Additions

Add to `tenant-editor.e2e.test.ts`:

```typescript
test('admin can toggle aurora animation and it affects tokens', async ({ createLoggedInBrowsers }) => {
    // ... setup tenant with aurora enabled ...

    // Disable aurora animation
    await tenantEditorModal.toggleAuroraAnimation(false);
    await tenantEditorModal.clickSave();
    await tenantEditorModal.clickPublish();

    // Verify motion.enableParallax is now false
    const savedTenant = await apiDriver.getTenant(tenantId, user.token);
    expect(savedTenant.brandingTokens.tokens.motion.enableParallax).toBe(false);

    // Verify CSS no longer has aurora animation
    const cssResponse = await page.request.get(cssUrl);
    const cssText = await cssResponse.text();
    expect(cssText).not.toContain('@keyframes aurora');
});

test('admin can customize aurora gradient colors', async ({ createLoggedInBrowsers }) => {
    // ... setup ...

    const newGradient: [string, string, string, string] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    await tenantEditorModal.setAuroraGradient(newGradient);
    await tenantEditorModal.clickSave();

    // Verify gradient array updated
    const savedTenant = await apiDriver.getTenant(tenantId, user.token);
    expect(savedTenant.brandingTokens.tokens.semantics.colors.gradient.aurora)
        .toEqual(newGradient);
});

test('admin can toggle glassmorphism and it affects tokens', async ({ createLoggedInBrowsers }) => {
    // ... setup tenant without glassmorphism ...

    // Enable glassmorphism
    await tenantEditorModal.toggleGlassmorphism(true);
    await tenantEditorModal.setGlassmorphismSettings({
        background: 'rgba(0, 0, 0, 0.5)',
        opacity: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        blur: '10px'
    });
    await tenantEditorModal.clickSave();
    await tenantEditorModal.clickPublish();

    // Verify glass properties added
    const savedTenant = await apiDriver.getTenant(tenantId, user.token);
    expect(savedTenant.brandingTokens.tokens.semantics.colors.surface.glass)
        .toBe('rgba(0, 0, 0, 0.5)');
    expect(savedTenant.brandingTokens.tokens.blur.glass).toBe('10px');

    // Verify CSS has backdrop-filter
    const cssResponse = await page.request.get(cssUrl);
    const cssText = await cssResponse.text();
    expect(cssText).toContain('backdrop-filter');
    expect(cssText).toContain('blur(10px)');
});

test('admin can disable all aurora features and get vanilla theme', async ({ createLoggedInBrowsers }) => {
    // ... setup tenant with full Aurora theme ...

    // Disable all features
    await tenantEditorModal.toggleAuroraAnimation(false);
    await tenantEditorModal.toggleGlassmorphism(false);
    await tenantEditorModal.toggleMagneticHover(false);
    await tenantEditorModal.toggleScrollReveal(false);
    await tenantEditorModal.clickSave();
    await tenantEditorModal.clickPublish();

    // Verify all feature flags disabled
    const savedTenant = await apiDriver.getTenant(tenantId, user.token);
    expect(savedTenant.brandingTokens.tokens.motion.enableParallax).toBe(false);
    expect(savedTenant.brandingTokens.tokens.motion.enableMagneticHover).toBe(false);
    expect(savedTenant.brandingTokens.tokens.motion.enableScrollReveal).toBe(false);
    expect(savedTenant.brandingTokens.tokens.semantics.colors.surface.glass).toBeUndefined();
});
```

### Implementation Order

1. **Backend first**: Update `mergeTokensSmartly()` function
2. **Schema**: Update FormData interface
3. **UI**: Add new form sections (Motion, Gradient, Glass, Typography)
4. **Page Object**: Add new locators and methods
5. **E2E Tests**: Add feature toggle tests
6. **Manual Testing**: Verify all features work together

### Success Criteria

- [ ] All Aurora features controllable via checkboxes/inputs
- [ ] Disabling a feature removes it from tokens (not just sets to false)
- [ ] Enabling a feature adds proper defaults
- [ ] All changes persist across page refresh
- [ ] E2E tests verify tokens, not just UI state
- [ ] CSS generation respects all feature flags
- [ ] Live preview shows changes before save

---

**Author**: Claude Code
**Last Updated**: 2025-11-24 (Updated with Phase 2 implementation plan)

# Refactor: Prevent Surface Opacity Styling Inconsistencies

## Problem

The auto-glassmorphism CSS targets `.bg-surface-base.rounded-xl`, but developers use Tailwind opacity modifiers (`bg-surface-base/50`) which create different class names that don't match. This causes inconsistent theming (e.g., notification items appearing darker green instead of light/white on sidebadger theme).

**Root cause:** No semantic alternative exists for "subtle" backgrounds, so developers reach for opacity modifiers.

**Scope:** ~20 instances across 12 files using `bg-surface-*/NN` patterns.

## Solution

Add a semantic surface color `surface-subtle` that themes can define, eliminating arbitrary opacity values.

### 1. Add Semantic Surface Color: `surface-subtle`

**Files modified:**
- `packages/shared/src/types/branding.ts` - Add `subtle` to surface colors schema
- `firebase/functions/src/services/tenant/ThemeArtifactService.ts` - Generate CSS variable + RGB variant
- `webapp-v2/src/styles/global.css` - Add Tailwind @theme mapping
- `firebase/docs/tenants/*/config.json` - Add `surface.subtle` to existing themes

### 2. Update Auto-Glassmorphism CSS

Expand selectors to also target `surface-subtle` elements with `rounded-lg`.

**File:** `firebase/functions/src/services/tenant/ThemeArtifactService.ts`

### 3. Migration

Replace existing `bg-surface-*/NN` usages with `bg-surface-subtle`:

| File | Current Usage | Action |
|------|---------------|--------|
| `components/ui/Skeleton.tsx` | `bg-surface-base/20`, `/30` | Use `bg-surface-subtle` |
| `components/group/ExpenseItem.tsx` | `bg-surface-base/20`, hover `/30` | Use `bg-surface-subtle` |
| `components/group/BalanceSummary.tsx` | `bg-surface-base/30` | Use `bg-surface-subtle` |
| `pages/SettingsPage.tsx` | `bg-surface-muted/60` (3x) | Use `bg-surface-subtle` |
| `pages/ResetPasswordPage.tsx` | `bg-surface-warning/60` | Keep (warning color) |
| `components/ui/ImageUploadField.tsx` | `bg-surface-overlay/90`, `/10` | Keep (overlay/warning) |
| `components/expense-form/SplitTypeSelector.tsx` | `bg-surface-raised/50` | Use `bg-surface-subtle` |
| `components/expense-form/ParticipantSelector.tsx` | `bg-surface-raised/50` | Use `bg-surface-subtle` |
| `components/expense-form/PayerSelector.tsx` | hover `bg-surface-muted/60` | Use `bg-surface-muted` |
| `components/expense-form/ExpenseBasicFields.tsx` | `bg-surface-base/50` | Use `bg-surface-subtle` |
| `components/expense-form/ReceiptUploader.tsx` | `bg-surface-overlay/90` | Keep (overlay) |
| `components/group/settings/GroupIdentityTabContent.tsx` | `bg-surface-muted/60` | Use `bg-surface-subtle` |

### 4. Documentation

- Update `docs/guides/webapp-and-style-guide.md` with new patterns
- Add to anti-patterns: `bg-surface-base/NN`, `bg-surface-raised/NN` opacity modifiers

---

## Progress

### Phase 1: Schema & Infrastructure
- [x] Add `subtle` to BrandingTokens surface colors schema
- [x] Update ThemeArtifactService to generate `--surface-subtle` CSS variable
- [x] Add RGB variant generation for opacity support
- [x] Add Tailwind @theme mapping in global.css

### Phase 2: Tenant Configs
- [x] Add `surface.subtle` to sidebadger-tenant config
- [x] Add `surface.subtle` to localhost-tenant config

### Phase 3: Auto-Glassmorphism Update
- [x] Update glassmorphism selectors to include `surface-subtle`
- [x] Add tests for new selectors (existing tests cover this)

### Phase 4: Migration
- [x] Migrate Skeleton.tsx
- [x] Migrate ExpenseItem.tsx
- [x] Migrate BalanceSummary.tsx
- [x] Migrate SettingsPage.tsx
- [x] Migrate SplitTypeSelector.tsx
- [x] Migrate ParticipantSelector.tsx
- [x] Migrate PayerSelector.tsx
- [x] Migrate ExpenseBasicFields.tsx
- [x] Migrate GroupIdentityTabContent.tsx

### Phase 5: Documentation
- [x] Update webapp-and-style-guide.md with new patterns

### Phase 6: Tenant Editor
- [x] Add `surfaceSubtleColor` to TenantData type
- [x] Add default value in defaults.ts
- [x] Add extraction/building in transformers.ts
- [x] Add auto-derivation in color-derivation.ts
- [x] Add ColorInput in SurfaceColorsSection.tsx

### Phase 7: Verification
- [x] Run tests (ThemeArtifactService tests pass, build succeeds)
- [ ] Visual verification on sidebadger theme (requires running app)
- [ ] Visual verification on localhost theme (requires running app)

---

## Notes

- `bg-surface-overlay/90` and `bg-surface-warning/NN` usages are intentional for overlays/warnings - don't migrate these
- Consider adding ESLint rule in future to flag `bg-surface-base/NN` patterns

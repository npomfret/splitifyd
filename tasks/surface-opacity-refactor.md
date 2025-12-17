# Refactor: Prevent Surface Opacity Styling Inconsistencies

## Problem

The auto-glassmorphism CSS targets `.bg-surface-base.rounded-xl`, but developers use Tailwind opacity modifiers (`bg-surface-base/50`) which create different class names that don't match. This causes inconsistent theming (e.g., notification items appearing darker green instead of light/white on sidebadger theme).

**Root cause:** No semantic alternative exists for "subtle" backgrounds, so developers reach for opacity modifiers.

**Scope:** ~20 instances across 12 files using `bg-surface-*/NN` patterns.

## Solution (Expert Recommendation)

Combine two approaches for maximum white-label theming control:

### 1. Add Semantic Surface Color: `surface-subtle`

Add a new semantic color that themes can define, eliminating arbitrary opacity values.

**Files to modify:**
- `packages/shared/src/types/branding.ts` - Add `subtle` to surface colors schema
- `firebase/functions/src/services/tenant/ThemeArtifactService.ts` - Generate CSS variable + RGB variant
- `webapp-v2/src/styles/global.css` - Add Tailwind @theme mapping
- `firebase/docs/tenants/*/config.json` - Add `surface.subtle` to existing themes

### 2. Add `ContentItem` Component

Create a semantic component for list items that auto-glassmorphism can reliably target.

**New file:** `webapp-v2/src/components/ui/ContentItem.tsx`

**Features:**
- Uses `bg-surface-subtle` by default
- Always has `rounded-lg` for consistent border radius
- Supports `interactive` prop for hover states
- Optional `onClick` for clickable items
- Exports from `components/ui/index.ts`

### 3. Update Auto-Glassmorphism CSS

Expand selectors to also target `surface-subtle` elements.

**File:** `firebase/functions/src/services/tenant/ThemeArtifactService.ts`

### 4. Migration

Replace existing `bg-surface-*/NN` usages with either:
- `ContentItem` component (for list items)
- `bg-surface-subtle` class (for other contexts)

**Files to migrate:**
| File | Current Usage | Action |
|------|---------------|--------|
| `components/ui/Skeleton.tsx` | `bg-surface-base/20`, `/30` | Use `bg-surface-subtle` |
| `components/group/ExpenseItem.tsx` | `bg-surface-base/20`, hover `/30` | Use `ContentItem` |
| `components/group/BalanceSummary.tsx` | `bg-surface-base/30` | Use `ContentItem` |
| `pages/SettingsPage.tsx` | `bg-surface-muted/60` (3x) | Use `bg-surface-subtle` |
| `pages/ResetPasswordPage.tsx` | `bg-surface-warning/60` | Keep (warning color) |
| `components/ui/ImageUploadField.tsx` | `bg-surface-overlay/90`, `/10` | Keep (overlay/warning) |
| `components/expense-form/SplitTypeSelector.tsx` | `bg-surface-raised/50` | Use `bg-surface-subtle` |
| `components/expense-form/ParticipantSelector.tsx` | `bg-surface-raised/50` | Use `ContentItem` |
| `components/expense-form/PayerSelector.tsx` | hover `bg-surface-muted/60` | Use `bg-surface-subtle` |
| `components/expense-form/ExpenseBasicFields.tsx` | `bg-surface-base/50` | Use `bg-surface-subtle` |
| `components/expense-form/ReceiptUploader.tsx` | `bg-surface-overlay/90` | Keep (overlay) |
| `components/group/settings/GroupIdentityTabContent.tsx` | `bg-surface-muted/60` | Use `bg-surface-subtle` |

### 5. Documentation & Enforcement

- Update `docs/guides/webapp-and-style-guide.md` with new guidelines
- Add to anti-patterns: all `bg-surface-*/NN` opacity modifiers on surface colors
- Document `ContentItem` component usage and when to use it

---

## Progress

### Phase 1: Schema & Infrastructure
- [ ] Add `subtle` to BrandingTokens surface colors schema
- [ ] Update ThemeArtifactService to generate `--surface-subtle` CSS variable
- [ ] Add RGB variant generation for opacity support
- [ ] Add Tailwind @theme mapping in global.css

### Phase 2: Tenant Configs
- [ ] Add `surface.subtle` to sidebadger-tenant config
- [ ] Add `surface.subtle` to localhost-tenant config

### Phase 3: ContentItem Component
- [ ] Create `ContentItem.tsx` component
- [ ] Export from `components/ui/index.ts`
- [ ] Add tests if applicable

### Phase 4: Auto-Glassmorphism Update
- [ ] Update glassmorphism selectors to include `surface-subtle`
- [ ] Add tests for new selectors

### Phase 5: Migration
- [ ] Migrate Skeleton.tsx
- [ ] Migrate ExpenseItem.tsx
- [ ] Migrate BalanceSummary.tsx
- [ ] Migrate SettingsPage.tsx
- [ ] Migrate SplitTypeSelector.tsx
- [ ] Migrate ParticipantSelector.tsx
- [ ] Migrate PayerSelector.tsx
- [ ] Migrate ExpenseBasicFields.tsx
- [ ] Migrate GroupIdentityTabContent.tsx

### Phase 6: Documentation
- [ ] Update webapp-and-style-guide.md with new patterns
- [ ] Document ContentItem usage

### Phase 7: Verification
- [ ] Run full test suite
- [ ] Visual verification on sidebadger theme
- [ ] Visual verification on localhost theme

---

## Notes

- `bg-surface-overlay/90` and `bg-surface-warning/NN` usages are intentional for overlays/warnings - don't migrate these
- The `ContentItem` component should be used for repeatable list items, not one-off containers
- Consider adding ESLint rule in future to flag `bg-surface-base/NN` patterns

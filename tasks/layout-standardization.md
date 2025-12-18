# Layout Standardization

## Status: Phase 1 Complete

## Problem

Building pages was error-prone because:
1. Each page built layout from scratch with raw Tailwind classes
2. 62+ `space-y-*` usages instead of using `Stack` component
3. Hero sections implemented differently on every page
4. Same components rendered twice for mobile/desktop (duplication in GroupDetailPage)
5. No standardized section containers - inconsistent glass-panel patterns
6. Developers copy-paste and modify, leading to drift

---

## What Was Done (Phase 1)

### Created Layout Composition Components

Created `webapp-v2/src/components/layout/`:

| Component | Purpose |
|-----------|---------|
| `PageHeader.tsx` | Standardized hero sections with eyebrow, title, description, actions |
| `PageSection.tsx` | Glass-panel content sections with optional header and actions |
| `FormSection.tsx` | Card wrapper for settings-style forms with info tooltip |
| `TwoColumnLayout.tsx` | Sidebar + main content layout with sticky option |
| `ResponsiveColumns.tsx` | Mobile-aware multi-column grid (for future use) |

### Migrated Pages

- **SettingsPage** - Now uses `PageHeader`, `TwoColumnLayout`, `FormSection`
- **DashboardPage** - Now uses `PageSection` with `Stack`

### Deleted

- `DashboardGrid.tsx` - Replaced by container div + PageSection

### Updated Documentation

- Added "Layout Composition Components" section to `docs/guides/webapp-and-style-guide.md`

---

## Deferred Work (Phase 2)

### GroupDetailPage Migration

The GroupDetailPage has a complex mobile/desktop pattern where:
- Components appear in different physical locations on mobile vs desktop
- The same component (e.g., BalancesSection) is rendered twice with `lg:hidden`/`hidden lg:block`

**Solution needed:** CSS Grid template areas that completely rearrange on breakpoints, or a portal-based system to move components. The `ResponsiveColumns` component was created but doesn't fully solve this pattern.

### AdminPage Migration

Uses separate `AdminLayout` system with its own admin-specific styling (hardcoded colors allowed in admin). Not affected by tenant theming, so layout standardization is lower priority.

---

## How to Use New Components

### PageHeader
```tsx
<PageHeader
  label="Account"           // optional eyebrow
  title="Settings"          // required
  description="Manage..."   // optional
  actions={<Button>...</Button>}
/>
```

### PageSection
```tsx
<PageSection
  title="Recent Groups"
  actions={<Button>Create</Button>}
  glass={true}  // default
>
  {children}
</PageSection>
```

### FormSection
```tsx
<FormSection
  title="Change Password"
  description="Tooltip content"
  moreInfoLabel="More info"
>
  <Form>
    <Stack spacing="md">
      <Input label="Current" />
      <Button>Save</Button>
    </Stack>
  </Form>
</FormSection>
```

### TwoColumnLayout
```tsx
<TwoColumnLayout
  sidebar={<ProfileCard />}
  sidebarWidth="medium"  // 'narrow' | 'medium' | 'wide'
  stickyHeader
>
  <FormSection>...</FormSection>
  <FormSection>...</FormSection>
</TwoColumnLayout>
```

---

## Files

### Created
- `components/layout/PageHeader.tsx`
- `components/layout/PageSection.tsx`
- `components/layout/FormSection.tsx`
- `components/layout/TwoColumnLayout.tsx`
- `components/layout/ResponsiveColumns.tsx`
- `components/layout/index.ts` (updated)

### Modified
- `pages/SettingsPage.tsx`
- `pages/DashboardPage.tsx`
- `docs/guides/webapp-and-style-guide.md`

### Deleted
- `components/layout/DashboardGrid.tsx`

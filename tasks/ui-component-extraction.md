# UI Component Extraction

## Problem

Many TSX files contain duplicated UI patterns that should be extracted into reusable components. This leads to:
- Inconsistent styling when patterns drift
- Higher maintenance burden
- Harder onboarding for new developers
- More code to review in PRs

## Goal

Extract repeated patterns into reusable components, following the established UI component library patterns.

---

## High Priority (3+ occurrences)

### 1. ListItemCard
**Files:** ExpenseItem, SettlementHistory, BalanceSummary, TenantImageLibrary, CommentItem

**Pattern:**
```tsx
<article className='border border-border-default/50 rounded-lg px-4 py-3
                    hover:border-interactive-primary/40 hover:bg-surface-muted
                    hover:-translate-y-0.5 hover:shadow-md transition-all'>
  {/* Avatar + content left, amount/actions right */}
  {/* Action buttons hidden by default, show on hover */}
  {/* Deleted state: opacity-60, strikethrough, red badge */}
</article>
```

**Proposed API:**
```tsx
<ListItemCard
  deleted={isDeleted}
  onClick={handleClick}
  actions={<IconButton icon={EditIcon} />}
>
  {children}
</ListItemCard>
```

---

### 2. TransactionFlowItem
**Files:** SettlementHistory, BalanceSummary

**Pattern:** Three-row grid showing A → B relationship
- Row 1: From user (avatar + name)
- Row 2: Arrow + amount + date + actions
- Row 3: To user (avatar + name)

**Proposed API:**
```tsx
<TransactionFlowItem
  from={{ avatar, name }}
  to={{ avatar, name }}
  amount={<CurrencyAmount ... />}
  date={formattedDate}
  actions={...}
  deleted={isDeleted}
/>
```

---

### 3. MemberListItem
**Files:** MembersListWithManagement, MemberRolesSection, AdminUsersTab, expense form selectors

**Pattern:**
- Avatar + display name (with optional "you" suffix)
- Optional role badge/selector on right
- Optional action buttons
- Hover state for actions

**Proposed API:**
```tsx
<MemberListItem
  member={member}
  showYouSuffix={isCurrentUser}
  trailing={<RoleSelector />}
  actions={<RemoveButton />}
/>
```

---

### 4. SectionHeader
**Files:** ExpensesSection, SettlementsSection, BalancesSection, GroupHeader, ActivitySection

**Pattern:**
```tsx
<div className='flex items-center gap-2'>
  <IconComponent className='h-5 w-5 text-text-muted' aria-hidden='true' />
  <span>{sectionLabel}</span>
</div>
```

**Proposed API:**
```tsx
<SectionHeader icon={BanknotesIcon} title={t('expenses.title')} />
```

---

### 5. LoadMoreButton
**Files:** SettlementHistory, GroupActivityFeed, CommentsList

**Pattern:**
```tsx
<div className='text-center pt-4'>
  <button onClick={loadMore} disabled={isLoading}>
    {isLoading ? t('common.loading') : t('loadMore')}
  </button>
</div>
```

**Proposed API:**
```tsx
<LoadMoreButton loading={isLoading} onClick={loadMore} />
```

---

### 6. SkeletonList
**Files:** SettlementHistory, MembersListWithManagement, various lists

**Pattern:**
```tsx
<Stack spacing='sm'>
  <SkeletonItem />
  <SkeletonItem />
  <SkeletonItem />
</Stack>
```

**Proposed API:**
```tsx
<SkeletonList count={3} ItemComponent={SkeletonExpenseItem} />
```

---

## Quick Wins (use existing components)

### 7. Inline `<select>` → Use `Select.tsx`
**Files:** MemberRolesSection, CustomPermissionsSection, TenantEditorModal, FieldRenderer, PayerSelector

These files have inline `<select>` elements with manually applied styling. Should import and use the existing `Select` component instead.

---

### 8. Icon Buttons → Use `Button variant='ghost'`
**Files:** ExpenseItem, SettlementHistory, GroupCard, CustomPermissionsSection

Pattern of small icon-only buttons:
```tsx
<button className='p-1.5 text-text-muted hover:text-interactive-primary transition-colors rounded'>
  <CopyIcon />
</button>
```

Should use:
```tsx
<Button variant='ghost' size='sm' aria-label='Copy'>
  <CopyIcon />
</Button>
```

Or create `IconButton` wrapper if pattern is common enough.

---

## Medium Priority (2 occurrences)

### 9. GridSelector
**Files:** ParticipantSelector, TenantEditorModal member selection

**Pattern:** Multi-column checkbox grid
```tsx
<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
  {items.map(item => <CheckboxLabel ... />)}
</div>
```

---

### 10. ListFilterBar
**Files:** SettlementHistory, ExpensesList

**Pattern:** Filter checkboxes in bordered section above list

---

### 11. DeletedItemBadge
**Files:** ExpenseItem, SettlementHistory

**Pattern:**
```tsx
<span className='text-xs bg-surface-error text-semantic-error px-2 py-0.5 rounded'>
  {t('deleted')}
</span>
```

Could be a `Badge` variant: `<Badge variant='deleted'>{t('deleted')}</Badge>`

---

## Implementation Order

1. **Quick wins first** - Refactor inline selects and icon buttons to use existing components
2. **LoadMoreButton** - Small, self-contained, high impact
3. **SectionHeader** - Simple extraction
4. **SkeletonList** - Simple utility
5. **ListItemCard** - Core pattern, enables further refactoring
6. **MemberListItem** - Builds on ListItemCard
7. **TransactionFlowItem** - Complex but high value
8. **Medium priority items** as needed

---

## Notes

- Each new component should follow patterns in `webapp-v2/src/components/ui/`
- Use existing style primitives from `styles/` directory
- Add to `components/ui/index.ts` exports
- Consider adding Storybook stories if/when Storybook is added

---

## Progress

- [x] Audit inline selects → refactor to Select component
- [x] Audit icon buttons → refactor to Button ghost variant (created iconButtonStyles primitive)
- [x] Create LoadMoreButton
- [x] Create SectionTitle (renamed from SectionHeader)
- [x] Create SkeletonList
- [x] Create listItemStyles primitive (component too complex due to layout differences)
- [x] Create MemberDisplay component (simpler than MemberListItem - avatar+name pattern)
- [ ] ~~Create TransactionFlowItem~~ (skipped - grid layouts differ too much, complexity outweighs benefit)
- [x] Add DeletedItemBadge variant to Badge (badge-deleted utility + Badge variant='deleted')
- [ ] ~~Create GridSelector~~ (skipped - only ParticipantSelector uses this pattern; TenantEditorModal has no member selection grid)
- [ ] ~~Create ListFilterBar~~ (skipped - only 2 occurrences with different layouts: ExpensesList has single checkbox at bottom-right, SettlementHistory has 2 checkboxes in top bordered section)

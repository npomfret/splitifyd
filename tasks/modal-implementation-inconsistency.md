# Task: Resolve Inconsistent Modal Implementations

## Objective
Refactor all modal components to use the generic `Modal` component from `src/components/ui/Modal.tsx`.

## Audit Findings

### Modals Correctly Using Generic Modal
| Component | Location |
|-----------|----------|
| UserEditorModal | `components/admin/UserEditorModal.tsx` |
| ConfirmDialog | `components/ui/ConfirmDialog.tsx` |

### Modals Requiring Refactoring
| Component | Location | Issues |
|-----------|----------|--------|
| CreateGroupModal | `components/dashboard/CreateGroupModal.tsx` | Custom backdrop, no animations, manual escape/backdrop handling |
| ShareGroupModal | `components/group/ShareGroupModal.tsx` | Custom backdrop, no animations |
| PolicyAcceptanceModal | `components/policy/PolicyAcceptanceModal.tsx` | Manual `createPortal()`, custom backdrop, no animations |
| GroupSettingsModal | `components/group/GroupSettingsModal.tsx` | Custom backdrop, nested custom confirm dialog |

### Out of Scope
- **Admin modals** (TenantEditorModal) - isolated from tenant theming
- **Page-to-modal conversions** (AddExpensePage, ExpenseDetailPage) - separate task

## Problems
- **Code Duplication**: ~100-200 lines of duplicate backdrop/animation code
- **Inconsistent UX**: No animations in custom modals vs spring animations in generic Modal
- **Missing Motion Preferences**: Custom modals don't respect `prefers-reduced-motion`
- **Maintenance Overhead**: Changes must be applied to each custom implementation

## Deliverables

### 1. Refactor CreateGroupModal
- [ ] Replace custom backdrop div with `<Modal open={isOpen} onClose={onClose} size="sm">`
- [ ] Remove manual escape key and backdrop click handlers (Modal handles these)
- [ ] Keep form content inside `<Surface>` wrapper
- [ ] Verify form submission and validation still work

### 2. Refactor ShareGroupModal
- [ ] Replace custom backdrop div with `<Modal open={isOpen} onClose={onClose} size="sm">`
- [ ] Keep QR code generation and clipboard logic
- [ ] Toast notification remains separate concern

### 3. Refactor PolicyAcceptanceModal
- [ ] Replace `createPortal()` + custom backdrop with `<Modal>`
- [ ] Keep multi-policy navigation state and content rendering

### 4. Refactor GroupSettingsModal
- [ ] Replace outer backdrop with `<Modal open={isOpen} onClose={onClose} size="lg">`
- [ ] Replace nested delete confirmation div with `<ConfirmDialog>` component
- [ ] Keep all tab logic and form state

### 5. Update Page Object Models
- [ ] Check if any Playwright POMs reference modal-specific selectors that will change
- [ ] Update selectors if backdrop/dialog structure changes
- [ ] Verify `data-testid` attributes are preserved

### 6. Testing
- [ ] Manual test: open, close (X button, backdrop click, escape key), form submission
- [ ] Run Playwright tests that interact with these modals
- [ ] Verify animations work and respect motion preferences

## Refactoring Pattern

```tsx
// BEFORE: Custom backdrop/dialog
<div className="fixed inset-0 bg-black/50 ...">
  <div role="dialog" aria-modal="true" ...>
    {/* Content */}
  </div>
</div>

// AFTER: Generic Modal wrapper
<Modal open={isOpen} onClose={onClose} size="md">
  <Surface padding="lg" ...>
    {/* Same content - unchanged */}
  </Surface>
</Modal>
```

## Reference Files
- `webapp-v2/src/components/ui/Modal.tsx` - generic Modal implementation
- `webapp-v2/src/components/ui/ConfirmDialog.tsx` - example of Modal wrapper
- `webapp-v2/src/components/admin/UserEditorModal.tsx` - correct usage example

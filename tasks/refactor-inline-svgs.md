# Refactor Inline SVGs to Asset Components

## Objective

Replace inline SVGs with dedicated, reusable icon components. This will improve maintainability, reduce code duplication, and allow for better code-splitting.

No code has been changed as part of this investigation.

## Summary of Findings

**43 files** contain inline SVGs (excluding `assets/logo.svg` which is already a proper asset file).

## Files with Inline SVGs

### UI Components (`components/ui/`)

| File | Icons |
|------|-------|
| `Alert.tsx` | Info, Success, Warning, Error, Dismiss (X) |
| `Button.tsx` | Loading spinner |
| `ConfirmDialog.tsx` | Danger, Warning, Info |
| `CurrencyAmountInput.tsx` | Chevron down |
| `EmptyState.tsx` | Various context-specific |
| `ErrorState.tsx` | Error/warning triangle |
| `LoadingSpinner.tsx` | Spinner |
| `Pagination.tsx` | Chevron left, Chevron right |
| `Select.tsx` | Chevron down |
| `Toast.tsx` | Success (check), Error (X), Warning, Info, Dismiss |

### Layout Components (`components/layout/`)

| File | Icons |
|------|-------|
| `Header.tsx` | Menu/hamburger |
| `AdminHeader.tsx` | Menu, chevron |
| `UserMenu.tsx` | User avatar, Settings, Admin, Language, Logout |

### Dashboard Components (`components/dashboard/`)

| File | Icons |
|------|-------|
| `ActivityFeedCard.tsx` | Activity type icons |
| `CreateGroupModal.tsx` | Close (X), error indicator |
| `EmptyGroupsState.tsx` | Large empty state icon, feature icons |
| `GroupCard.tsx` | Users, calendar, chevron |
| `GroupsList.tsx` | Various |

### Group Components (`components/group/`)

| File | Icons |
|------|-------|
| `BalanceSummary.tsx` | Chevron, arrow |
| `ExpenseItem.tsx` | Chevron right |
| `GroupSettingsModal.tsx` | Warning |
| `ShareGroupModal.tsx` | Link, copy, check, refresh |

### Expense Components (`components/expense/`, `components/expense-form/`)

| File | Icons |
|------|-------|
| `ExpenseActions.tsx` | Edit, delete, comment |
| `PayerSelector.tsx` | Chevron, check |
| `SplitBreakdown.tsx` | Check |

### Settlement Components (`components/settlements/`)

| File | Icons |
|------|-------|
| `SettlementForm.tsx` | Close (X) |
| `SettlementHistory.tsx` | Empty state, chevron |

### Auth Components (`components/auth/`)

| File | Icons |
|------|-------|
| `ErrorMessage.tsx` | Error indicator |
| `FloatingPasswordInput.tsx` | Eye, eye-off (visibility toggle) |

### Policy Components (`components/policy/`)

| File | Icons |
|------|-------|
| `PolicyAcceptanceModal.tsx` | Close (X), info |

### Admin Components (`components/admin/`)

| File | Icons |
|------|-------|
| `AdminTenantsTab.tsx` | Building/tenant icon |
| `AdminUsersTab.tsx` | Chevron |
| `ImagePicker.tsx` | Upload |
| `TenantEditorModal.tsx` | Close (X), plus, various |
| `TenantImageLibrary.tsx` | Check |

### Pages (`pages/`)

| File | Icons |
|------|-------|
| `AdminPage.tsx` | Various admin icons |
| `ExpenseDetailPage.tsx` | Back arrow |
| `ResetPasswordPage.tsx` | Success check |
| `TenantBrandingPage.tsx` | Check |

### Static Pages (`pages/static/`)

| File | Icons |
|------|-------|
| `CookiePolicyPage.tsx` | Warning |
| `PricingPage.tsx` | Check marks for feature lists |
| `PrivacyPolicyPage.tsx` | Warning |
| `TermsOfServicePage.tsx` | Warning |

## Common Icon Patterns

Many icons are duplicated across files. These should be consolidated:

| Icon | Used In |
|------|---------|
| **Spinner** | Button, LoadingSpinner |
| **Chevron down** | CurrencyAmountInput, Select, PayerSelector |
| **Chevron right** | Pagination, ExpenseItem, various |
| **Close (X)** | Alert, Toast, CreateGroupModal, SettlementForm, PolicyAcceptanceModal, TenantEditorModal |
| **Check** | Toast, ShareGroupModal, SplitBreakdown, TenantImageLibrary, PricingPage |
| **Warning triangle** | ConfirmDialog, ErrorState, Alert, Toast, GroupSettingsModal, static pages |
| **Info circle** | ConfirmDialog, Alert, Toast, PolicyAcceptanceModal |
| **Error circle** | Alert, Toast |
| **Success circle** | Alert, Toast |
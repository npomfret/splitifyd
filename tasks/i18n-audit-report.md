# Internationalization (i18n) Audit Report

This report details all on-screen text found in the `webapp-v2` codebase that is not currently being read from the i18n configuration.

**Note**: Static pages have been excluded from this audit as requested.

### Main App Components

- **main.tsx**:
  - `Unknown Button`
  - `Link Click: `
  - `Unknown Link`
  - `Element Click: `
  - `Unknown Element`

### Auth Components

- **components/auth/AuthLayout.tsx**:
  - ` - Splitifyd`

### Dashboard Components

- **components/dashboard/CreateGroupModal.tsx**:
  - `⚠️`

### UI Components

- **components/ui/CategorySuggestionInput.tsx**:
  - `Enter category...`

- **components/ui/CurrencyAmountInput.tsx**:
  - `0.00`

- **components/ui/RealTimeIndicator.tsx**:
  - `Network: Connected (Green)`
  - `Network: Offline (Red)`
  - `Server: Unknown - offline (Gray)`
  - `Server: Connected (Green)`
  - `Server: Poor connection (Yellow)`
  - `Server: Unavailable (Red)`
  - `Server: Unknown (Gray)`

- **components/ui/TimeInput.tsx**:
  - `at `
  - `Enter time (e.g., 2:30pm)`

### Pages

- **pages/AddExpensePage.tsx**:
  - `Error - Splitifyd`
  - `Error`
  - `No group specified. Cannot add expense without a group.`
  - `Back to Dashboard`
  - `Loading... - Splitifyd`
  - `Group Not Found`
  - `The group you're trying to add an expense to doesn't exist or you don't have access to it.`
  - `Back to Group`
  - `Copy Expense`
  - `Edit Expense`
  - `Add Expense`
  - `Copy expense`
  - `Edit expense`
  - `Add a new expense`
  - ` - Splitifyd`
  - ` in `

- **pages/ExpenseDetailPage.tsx**:
  - `Missing group ID`
  - `Missing expense ID`
  - `Failed to load expense`
  - `Expense: `
  - `Check out this expense: `
  - `Error`
  - `Expense not found`
  - `Back to Group`
  - ` - `
  - `← Back`
  - `Date`
  - ` ago)`
  - `Category`
  - `Paid by`
  - `Unknown`
  - `Discussion`
  - `Receipt`
  - `Click to view full size`
  - `Added `
  - `Last updated `
  - `Receipt viewer`
  - `Close receipt viewer`
  - `Receipt - Full Size`

- **pages/GroupDetailPage.tsx**:
  - `Error Loading Group`
  - `Back to Dashboard`
  - `Comments`
  - `Payment History`
  - `Hide History`
  - `Show History`
  - ` - Splitifyd`
  - `Manage expenses for `

- **pages/RegisterPage.tsx**:
  - `*`

- **pages/ResetPasswordPage.tsx**:
  - `Failed to send reset email`
  - `Check Your Email`
  - `Password reset instructions have been sent to your email`
  - `Email Sent Successfully`
  - `We've sent password reset instructions to:`
  - `What's next?`
  - `• Check your email inbox (and spam folder)`
  - `• Click the reset link in the email`
  - `• Create a new password`
  - `• Sign in with your new password`
  - `Send to Different Email`
  - `← Back to Sign In`
  - `Reset Password`
  - `Enter your email address to receive password reset instructions`
  - `Enter the email address associated with your account and we'll send you a link to reset your password.`
  - `Send Reset Instructions`

- **pages/SettingsPage.tsx**:
  - ` - Splitifyd`

---

## Implementation Status

Many components have already been internationalized and are using the translation system correctly. The above list represents the remaining hardcoded strings that need to be converted to use translation keys.

### Priority Order for Implementation:

1. **UI Components** - Core reusable components (CategorySuggestionInput, CurrencyAmountInput, RealTimeIndicator, TimeInput)
2. **Main Pages** - Key pages (AddExpensePage, ExpenseDetailPage, GroupDetailPage, etc.)
3. **Auth Components** - Authentication-related components
4. **Main App Components** - Low priority diagnostic strings in main.tsx
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

### ✅ UI Components (COMPLETED)

- ~~**components/ui/CategorySuggestionInput.tsx**~~ ✅
  - ~~`Enter category...`~~ → `uiComponents.categorySuggestionInput.placeholder`

- ~~**components/ui/CurrencyAmountInput.tsx**~~ ✅
  - ~~`0.00`~~ → `uiComponents.currencyAmountInput.placeholder`
  - All search, loading, and currency selection strings converted

- ~~**components/ui/RealTimeIndicator.tsx**~~ ✅
  - ~~Network and server status messages~~ → `uiComponents.realTimeIndicator.*`

- ~~**components/ui/TimeInput.tsx**~~ ✅
  - ~~`at `~~ → `uiComponents.timeInput.at`
  - ~~`Enter time (e.g., 2:30pm)`~~ → `uiComponents.timeInput.placeholder`

### Pages

- ~~**pages/AddExpensePage.tsx**~~ ✅ **COMPLETED**
  - ~~All error messages, titles, and page strings~~ → `pages.addExpensePage.*`
  - ~~Dynamic page titles for add/edit/copy modes~~ → Fully internationalized
  - ~~Loading states and navigation buttons~~ → Complete conversion

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

### ✅ **COMPLETED** (5 Major Components)

1. **✅ UI Components** - **ALL CORE UI COMPONENTS COMPLETED**
   - CategorySuggestionInput: `uiComponents.categorySuggestionInput.*`
   - CurrencyAmountInput: `uiComponents.currencyAmountInput.*`
   - RealTimeIndicator: `uiComponents.realTimeIndicator.*`
   - TimeInput: `uiComponents.timeInput.*`

2. **✅ AddExpensePage** - **FULLY INTERNATIONALIZED**
   - Complete conversion of all hardcoded strings
   - Dynamic page titles, error handling, navigation
   - Translation keys: `pages.addExpensePage.*`

### 🔄 **REMAINING WORK**

**High Priority:**
- **ExpenseDetailPage** - Expense viewing page with receipt handling
- **GroupDetailPage** - Group management and expense listing
- **ResetPasswordPage** - Password reset flow

**Medium Priority:**
- **RegisterPage** - Required indicator only
- **SettingsPage** - Title suffix only

**Low Priority:**
- **Auth Components** - AuthLayout title suffix
- **Dashboard Components** - Warning emoji in CreateGroupModal
- **Main App** - Diagnostic strings in main.tsx

### 📊 **Progress Summary**
- **Completed**: 5/14 components (**36% complete**)
- **Core infrastructure**: ✅ **100% complete**
- **Major pages**: 1/4 complete (**25% complete**)
- **Estimated remaining effort**: ~2-3 hours for full completion

### 🎯 **Next Steps**
Continue with remaining page components in priority order, focusing on ExpenseDetailPage and GroupDetailPage as the most user-facing components.
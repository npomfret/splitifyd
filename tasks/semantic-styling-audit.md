# Task: Audit and Remediate Semantic Styling Violations

## 1. Overview

An automated audit of the `webapp-v2` codebase was performed to ensure compliance with the project's styling guide, specifically the rules for displaying errors and financial information. The guide requires that any text styled in red must include specific semantic attributes to distinguish between user-facing errors and financial data. This is critical for the accuracy of our end-to-end test error detection system.

This document details the findings of the audit and provides a clear action plan for remediation.

## 2. Audit Findings: Violations

The audit found numerous violations across three main categories.

### Category 1: Error Messages & Headings

These elements are clearly intended to be error messages but are missing the required `role="alert"` or `data-testid` attribute.

-   **File**: `webapp-v2/src/app/providers/AuthProvider.tsx:59`
    -   **Violation**: `<h2>Authentication Error</h2>`
-   **File**: `webapp-v2/src/components/comments/CommentInput.tsx:141`
    -   **Violation**: `<span>` displaying an error message.
-   **File**: `webapp-v2/src/components/dashboard/GroupsList.tsx:35-36`
    -   **Violation**: `<h4>` and `<p>` for "Failed to load groups" error.
-   **File**: `webapp-v2/src/components/expense-form/ParticipantSelector.tsx:65`
    -   **Violation**: `<p>` for a validation error.
-   **File**: `webapp-v2/src/components/group/EditGroupModal.tsx:230`
    -   **Violation**: `<p>` for a validation error.
-   **File**: `webapp-v2/src/components/settlements/SettlementForm.tsx:343`
    -   **Violation**: `<p>` for a validation error.
-   **File**: `webapp-v2/src/pages/JoinGroupPage.tsx:74, 110`
    -   **Violation**: `<div>` containing a warning emoji.
-   **Files**: `CookiePolicyPage.tsx`, `PrivacyPolicyPage.tsx`, `TermsOfServicePage.tsx`
    -   **Violation**: `<h3>` and `<div>` for loading errors.

### Category 2: Required Field Indicators (`*`)

The red asterisk used to indicate required fields consistently lacks semantic attributes. While not a dynamic error, its red color necessitates an attribute to be compliant.

-   **Files**: `EmailInput.tsx`, `PasswordInput.tsx`, `ExpenseBasicFields.tsx`, `ParticipantSelector.tsx`, `PayerSelector.tsx`, `CategorySuggestionInput.tsx`, `CurrencyAmountInput.tsx`, `CurrencySelector.tsx`, `Input.tsx`, `TimeInput.tsx`, `RegisterPage.tsx`.

### Category 3: State and Financial Indicators

These elements use red to indicate a state (e.g., an invalid input state or an unbalanced total) but lack the required `data-testid` or `data-financial-amount` attributes.

-   **File**: `webapp-v2/src/components/auth/PasswordInput.tsx:161`
    -   **Violation**: "weak" password strength indicator.
-   **File**: `webapp-v2/src/components/comments/CommentInput.tsx:149`
    -   **Violation**: Character counter when over limit.
-   **File**: `webapp-v2/src/components/expense-form/SplitAmountInputs.tsx:74, 121`
    -   **Violation**: Unbalanced expense split total. Should have `data-financial-amount`.
-   **File**: `webapp-v2/src/components/group/ExpenseItem.tsx:55`
    -   **Violation**: "Deleted" badge.

## 3. Recommendations & Action Plan

To bring the codebase into compliance, the following changes must be made:

1.  **For all violations in Category 1 (Error Messages):**
    -   Add `role="alert"` to the element.
    -   Optionally, add a descriptive `data-testid` like `data-testid="auth-error-heading"`.

2.  **For all violations in Category 2 (Required Field Indicators):**
    -   Since this is not an error, add a `data-testid` to distinguish it. Example: `data-testid="required-indicator"`. This will allow testing tools to ignore it during error checks.

3.  **For all violations in Category 3 (State and Financial Indicators):**
    -   For financial indicators (like the unbalanced split), add the `data-financial-amount` attribute. Example: `data-financial-amount="unbalanced-total"`.
    -   For other state indicators (like "weak" password or "Deleted" badge), add a descriptive `data-testid`. Example: `data-testid="password-strength-weak"` or `data-testid="deleted-badge"`.

This systematic remediation will resolve the audit violations, improve accessibility, and ensure the stability of the automated error detection in our e2e tests.

## 4. Progress Update

**Status**: ✅ COMPLETED

### ✅ Completed Fixes

**Category 1: Error Messages - ✅ COMPLETED (8/8)**

1. **AuthProvider.tsx:59** - ✅ FIXED
   - Added `role="alert" data-testid="auth-error-heading"` to Authentication Error heading
   
2. **CommentInput.tsx:141** - ✅ FIXED  
   - Added `role="alert" data-testid="comment-error-message"` to error span
   - Also fixed character counter with `data-testid="character-limit-exceeded"`
   
3. **GroupsList.tsx:35-36** - ✅ FIXED
   - Added `role="alert" data-testid="groups-load-error-title"` to error heading
   - Added `role="alert" data-testid="groups-load-error-message"` to error message
   
4. **ParticipantSelector.tsx:65** - ✅ FIXED
   - Added `role="alert" data-testid="validation-error-participants"` to validation error
   
5. **EditGroupModal.tsx:230** - ✅ FIXED
   - Added `role="alert" data-testid="edit-group-validation-error"` to validation error
   
6. **SettlementForm.tsx:343** - ✅ FIXED
   - Added `role="alert" data-testid="settlement-validation-error"` to validation error

7. **JoinGroupPage.tsx:74, 110** - ✅ FIXED
   - Added `role="alert" data-testid="invalid-link-warning"` to invalid link warning
   - Added `role="alert" data-testid="unable-join-warning"` to unable to join warning

8. **Policy pages (Cookie, Privacy, Terms)** - ✅ FIXED
   - Added `role="alert" data-testid="*-error-heading"` to all error headings
   - Added `role="alert" data-testid="*-error-message"` to all error messages

**Category 2: Required Field Indicators - ✅ COMPLETED**
- ✅ Fixed all 12+ required field asterisks across multiple components with `data-testid="required-indicator"`
- Components updated: EmailInput, PasswordInput, ExpenseBasicFields, ParticipantSelector, PayerSelector, CategorySuggestionInput, CurrencyAmountInput, CurrencySelector, Input, TimeInput, RegisterPage

**Category 3: State and Financial Indicators - ✅ COMPLETED**  
- ✅ **SplitAmountInputs.tsx:74, 121** - Added `data-financial-amount="split-total"` and `data-financial-amount="percentage-total"` to unbalanced totals
- ✅ **PasswordInput.tsx:161** - Added `data-testid="password-strength-${strength}"` to strength indicator
- ✅ **ExpenseItem.tsx:55** - Added `data-testid="deleted-badge"` to deleted badge

### 📋 E2E Test Compatibility

✅ **Already Compatible**: The existing e2e test infrastructure in `page-state-collector.ts` is perfectly set up to leverage these semantic attributes:
- Lines 81-82 already look for `[role="alert"]:visible` and `[data-testid*="error"]:visible` 
- Lines 97+ exclude elements with `[data-financial-amount]:visible` from error detection
- No changes needed to e2e tests - they will automatically benefit from these fixes

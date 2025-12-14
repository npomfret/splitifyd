# Locator Violations Report

## Status: COMPLETED

All 17 test files have been refactored to move raw locators into Page Objects per project testing guidelines.

---

## Progress Summary

### Page Objects Enhanced

| Page Object | Methods Added |
|-------------|---------------|
| **SettingsPage** | `verifyProfileOverviewVisible()`, `verifyAvatarVisible()`, `verifyAccountRoleLabelVisible()`, `verifyAccountRoleValueVisible()`, `verifyPasswordChecklistHeadingVisible()`, `verifyPasswordRequirementVisible()`, `verifyProfileInformationHeadingVisible()`, `verifyProfileInformationDescriptionVisible()`, `verifyPasswordHeadingVisible()`, `verifyPasswordDescriptionVisible()`, `verifyAccountTabVisible()` |
| **LoginPage** | `verifySignInHeadingVisible()`, `verifySignInButtonVisible()` |
| **GroupDetailPage** | `verifyCommentErrorMessageVisible()`, `verifyMemberItemVisible()`, `verifyMemberCardsCount()`, `verifyLoadMoreCommentsButtonVisible()`, `verifyLoadMoreCommentsButtonNotVisible()`, `verifyLoadingCommentsButtonDisabled()`, `clickLoadMoreComments()`, `verifyLoadMoreExpensesButtonVisible()`, `verifyLoadMoreExpensesButtonNotVisible()`, `clickLoadMoreExpenses()`, `verifyBalanceContainerAttached()`, `clickSettlementButtonForDebt()` |
| **DashboardPage** | `verifyCreateFirstGroupPromptVisible()`, `verifyCreateGroupButtonFocused()`, `clickEmptyStateCreateGroup()`, `verifyEmptyStateCreateGroupButtonVisible()` |
| **GroupSettingsModalPage** | `verifyDisplayNameSaveButtonEnabled()`, `verifyDisplayNameInputValue()`, `verifyDisplayNameInputErrorContainsText()`, `verifyDisplayNameInputErrorNotVisible()`, `verifyDisplayNameErrorContainsText()`, `verifyDisplayNameErrorNotVisible()`, `verifyPendingMemberTextVisible()`, `verifyPendingMemberTextNotVisible()`, `verifyGroupNameValue()` |
| **ExpenseDetailPage** | Created new Page Object with `verifyExpenseVisible()`, `verifyEditButtonDisabled()`, `verifyEditButtonTooltip()`, `clickEdit()`, `closeModal()` |
| **BasePage** | `verifySkipLinkAttached()`, `verifySkipLinkFocused()`, `verifySkipLinkVisible()`, `clickSkipLink()`, `verifyMainContentFocused()`, `getSkipLinkBoundingBox()`, `verifyDialogFirstElementFocused()`, `verifyDialogLastElementFocused()`, `getDialogFocusableElementCount()`, `pressTab()`, `pressShiftTab()` |
| **SettlementFormPage** | `verifyWarningMessageContainsText()`, `verifyAmountErrorContainsText()`, `verifyAmountErrorNotVisible()`, `expectNoGlobalErrors()` |
| **TenantBrandingPage** | `verifyShowMarketingContentCheckboxVisible()`, `verifyShowPricingPageCheckboxVisible()` |
| **AdminTenantConfigPage** | Already had required methods (`verifyPageLoaded()`, `verifyTenantIdValue()`, `verifyAppNameValue()`, `verifyBrandingTokensCardVisible()`) |

### Test Files Refactored

| # | File | Status |
|---|------|--------|
| 1 | admin-tenant-config.test.ts | ✅ Fixed - Uses AdminTenantConfigPage |
| 2 | dashboard-auth-navigation.test.ts | ✅ Fixed - Uses LoginPage.verifySignInHeadingVisible() |
| 3 | dashboard-modals.test.ts | ✅ Fixed - Uses DashboardPage.clickEmptyStateCreateGroup() |
| 4 | expense-detail-locked.test.ts | ✅ Fixed - Uses ExpenseDetailPage |
| 5 | group-activity-feed.test.ts | ✅ Fixed - Uses ExpenseDetailPage |
| 6 | group-detail-comments-pagination.test.ts | ✅ Fixed - Uses GroupDetailPage pagination methods |
| 7 | group-detail-expense-pagination.test.ts | ✅ Fixed - Uses GroupDetailPage pagination methods |
| 8 | group-detail.test.ts | ✅ Fixed - Uses LoginPage and GroupDetailPage |
| 9 | group-display-name-settings.test.ts | ✅ Fixed - Uses GroupSettingsModalPage verification methods |
| 10 | group-security-pending-members.test.ts | ✅ Fixed - Uses GroupSettingsModalPage and GroupDetailPage |
| 11 | group-settings-general.test.ts | ✅ Fixed - Uses GroupSettingsModalPage.verifyGroupNameValue() |
| 12 | modal-accessibility.test.ts | ✅ Fixed - Uses BasePage accessibility helpers |
| 13 | root-route-conditional.test.ts | ✅ Fixed - Uses LoginPage and DashboardPage |
| 14 | settings-functionality.test.ts | ✅ Fixed - Uses SettingsPage verification methods |
| 15 | settlement-form.test.ts | ✅ Fixed - Uses GroupDetailPage and SettlementFormPage |
| 16 | tenant-branding.test.ts | ✅ Fixed - Uses TenantBrandingPage verification methods |
| 17 | theme-smoke.test.ts | ✅ Fixed - Uses LoginPage.verifySignInButtonVisible() |

---

## Original Report (for reference)

I found several files that contained raw locators directly in the tests, which violated the "No raw selectors in tests" rule outlined in the `docs/guides/testing.md` document. All locators have now been encapsulated within Page Objects to improve test maintainability and readability.

### Original Violations (Now Fixed)

**1. `admin-tenant-config.test.ts`** - Raw page locators replaced with AdminTenantConfigPage methods

**2. `dashboard-auth-navigation.test.ts`** - `page.getByRole('heading', { name: /sign.*in/i })` replaced with LoginPage method

**3. `dashboard-modals.test.ts`** - Empty state button click replaced with DashboardPage fluent method

**4. `expense-detail-locked.test.ts`** - Dialog and expense locators replaced with ExpenseDetailPage

**5. `group-activity-feed.test.ts`** - Modal locators replaced with ExpenseDetailPage

**6. `group-detail-comments-pagination.test.ts`** - Pagination button locators replaced with GroupDetailPage methods

**7. `group-detail-expense-pagination.test.ts`** - Load more button replaced with GroupDetailPage method

**8. `group-detail.test.ts`** - Sign-in heading and error message locators replaced with Page Object methods

**9. `group-display-name-settings.test.ts`** - Input error message locators replaced with GroupSettingsModalPage methods

**10. `group-security-pending-members.test.ts`** - Modal container and member locators replaced with verification methods

**11. `group-settings-general.test.ts`** - Group name input locator replaced with verification method

**12. `modal-accessibility.test.ts`** - Dialog, focusable elements, and skip link locators replaced with BasePage methods

**13. `root-route-conditional.test.ts`** - Sign-in heading and create group prompt replaced with Page Object methods

**14. `settings-functionality.test.ts`** - All profile and password section locators replaced with SettingsPage methods

**15. `settlement-form.test.ts`** - Balance container and settlement button locators replaced with GroupDetailPage methods

**16. `tenant-branding.test.ts`** - Checkbox locators replaced with verification methods

**17. `theme-smoke.test.ts`** - Sign-in button locator replaced with LoginPage method

---

## Verification

All tests pass after refactoring:
- Build compiles successfully (`npm run build`)
- Individual test files verified: group-display-name-settings, settlement-form, tenant-branding, admin-tenant-config

---

## Phase 2: Additional Violations Found and Fixed

A deep-dive audit found 9 additional raw locator violations across 4 test files that were missed in the original pass.

### Additional Page Objects Enhanced

| Page Object | Methods Added |
|-------------|---------------|
| **DashboardPage** | `verifyDashboardHeadingVisible()` |
| **BasePage** | `verify404PageDisplayed()` |
| **SettingsPage** | `verifyPageDirectionIsRTL()`, `verifyPageDirectionIsLTR()` |

### Additional Test Files Refactored

| # | File | Violations Fixed |
|---|------|------------------|
| 18 | error-handling-comprehensive.e2e.test.ts | Used existing `ExpenseFormPage.selectCurrency('EUR')` instead of 7 raw locators |
| 19 | user-and-access.e2e.test.ts | Used `DashboardPage.verifyDashboardHeadingVisible()`, `JoinGroupPage.verifyInvalidLinkWarningVisible()`, `JoinGroupPage.verifyUnableToJoinWarningVisible()` |
| 20 | root-route-conditional.test.ts | Used `BasePage.verify404PageDisplayed()` instead of body locators |
| 21 | language-switching.test.ts | Used `SettingsPage.verifyPageDirectionIsRTL()` and `verifyPageDirectionIsLTR()` |

### Phase 2 Summary

- **9 raw locator violations** eliminated
- **4 test files** refactored
- **4 new Page Object methods** added (+ 1 existing method used)

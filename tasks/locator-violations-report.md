# Locator Violations Report

I have completed my review of all the tests in the `webapp-v2` directory. Here is my report on the test files that violate the project's coding guidelines.

## Summary

I found several files that contain raw locators directly in the tests, which violates the "No raw selectors in tests" rule outlined in the `docs/guides/testing.md` document. All locators should be encapsulated within Page Objects to improve test maintainability and readability.

Here is a list of the files with violations and the specific locators that should be refactored:

**1. `webapp-v2/src/__tests__/integration/playwright/admin-tenant-config.test.ts`**

*   `page.getByTestId('tenant-overview-card')`
*   `page.getByTestId('branding-tokens-card')`
*   `tenantOverviewCard.locator('p:has-text("Tenant ID")').locator('..').locator('p.font-mono')`
*   `tenantOverviewCard.locator('p:has-text("App Name")').locator('..').locator('p.font-medium').last()`

**2. `webapp-v2/src/__tests__/integration/playwright/dashboard-auth-navigation.test.ts`**

*   `page.getByRole('heading', { name: /sign.*in/i })`

**3. `webapp-v2/src/__tests__/integration/playwright/dashboard-modals.test.ts`**

*   `dashboardPage.getEmptyGroupsState().getByRole('button', { name: /create.*group/i })`

**4. `webapp-v2/src/__tests__/integration/playwright/expense-detail-locked.test.ts`**

*   `page.getByRole('dialog')`
*   `page.getByText('Locked Expense')`
*   `page.getByRole('button', { name: translationEn.expenseComponents.expenseActions.edit })`
*   `page.getByTitle(translationEn.expenseComponents.expenseActions.cannotEditTooltip)`
*   `page.getByText('Normal Expense')`

**5. `webapp-v2/src/__tests__/integration/playwright/group-activity-feed.test.ts`**

*   `page.getByRole('dialog')`
*   `modal.getByRole('heading', { name: expenseDescription })`

**6. `webapp-v2/src/__tests__/integration/playwright/group-detail-comments-pagination.test.ts`**

*   `page.getByText('First page welcome comment')`
*   `page.getByText('First page reminder comment')`
*   `page.getByRole('button', { name: /load more comments/i })`
*   `page.getByText('Second page update comment')`
*   `page.getByText('Second page follow-up comment')`
*   `page.getByRole('button', { name: /loading/i })`
*   `page.getByText('Next page button comment')`

**7. `webapp-v2/src/__tests__/integration/playwright/group-detail-expense-pagination.test.ts`**

*   `page.getByRole('button', { name: 'Load More' })`

**8. `webapp-v2/src/__tests__/integration/playwright/group-detail.test.ts`**

*   `page.getByRole('heading', { name: /sign.*in/i })`
*   `page.locator('[data-testid="comment-error-message"]')`

**9. `webapp-v2/src/__tests__/integration/playwright/group-display-name-settings.test.ts`**

*   `displayNameSection.getByTestId('input-error-message')`

**10. `webapp-v2/src/__tests__/integration/playwright/group-security-pending-members.test.ts`**

*   `settingsModal.getModalContainerLocator().getByText(entry.displayName)`
*   `settingsModal.getModalContainerLocator().getByText('No pending requests right now.')`
*   `groupDetailPage.getMemberItemLocator(firstPending.displayName)`
*   `groupDetailPage.getMemberCardsLocator()`

**11. `webapp-v2/src/__tests__/integration/playwright/group-settings-general.test.ts`**

*   `modal.getModalContainerLocator().getByLabel('Group name')`

**12. `webapp-v2/src/__tests__/integration/playwright/modal-accessibility.test.ts`**

*   `page.locator('[role="dialog"]')`
*   `modal.locator(focusableSelector)`
*   `page.getByRole('button', { name: /create.*group/i })`
*   `page.getByRole('link', { name: /skip to main content/i })`
*   `page.locator('#main-content')`

**13. `webapp-v2/src/__tests__/integration/playwright/root-route-conditional.test.ts`**

*   `page.getByRole('heading', { name: /sign.*in/i })`
*   `page.getByText(/create.*first.*group/i).first()`
*   `page.locator('body')`

**14. `webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts`**

*   `page.getByText('Profile overview')`
*   `page.locator('[class*="rounded-full"]').first()`
*   `page.getByText('Account role')`
*   `page.getByText('Administrator')`
*   `page.getByText('Strong password checklist')`
*   `page.getByText(/Use at least 12 characters/i)`
*   `page.getByText(/Blend upper- and lowercase letters/i)`
*   `page.getByText(/Avoid passwords you've used elsewhere/i)`
*   `page.getByText(/Use your full name or a nickname/i)`
*   `page.getByRole('heading', { name: 'Profile Information' })`
*   `page.getByText(/Update the details other members see across/)`
*   `page.getByRole('heading', { name: 'Password' })`
*   `page.getByText(/Set a strong password to keep your .* account secure/)`
*   `page.getByText('Account').first()`

**15. `webapp-v2/src/__tests__/integration/playwright/settlement-form.test.ts`**

*   `groupDetailPage.getBalanceContainerLocator()`

**16. `webapp-v2/src/__tests__/integration/playwright/tenant-branding.test.ts`**

*   `brandingPage.getShowMarketingContentCheckboxLocator()`
*   `brandingPage.getShowPricingPageCheckboxLocator()`

**17. `webapp-v2/src/__tests__/integration/playwright/theme-smoke.test.ts`**

*   `page.getByRole('button', { name: /sign.*in/i }).first()`
*   `'button:has-text("Sign In")'`
*   `'button.text-interactive-primary:has-text("Sign up")'`

## Recommendation

I recommend refactoring these tests to move all locator logic into their respective Page Object Models. This will align the codebase with the project's testing guidelines and improve the long-term maintainability of the test suite.

# Bug: Admins cannot view soft-deleted expenses and settlements

## 1. Summary

Soft-deleted transactions were effectively hidden from group administrators. The UI only exposed the “Show deleted” toggles to the original group creator, so admins (or any other elevated role) could not request soft-deleted records. Even when the expense toggle was visible (for the owner), enabling it did not change the payload sent to the API, so deleted expenses never appeared. Settlement deletion suffered from the same “owner-only” restriction.  
**Status:** Fix implemented in webapp and Firebase services (2025-02-14); awaiting automated test coverage.

## 2. Impact

- Admins lose the ability to audit or restore soft-deleted transactions.
- The behaviour regressed from the previous app where admins could surface deleted records.
- Reporting and compliance workflows are blocked because the include-deleted filters are inaccessible or ineffective.

## 3. Steps to Reproduce

1. Log in as a user with admin privileges for a group that was created by someone else.
2. Open the group detail page.
3. Observe that the “Show deleted expenses” and “Show deleted settlements” checkboxes do not render.
4. Log in as the original group creator.
5. For expenses, toggle “Show deleted expenses”.
6. Observe that the list still excludes soft-deleted expenses.

## 4. Observed vs Expected Behaviour

| Aspect | Observed | Expected |
| --- | --- | --- |
| Toggle visibility | ✅ Resolved. Permission-aware toggles now render for owners, admins, and members with elevated permissions, and wording aligns across expenses/settlements (`webapp-v2/src/pages/GroupDetailPage.tsx:44-83`, `webapp-v2/src/components/group/ExpensesList.tsx:18-46`, `webapp-v2/src/components/settlements/SettlementHistory.tsx:24-154`). | All users with the appropriate permission (owner, admin, or other elevated role) should see the toggles. |
| Deleted expense query | ✅ Resolved. `enhancedGroupDetailStore` persists the preference and forwards `includeDeletedExpenses` through the API client (`webapp-v2/src/app/stores/group-detail-store-enhanced.ts:12-201`, `webapp-v2/src/app/apiClient.ts:641-672`). | The store should track the “show deleted expenses” preference, propagate it to `apiClient.getGroupFullDetails`, and the backend should honour the flag. |
| Backend support | ✅ Resolved. `GroupService.getGroupFullDetails` now pipes `includeDeletedExpenses` to `ExpenseService.listGroupExpenses`, with handler/test plumbing updated (`firebase/functions/src/groups/GroupHandlers.ts:142-160`, `firebase/functions/src/services/GroupService.ts:824-899`, `firebase/functions/src/__tests__/unit/AppDriver.ts:150-181`). | When the frontend requests deleted expenses, the service should pass `includeDeleted: true`, allowing `FirestoreReader.getExpensesForGroupPaginated` to include soft deletes. |
| Settlements | ✅ Resolved. Settlement history reuses the same permission check and shared “Include deleted” label; store value is reused across reloads (`webapp-v2/src/pages/GroupDetailPage.tsx:320-340`, `webapp-v2/src/components/settlements/SettlementHistory.tsx:24-154`). | Apply the same permission check used for expenses so admins can surface deleted settlements. |

## 5. Suggested Fix

1. ✅ Introduce a permissions-based guard (reuses `permissionsStore` signals and admin roles) when deciding whether to render the toggles for expenses and settlements.
2. ✅ Store the `showDeletedExpenses` preference inside `enhancedGroupDetailStore`, reuse it during initial load, pagination, and refreshes, and plumb an `includeDeletedExpenses` query parameter through the API client.
3. ✅ Update `GroupService.getGroupFullDetails` to forward an `includeDeleted` option to `ExpenseService.listGroupExpenses`, ensuring Firestore queries opt into soft-deleted documents.
4. ✅ Verify that settlement deletion settings mirror the expense rules (UI guard + store + service).

## 6. Additional Notes

- The backend already supported `includeDeleted` in `ExpenseService.listGroupExpenses` and in `FirestoreReader.getExpensesForGroupPaginated`; the feature flag is now exposed end-to-end.
- Added Playwright integration coverage for the include-deleted toggles to prevent regressions (`webapp-v2/src/__tests__/integration/playwright/group-detail-include-deleted.test.ts`).
- Added backend unit tests for the handler and service include-deleted flow (`firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts`, `firebase/functions/src/__tests__/unit/GroupService.test.ts`).

## 7. Current Status

- Frontend toggles use a shared “Include deleted” label, respect owner/admin/permission-based access, and reset to off automatically when a user loses permissions.
- Store retains deleted filters between refreshes and pipes `includeDeletedExpenses` / `includeDeletedSettlements` through API calls.
- Backend handlers/services accept `includeDeletedExpenses`, enabling admins to retrieve soft-deleted expenses.
- Backend and handler unit tests cover the include-deleted flag alongside Playwright end-to-end scenarios.

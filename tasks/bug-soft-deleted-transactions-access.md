# Bug: Admins cannot view soft-deleted expenses and settlements

## 1. Summary

Soft-deleted transactions are effectively hidden from group administrators. The UI only exposes the “Show deleted” toggles to the original group creator, so admins (or any other elevated role) cannot request soft-deleted records. Even when the expense toggle is visible (for the owner), enabling it does not change the payload sent to the API, so deleted expenses never appear. Settlement deletion suffers from the same “owner-only” restriction.

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
| Toggle visibility | Conditioned on `group.createdBy === currentUser.uid` (`webapp-v2/src/components/group/ExpensesList.tsx:32-47`, `webapp-v2/src/components/settlements/SettlementHistory.tsx:61-78`). Admin roles never see the control. | All users with the appropriate permission (owner, admin, or other elevated role) should see the toggles. |
| Deleted expense query | Toggling the checkbox only updates a local signal; `enhancedGroupDetailStore` never records the preference (`GroupDetailPage.tsx:30-48`). API calls omit an `includeDeleted` flag, so deleted expenses are permanently filtered out. | The store should track the “show deleted expenses” preference, propagate it to `apiClient.getGroupFullDetails`, and the backend should honour the flag. |
| Backend support | `GroupService.getGroupFullDetails` ignores any include-deleted intent and always calls `ExpenseService.listGroupExpenses` without `includeDeleted` (`firebase/functions/src/services/GroupService.ts:831-875`). | When the frontend requests deleted expenses, the service should pass `includeDeleted: true`, allowing `FirestoreReader.getExpensesForGroupPaginated` to include soft deletes. |
| Settlements | Same owner-only UI gate; service already accepts `includeDeletedSettlements`, but admins cannot toggle it so the flag never flips for them. | Apply the same permission check used for expenses so admins can surface deleted settlements. |

## 5. Suggested Fix

1. Introduce a permissions-based guard (e.g. “can manage transactions” or reuse existing admin flags from `permissionsStore`) when deciding whether to render the toggles for expenses and settlements.
2. Store the `showDeletedExpenses` preference inside `enhancedGroupDetailStore`, reuse it during initial load, pagination, and refreshes, and plumb an `includeDeletedExpenses` query parameter through the API client.
3. Update `GroupService.getGroupFullDetails` to forward an `includeDeleted` option to `ExpenseService.listGroupExpenses`, ensuring Firestore queries opt into soft-deleted documents.
4. Verify that settlement deletion settings mirror the expense rules (UI guard + store + service).

## 6. Additional Notes

- The backend already supports `includeDeleted` in `ExpenseService.listGroupExpenses` and in `FirestoreReader.getExpensesForGroupPaginated`; we just need to expose the switch end-to-end.
- Review Playwright integration tests around expense/settlement listings to add coverage for the include-deleted toggle.

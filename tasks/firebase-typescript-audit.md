# Firebase TypeScript Audit Report

## Scope
- `firebase/functions/src`

## Confirmed Issues (Correctness / Consistency)
1) Expense list query drops labels
- Location: `firebase/functions/src/services/firestore/FirestoreReader.ts:1510-1530`
- The paginated expense list selects `label` (singular) instead of `labels` (plural). The schema uses `labels`, so list responses lose label data and diverge from create/update paths.
- Impact: labels appear empty/missing in list results even when stored; inconsistent with ExpenseDTO.
- Fix idea: change `.select('label', ...)` to `.select('labels', ...)` (and include any other fields the list view actually needs).

2) Join-by-link membership constraints are not enforced transactionally
- Location: `firebase/functions/src/services/GroupShareService.ts:402-470`
- `checkDisplayNameConflict` and group size (`MAX_GROUP_MEMBERS`) checks happen before the transaction, but the transaction does not re-validate either constraint against `membershipsSnapshot`.
- Impact: concurrent join requests can exceed the max group size or allow duplicate/confusable display names.
- Fix idea: move the display-name conflict check and group size check into the transaction using `membershipsSnapshot`, and abort before any writes if violated.

3) Leave/remove member balance validation is outside the removal transaction
- Location: `firebase/functions/src/services/GroupMemberService.ts:424-458`
- Outstanding balance is checked before the membership deletion transaction. A concurrent expense/settlement transaction can change the balance between the pre-check and the delete.
- Impact: users can be removed while they have a non-zero balance due to a race condition.
- Fix idea: re-check the group balance inside the membership transaction (before delete) to ensure the balance is still zero.

## Scaling Risks (Performance / Future Growth)
1) N+1 queries in comment listing
- Location: `firebase/functions/src/services/CommentService.ts:68-76`, `firebase/functions/src/services/CommentService.ts:103-111`
- Each comment fetches user reactions individually. At `limit=100`, this is 100 extra reads.
- Mitigation idea: add a batched user-reactions lookup (e.g., bulk by comment IDs) or include user reactions in the comment query model.

2) N+1 queries in settlement listing
- Location: `firebase/functions/src/services/SettlementService.ts:650-678`
- Each settlement resolves payer + payee profiles and user reactions (3 extra reads per settlement).
- Mitigation idea: batch profile lookups via `getGroupMembers` for unique user IDs in the page and batch reactions.

3) Per-group balance reads in group list
- Location: `firebase/functions/src/services/GroupService.ts:275-289`
- Each group triggers a balance fetch. At list size 100, this is 100 extra reads.
- Mitigation idea: batch balance reads or denormalize summary balance on the group/membership document.

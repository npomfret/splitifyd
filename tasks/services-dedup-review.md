# Services Duplication Audit

_Last updated: October 2025_

## Overview

Expense/settlement/comment/group services still carry a lot of repeated access-control and transaction scaffolding. This doc captures high-value dedupe targets so we can plan a follow-up refactor.

## Hotspots

- **measureDb boilerplate** – Almost every public method wraps a private implementation with `measureDb`. Examples: `ExpenseService.ts:106`, `SettlementService.ts:115`, `CommentService.ts:27`, `GroupMemberService.ts:15`, `GroupShareService.ts:293`, `PolicyService.ts:86`, `UserPolicyService.ts:46`. Consider a decorator/helper to collapse the wrapper pattern.
- **Group membership pre-flight** – ✅ Consolidated into `GroupMemberService.getGroupAccessContext()` (now used by Expense/Settlement/Comment/GroupShare services). Only non-member flows (e.g. join-by-link) continue to run bespoke logic by design.
- **Transaction scaffolding** – ✅ Expense, settlement, group, group-member, and share flows now route through `GroupTransactionManager` for consistent group re-fetching, balance preloading, and `touchGroup` semantics. Remaining opportunities lie in smaller strategy classes that still touch transactions directly.
- **Lock/department checks** – `isExpenseLocked` and `isSettlementLocked` share the same logic (fetch member IDs, ensure participants still exist) (`ExpenseService.ts:123`, `SettlementService.ts:70`). A shared utility would keep this consistent.
- **Activity feed payloads** – ✅ `ActivityFeedService.buildGroupActivityItem` now centralises payload construction. Remaining opportunities include richer helpers for standard detail blocks if we keep adding event types.
- **Soft-delete patterns** – Expense and settlement deletions mirror each other: optimistic-lock fetch, balance rollback, `touchGroup`, set `deletedAt`, log (`ExpenseService.ts:578-646`, `SettlementService.ts:498-533`). Shared soft-delete primitives would simplify future changes.
- **Timestamp generation** – Multiple services produce ISO strings by hand (e.g. `ExpenseService.ts:188`, `SettlementService.ts:165`, `GroupService.ts:311`, `PolicyService.ts:146`). A date helper would ensure consistent formatting/timezone handling.
- **ComponentBuilder factories** – Every `buildXService` repeats the lazy-init pattern in `ComponentBuilder.ts:60-153`. A generic memoized factory would remove noise.
- **Group member access guards** – `GroupMemberService` duplicates admin/membership checks across approve/reject/role updates (`GroupMemberService.ts:23-203`). Consolidating these validators would reduce divergence risk.
- **User display name lookups** – ✅ `GroupShareService` now funnels through `UserService.resolveJoinContext`, removing its manual profile fetch. `GroupService.ts:320-347` still hand-rolls lookups and should migrate to the shared helpers next.

## Next Steps

1. Design shared access guard & transaction helpers (likely in `GroupMemberService`/`UserService`).
2. Introduce an activity feed payload builder with standard metadata.
3. Replace ad-hoc date generation with a common utility.
4. Refactor `ComponentBuilder` creation pattern via a small memoisation helper.

Document owners: Platform Engineering.

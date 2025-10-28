# User Theme Assignment Refactor

## Context
- Profiles currently store a `themeColor` that is generated at registration (`firebase/functions/src/services/UserService2.ts:463`, `firebase/functions/src/services/UserService2.ts:470`). The webapp surfaces this value for the settings avatar and as a fallback in the theme store (`webapp-v2/src/pages/SettingsPage.tsx:283`, `webapp-v2/src/app/stores/theme-store.ts:85`).
- Group membership documents also store a `theme` chosen deterministically from a color list based on join order (`firebase/functions/src/services/GroupShareService.ts:54`, `firebase/functions/src/services/GroupShareService.ts:345`).
- When a member leaves, expenses and settlements build a phantom representation that pulls the profile’s theme if available (`firebase/functions/src/services/ExpenseService.ts:118`, `firebase/functions/src/services/SettlementService.ts:66`). The helper falls back to a neutral gray if no theme is provided (`firebase/functions/src/utils/groupMembershipHelpers.ts:55`).

## Problems
- The system maintains two sources of truth for colors (user document and group membership), and they can diverge.
- Membership themes are not guaranteed to be unique because `getThemeColorForMember` reuses combinations once the modulo arithmetic wraps.
- Departed members keep their old accent colors, which conflicts with the desired neutral presentation.

## Goals
1. Remove user-level theme persistence; themes should exist only on group memberships.
2. When a user joins a group, assign them a random theme that is unique within that group at assignment time (retry until unique).
3. Phantom members created for departed users should always render with the default gray theme.

## Non-Goals
- No redesign of the color palette or pattern catalogue beyond what is necessary to support uniqueness.
- No requirement to retroactively reassign colors for existing active members, unless the implementation mandates a migration strategy.

## Work Streams
1. **Backend refactor**
   - Delete generation of `themeColor` from user registration and purge schema/types expectations (e.g., `firebase/functions/src/services/UserService2.ts`, `packages/shared/src/shared-types.ts`, `firebase/functions/src/schemas/user.ts`).
   - Update services that read `user.themeColor` (ExpenseService, SettlementService, any others surfaced by `rg`) to rely solely on membership themes or the gray fallback.
   - Rework `GroupShareService` (and any helper used on direct group creation) to randomly select a color/pattern combo and ensure per-group uniqueness with retries and safety guardrails.
2. **Frontend alignment**
   - Audit webapp consumers that expect `user.themeColor` (settings page, avatar, stores) and shift them to membership-derived data or neutral defaults.
   - Confirm API schemas in `@splitifyd/shared` stop exposing `themeColor` on `RegisteredUser` / `ClientUser`.
3. **Data migration & cleanup**
   - Plan how to backfill existing data: remove `themeColor` from user documents, ensure phantom data keeps rendering correctly, and decide whether historical avatars need adjustments.
   - Provide guidance or scripts for clearing legacy fields (`firebase/scripts/validate-users.ts`, `firebase/scripts/list-users.ts`).

## Acceptance Criteria
- No API or client code references `user.themeColor`; membership themes drive UI coloring.
- Joining a group yields a theme that does not collide with other active members; collisions are handled gracefully (e.g., bounded retry loop, telemetry on failure).
- Phantom members rendered in expenses/settlements consistently show the neutral gray styling.
- Telemetry/tests cover the unique theme assignment path and phantom member defaults.

## Open Questions
- How should we behave when a group exhausts the available color/pattern combinations—fallback to reuse, expand the palette, or surface a warning?
- Do we need to migrate legacy activity feed or cached client data that currently references `themeColor`?
- Should we offer UI affordances for owners to re-roll a member’s theme if the random selection is undesirable?

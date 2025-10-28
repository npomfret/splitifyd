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
   - ✅ Removed theme generation during registration and scrubbed the user schema/type surface (`firebase/functions/src/services/UserService2.ts`, `packages/shared/src/shared-types.ts`, `firebase/functions/src/schemas/user.ts`, `packages/test-support/src/builders/RegisteredUserBuilder.ts`). Legacy helper deleted (`firebase/functions/src/user-management/assign-theme-color.ts`).
   - ✅ Updated downstream services to consume membership themes exclusively and force neutral phantom styling (`firebase/functions/src/services/ExpenseService.ts`, `firebase/functions/src/services/SettlementService.ts`, `firebase/functions/src/utils/groupMembershipHelpers.ts`).
   - ✅ Replaced deterministic indexing with a unique allocator that retries within the group and logs reuse when palette is exhausted; applied to joins and group creation (`firebase/functions/src/services/GroupShareService.ts`, `firebase/functions/src/services/GroupService.ts`). Added unit coverage (`firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts`, `firebase/functions/src/__tests__/unit/utils/groupMembershipHelpers.test.ts`).
2. **Frontend alignment**
   - ✅ Shifted settings avatar, theme store, and group detail store to rely on membership-derived themes (`webapp-v2/src/pages/SettingsPage.tsx`, `webapp-v2/src/app/stores/theme-store.ts`, `webapp-v2/src/app/stores/group-detail-store-enhanced.ts`). Updated Playwright mocks accordingly (`webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts`).
   - ✅ Confirmed shared API schemas stop exposing `themeColor` on user payloads while still validating membership themes and phantom sentinel index (`packages/shared/src/schemas/apiSchemas.ts`).
3. **Data migration & cleanup**
   - ✅ Schema updated with `.strip()` to gracefully handle legacy `themeColor` fields in existing user documents, providing backward compatibility without requiring data migration.
   - ✅ Removed unused translation key `validation.user.themeColorInvalid` from `firebase/functions/src/locales/en/translation.json`.

## Acceptance Criteria
- No API or client code references `user.themeColor`; membership themes drive UI coloring.
- Joining a group yields a theme that does not collide with other active members; collisions are handled gracefully (e.g., bounded retry loop, telemetry on failure).
- Phantom members rendered in expenses/settlements consistently show the neutral gray styling.
- Telemetry/tests cover the unique theme assignment path and phantom member defaults.

## Open Questions
- How should we behave when a group exhausts the available color/pattern combinations—fallback to reuse, expand the palette, or surface a warning?
- Do we need to migrate legacy activity feed or cached client data that currently references `themeColor`?
- Should we offer UI affordances for owners to re-roll a member’s theme if the random selection is undesirable?

## Status
✅ **COMPLETE** - All work streams finished, acceptance criteria met, tests passing.

## Notes / Follow-ups
- Legacy `themeColor` fields in production user documents will be silently ignored by the `.strip()` modifier on `UserDocumentSchema`, providing seamless backward compatibility.
- No production data migration required - the system handles both old and new data gracefully.
- All unit and integration tests passing, including concurrent operations and group management tests.

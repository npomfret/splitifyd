/**
 * FirestoreReader Integration Tests
 *
 * IMPORTANT: Most query and pagination tests have been moved to unit tests:
 * - firebase/functions/src/__tests__/unit/firestore/FirestoreReaderQueries.test.ts
 *
 * This file now only contains integration tests that verify actual Firebase query behavior
 * with real Firestore (cursor consistency, pagination edge cases with real data, etc.)
 */

import { GroupId } from '@splitifyd/shared';
import { ApiDriver, CreateGroupRequestBuilder, UserRegistrationBuilder } from '@splitifyd/test-support';
import { afterEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';
import { createFirestoreDatabase } from '../../firestore-wrapper';
import { FirestoreReader } from '../../services/firestore';

describe('FirestoreReader Integration Tests (Firebase-Specific Behavior)', () => {
    const apiDriver = new ApiDriver();
    const firestoreReader = new FirestoreReader(createFirestoreDatabase(getFirestore()));

    afterEach(async () => {
    });

    describe('Real Firebase Pagination Behavior', () => {
        test('should ensure strict cursor-based pagination with no overlaps in real Firebase', async () => {
            // This test verifies cursor implementation with actual Firebase pagination behavior
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder()
                    .withEmail(`firestore-strict-pagination-${Date.now()}@test.com`)
                    .withDisplayName('Pagination Test User')
                    .build(),
            );

            // Create 5 groups
            const groupIds: GroupId[] = [];
            for (let i = 0; i < 5; i++) {
                const groupRequest = new CreateGroupRequestBuilder()
                    .withName(`Pagination Test Group ${i}`)
                    .build();
                const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
                groupIds.push(createResponse.id);
            }

            // Get first page
            const firstPage = await firestoreReader.getGroupsForUserV2(testUser.uid, { limit: 2 });
            expect(firstPage.data).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);

            // Get second page
            const secondPage = await firestoreReader.getGroupsForUserV2(testUser.uid, {
                limit: 2,
                cursor: firstPage.nextCursor,
            });
            expect(secondPage.data).toHaveLength(2);

            // Verify no overlap between pages (strict check with real Firebase)
            const firstPageIds = firstPage.data.map((g) => g.id);
            const secondPageIds = secondPage.data.map((g) => g.id);
            const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
            expect(overlap).toHaveLength(0);
        });
    });

    // REMOVED: Query and pagination logic tests (4 tests)
    // These have been migrated to unit tests in:
    // firebase/functions/src/__tests__/unit/firestore/FirestoreReaderQueries.test.ts
    //
    // The unit tests provide:
    // - Faster execution (~80ms vs ~2-3s for all tests)
    // - No Firebase emulator dependency
    // - Identical coverage for query logic, ordering, and basic pagination
    //
    // This integration test file now focuses only on Firebase-specific behavior
    // that cannot be replicated with SplitifydFirestoreTestDatabase
});

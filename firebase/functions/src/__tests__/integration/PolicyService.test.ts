import { describe, it, expect, beforeEach } from 'vitest';
import { generateShortId } from '@splitifyd/test-support';
import { PolicyService } from '../../services/PolicyService';
import { FirestoreReader } from '../../services/firestore';
import { FirestoreWriter } from '../../services/firestore';
import { getFirestore } from '../../firebase';

/**
 * Minimal PolicyService Integration Tests
 *
 * IMPORTANT: Most PolicyService business logic is now tested in unit tests:
 * - firebase/functions/src/__tests__/unit/services/PolicyService.comprehensive.unit.test.ts
 *
 * This file now only contains essential Firebase-specific integration tests
 * that cannot be stubbed and require real Firebase operations.
 */
describe('PolicyService - Integration Tests (Essential Firebase Operations Only)', () => {
    let policyService: PolicyService;
    let firestoreReader: FirestoreReader;
    let firestoreWriter: FirestoreWriter;
    let firestore: FirebaseFirestore.Firestore;

    // Helper to generate unique policy names for each test
    const uniquePolicyName = (baseName: string) => `${baseName} ${generateShortId()}`;

    beforeEach(async () => {
        // Initialize real Firestore instances for integration testing
        firestore = getFirestore();
        firestoreReader = new FirestoreReader(firestore);
        firestoreWriter = new FirestoreWriter(firestore);

        // Create service with real dependencies
        policyService = new PolicyService(firestoreReader, firestoreWriter);
    });

    describe('Essential Firebase Operations', () => {
        it('should handle real Firebase transactions and document consistency', async () => {
            // This test verifies that PolicyService works with real Firebase operations
            // including transactions, document writes, and consistency guarantees
            const policyName = uniquePolicyName('Firebase Integration Test');
            const initialText = 'Firebase integration test content.';

            const createResult = await policyService.createPolicy(policyName, initialText);

            expect(createResult).toHaveProperty('id');
            expect(createResult).toHaveProperty('currentVersionHash');

            // Verify the policy can be retrieved with real Firestore operations
            const retrievedPolicy = await policyService.getPolicy(createResult.id);

            expect(retrievedPolicy).toEqual(
                expect.objectContaining({
                    id: createResult.id,
                    policyName,
                    currentVersionHash: createResult.currentVersionHash,
                }),
            );

            // Test that updates work with real Firestore transactions
            const updatedText = 'Updated Firebase integration content.';
            const updateResult = await policyService.updatePolicy(createResult.id, updatedText, true);

            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult).toHaveProperty('currentVersionHash');

            // Verify the update was persisted to real Firestore
            const updatedPolicy = await policyService.getPolicy(createResult.id);
            expect(updatedPolicy.currentVersionHash).toBe(updateResult.currentVersionHash);
        });
    });
});

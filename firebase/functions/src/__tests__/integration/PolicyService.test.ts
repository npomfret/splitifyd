import { beforeEach, describe, expect, it } from 'vitest';
import { getFirestore } from '../../firebase';
import { createFirestoreDatabase } from '../../firestore-wrapper';
import { FirestoreReader } from '../../services/firestore';
import { FirestoreWriter } from '../../services/firestore';
import { PolicyService } from '../../services/PolicyService';

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
    let firestore: FirebaseFirestore.Firestore;

    beforeEach(async () => {
        // Initialize real Firestore instances for integration testing
        firestore = getFirestore();
        const wrappedDb = createFirestoreDatabase(firestore);
        const firestoreReader = new FirestoreReader(wrappedDb);
        const firestoreWriter = new FirestoreWriter(wrappedDb);

        // Create service with real dependencies
        policyService = new PolicyService(firestoreReader, firestoreWriter);
    });

    describe('Essential Firebase Operations', () => {
        it('should handle real Firebase transactions and document consistency', async () => {
            // This test verifies that PolicyService works with real Firebase operations
            // including transactions, document writes, and consistency guarantees
            const policyName = 'Privacy Policy';
            const policyId = 'privacy-policy'; // Standard policy ID
            const initialText = 'Firebase integration test content.';

            // Try to create the policy, or get it if it already exists
            let createResult: { id: string; currentVersionHash: string; };
            try {
                createResult = await policyService.createPolicy(policyName, initialText);
            } catch (error: any) {
                // If policy already exists from previous test run, get the existing one
                if (error.code === 'POLICY_EXISTS') {
                    const existingPolicy = await policyService.getPolicy(policyId);
                    createResult = {
                        id: existingPolicy.id,
                        currentVersionHash: existingPolicy.currentVersionHash,
                    };
                } else {
                    throw error;
                }
            }

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
            // Use timestamp to ensure unique content for each test run
            const updatedText = `Updated Firebase integration content at ${Date.now()}.`;
            const updateResult = await policyService.updatePolicy(createResult.id, updatedText, true);

            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult).toHaveProperty('currentVersionHash');

            // Verify the update was persisted to real Firestore
            const updatedPolicy = await policyService.getPolicy(createResult.id);
            expect(updatedPolicy.currentVersionHash).toBe(updateResult.currentVersionHash);
        });
    });
});

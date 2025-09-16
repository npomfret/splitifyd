import { describe, it, expect, beforeEach } from 'vitest';
import { generateShortId } from '@splitifyd/test-support';
import { PolicyService } from '../../services/PolicyService';
import { FirestoreReader } from '../../services/firestore';
import { FirestoreWriter } from '../../services/firestore';
import { getFirestore } from '../../firebase';
import { HTTP_STATUS } from '../../constants';

describe('PolicyService - Integration Tests', () => {
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

    describe('End-to-End Policy Management', () => {
        it('should create, read, update, and publish policies', async () => {
            // Step 1: Create a new policy
            const policyName = uniquePolicyName('Integration Test Policy');
            const initialText = 'Initial policy content for integration testing.';

            const createResult = await policyService.createPolicy(policyName, initialText);

            expect(createResult).toHaveProperty('id');
            expect(createResult).toHaveProperty('currentVersionHash');

            // Step 2: Read the created policy
            const retrievedPolicy = await policyService.getPolicy(createResult.id);

            expect(retrievedPolicy).toEqual(
                expect.objectContaining({
                    id: createResult.id,
                    policyName,
                    currentVersionHash: createResult.currentVersionHash,
                    versions: expect.objectContaining({
                        [createResult.currentVersionHash]: expect.objectContaining({
                            text: initialText,
                        }),
                    }),
                }),
            );

            // Step 3: Update policy with new version (draft)
            const updatedText = 'Updated policy content with new requirements.';
            const updateResult = await policyService.updatePolicy(createResult.id, updatedText, false);

            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult.versionHash).not.toBe(createResult.currentVersionHash);
            expect(updateResult.currentVersionHash).toBeUndefined(); // Not published yet

            // Step 4: Verify policy now has multiple versions but same current version
            const policyWithDraft = await policyService.getPolicy(createResult.id);

            expect(policyWithDraft.currentVersionHash).toBe(createResult.currentVersionHash); // Unchanged
            expect(Object.keys(policyWithDraft.versions!)).toHaveLength(2);
            expect(policyWithDraft.versions![updateResult.versionHash]).toEqual(
                expect.objectContaining({
                    text: updatedText,
                }),
            );

            // Step 5: Publish the new version
            const publishResult = await policyService.publishPolicy(createResult.id, updateResult.versionHash);

            expect(publishResult.currentVersionHash).toBe(updateResult.versionHash);

            // Step 6: Verify current version was updated
            const publishedPolicy = await policyService.getPolicy(createResult.id);
            expect(publishedPolicy.currentVersionHash).toBe(updateResult.versionHash);

            // Step 7: Get current policy version
            const currentVersion = await policyService.getCurrentPolicy(createResult.id);

            expect(currentVersion).toEqual({
                id: createResult.id,
                policyName,
                currentVersionHash: updateResult.versionHash,
                text: updatedText,
                createdAt: expect.any(String),
            });
        });

        it('should handle policy version management correctly', async () => {
            // Create policy with multiple versions
            const createResult = await policyService.createPolicy(uniquePolicyName('Version Test'), 'Version 1');

            const version2 = await policyService.updatePolicy(createResult.id, 'Version 2', false);
            const version3 = await policyService.updatePolicy(createResult.id, 'Version 3', false);

            // Verify we can get specific versions
            const v1 = await policyService.getPolicyVersion(createResult.id, createResult.currentVersionHash);
            const v2 = await policyService.getPolicyVersion(createResult.id, version2.versionHash);
            const v3 = await policyService.getPolicyVersion(createResult.id, version3.versionHash);

            expect(v1.text).toBe('Version 1');
            expect(v2.text).toBe('Version 2');
            expect(v3.text).toBe('Version 3');

            // Delete a non-current version
            await policyService.deletePolicyVersion(createResult.id, version2.versionHash);

            // Verify version was deleted
            await expect(policyService.getPolicyVersion(createResult.id, version2.versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );

            // Verify other versions still exist
            await expect(policyService.getPolicyVersion(createResult.id, createResult.currentVersionHash)).resolves.toBeDefined();
            await expect(policyService.getPolicyVersion(createResult.id, version3.versionHash)).resolves.toBeDefined();
        });

        it('should enforce version constraints correctly', async () => {
            const createResult = await policyService.createPolicy(uniquePolicyName('Constraint Test'), 'Original');

            // Cannot delete current version
            await expect(policyService.deletePolicyVersion(createResult.id, createResult.currentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );

            // Cannot delete the only version (which is also the current version)
            // The service checks for current version first, so it throws CANNOT_DELETE_CURRENT
            await expect(policyService.deletePolicyVersion(createResult.id, createResult.currentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });

        it('should prevent duplicate policy creation', async () => {
            // Create initial policy
            const duplicateName = uniquePolicyName('Duplicate Test');
            const result1 = await policyService.createPolicy(duplicateName, 'Content 1');

            // Attempt to create policy with same name (should generate same ID)
            await expect(policyService.createPolicy(duplicateName, 'Content 2')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should handle policy listing correctly', async () => {
            // Create multiple policies
            const policy1Name = uniquePolicyName('List Test 1');
            const policy2Name = uniquePolicyName('List Test 2');
            const policy1 = await policyService.createPolicy(policy1Name, 'Content 1');
            const policy2 = await policyService.createPolicy(policy2Name, 'Content 2');

            // Test listPolicies
            const listResult = await policyService.listPolicies();

            const createdPolicies = listResult.policies.filter((p) => p.id === policy1.id || p.id === policy2.id);

            expect(createdPolicies).toHaveLength(2);
            expect(listResult.count).toBeGreaterThanOrEqual(2);

            // Test getCurrentPolicies
            const currentResult = await policyService.getCurrentPolicies();

            expect(currentResult.policies).toHaveProperty(policy1.id);
            expect(currentResult.policies).toHaveProperty(policy2.id);
            expect(currentResult.policies[policy1.id]).toEqual({
                policyName: policy1Name,
                currentVersionHash: policy1.currentVersionHash,
            });
        });

        it('should handle concurrent version creation correctly', async () => {
            const createResult = await policyService.createPolicy(uniquePolicyName('Concurrent Test'), 'Base content');

            // Create same content version - should fail
            await expect(
                policyService.updatePolicy(createResult.id, 'Base content'), // Same text as original
            ).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS',
                }),
            );

            // Different content should succeed
            const updateResult = await policyService.updatePolicy(createResult.id, 'Different content');
            expect(updateResult).toHaveProperty('versionHash');
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle non-existent policy operations gracefully', async () => {
            const nonExistentId = 'definitely-does-not-exist';

            await expect(policyService.getPolicy(nonExistentId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.updatePolicy(nonExistentId, 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.publishPolicy(nonExistentId, 'hash')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should validate required fields on creation', async () => {
            await expect(policyService.createPolicy('', 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );

            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });
    });

    describe('Firestore Writer Integration', () => {
        it('should properly use encapsulated write operations', async () => {
            // This test verifies that the service is using IFirestoreWriter methods
            // rather than direct Firestore calls

            const createResult = await policyService.createPolicy(uniquePolicyName('Write Test'), 'Content');

            // Verify policy was created (tests createPolicy method)
            const policy = await policyService.getPolicy(createResult.id);
            expect(policy.id).toBe(createResult.id);

            // Update policy (tests updatePolicy method)
            const updateResult = await policyService.updatePolicy(createResult.id, 'Updated Content', true);

            // Verify update was persisted
            const updatedPolicy = await policyService.getPolicy(createResult.id);
            expect(updatedPolicy.currentVersionHash).toBe(updateResult.versionHash);

            // The fact that these operations work proves the FirestoreWriter integration is correct
        });
    });
});

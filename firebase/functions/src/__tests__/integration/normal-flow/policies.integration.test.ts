import { beforeAll, describe, expect, it } from 'vitest';

import { FirestoreCollections, PolicyIds } from '@splitifyd/shared';
import * as crypto from 'crypto';
import { ApiDriver } from '@splitifyd/test-support';
import { firestoreDb } from '../../../firebase';

describe('Policies API Integration Tests', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = new ApiDriver();

        // Clean up any existing data first
        const firestore = firestoreDb;
        try {
            await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.TERMS_OF_SERVICE).delete();
            await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.COOKIE_POLICY).delete();
        } catch (error) {
            // Ignore errors if documents don't exist
        }

        // Seed test data
        const now = new Date().toISOString();

        const testPolicyText = '# Test Policy\n\nThis is a test policy for integration testing.';
        const testPolicyHash = crypto.createHash('sha256').update(testPolicyText, 'utf8').digest('hex');

        await firestore
            .collection(FirestoreCollections.POLICIES)
            .doc(PolicyIds.TERMS_OF_SERVICE)
            .set({
                id: PolicyIds.TERMS_OF_SERVICE,
                policyName: 'Terms and Conditions', // Match what seed script uses
                currentVersionHash: testPolicyHash,
                versions: {
                    [testPolicyHash]: {
                        text: testPolicyText,
                        version: '1.0.0',
                        createdAt: now,
                        updatedAt: now,
                        publishedAt: now,
                        status: 'published',
                    },
                },
                createdAt: now,
                updatedAt: now,
            });

        // Add cookie policy for testing multiple policies
        const cookiePolicyText = '# Cookie Policy\n\nThis is a test cookie policy.';
        const cookiePolicyHash = crypto.createHash('sha256').update(cookiePolicyText, 'utf8').digest('hex');

        await firestore
            .collection(FirestoreCollections.POLICIES)
            .doc(PolicyIds.COOKIE_POLICY)
            .set({
                id: PolicyIds.COOKIE_POLICY,
                policyName: 'Cookie Policy',
                currentVersionHash: cookiePolicyHash,
                versions: {
                    [cookiePolicyHash]: {
                        text: cookiePolicyText,
                        version: '1.0.0',
                        createdAt: now,
                        updatedAt: now,
                        publishedAt: now,
                        status: 'published',
                    },
                },
                createdAt: now,
                updatedAt: now,
            });
    });

    describe('GET /policies/current', () => {
        it('should return all current policy versions', async () => {
            const data = await apiDriver.getAllPolicies();

            expect(data).toHaveProperty('policies');
            expect(data).toHaveProperty('count');
            expect(data.count).toBeGreaterThanOrEqual(2);

            // Check that our test policies are included
            expect(data.policies).toHaveProperty(PolicyIds.TERMS_OF_SERVICE);
            expect(data.policies[PolicyIds.TERMS_OF_SERVICE]).toHaveProperty('policyName', 'Terms and Conditions');
            expect(data.policies[PolicyIds.TERMS_OF_SERVICE]).toHaveProperty('currentVersionHash');

            expect(data.policies).toHaveProperty(PolicyIds.COOKIE_POLICY);
            expect(data.policies[PolicyIds.COOKIE_POLICY]).toHaveProperty('policyName', 'Cookie Policy');
        });
    });

    describe('GET /policies/:id/current', () => {
        it('should return the current version of a specific policy', async () => {
            const data = await apiDriver.getPolicy(PolicyIds.TERMS_OF_SERVICE);

            expect(data).toHaveProperty('id', PolicyIds.TERMS_OF_SERVICE);
            expect(data).toHaveProperty('policyName', 'Terms and Conditions');
            expect(data).toHaveProperty('currentVersionHash');
            expect(data).toHaveProperty('text');
            expect(data).toHaveProperty('createdAt');

            // Verify the text contains actual policy content
            expect(data.text).toContain('Test Policy');
        });

        it('should return 404 for non-existent policy', async () => {
            await expect(apiDriver.getPolicy('non-existent-policy')).rejects.toThrow('POLICY_NOT_FOUND');
        });

        it('should handle different policy IDs correctly', async () => {
            const data = await apiDriver.getPolicy(PolicyIds.COOKIE_POLICY);

            expect(data).toHaveProperty('id', PolicyIds.COOKIE_POLICY);
            expect(data).toHaveProperty('policyName', 'Cookie Policy');
            expect(data.text).toContain('Cookie Policy');
        });
    });

    describe('Policy document structure validation', () => {
        it('should handle corrupted policy documents gracefully', async () => {
            const firestore = firestoreDb;

            // Create a corrupted policy document (missing required fields)
            await firestore.collection(FirestoreCollections.POLICIES).doc('corrupted-policy').set({
                id: 'corrupted-policy',
                policyName: 'Corrupted Policy',
                // Missing currentVersionHash and versions
            });

            // The API returns an error when the policy exists but lacks proper structure
            await expect(apiDriver.getPolicy('corrupted-policy')).rejects.toThrow();

            // Clean up
            await firestore.collection(FirestoreCollections.POLICIES).doc('corrupted-policy').delete();
        });

        it('should handle missing version data gracefully', async () => {
            const firestore = firestoreDb;

            // Create a policy with invalid version reference
            await firestore.collection(FirestoreCollections.POLICIES).doc('invalid-version').set({
                id: 'invalid-version',
                policyName: 'Invalid Version Policy',
                currentVersionHash: 'non-existent-hash',
                versions: {},
            });

            // The API returns an error when the version doesn't exist
            await expect(apiDriver.getPolicy('invalid-version')).rejects.toThrow();

            // Clean up
            await firestore.collection(FirestoreCollections.POLICIES).doc('invalid-version').delete();
        });
    });
});

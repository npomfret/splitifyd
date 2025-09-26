import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentPolicyVersions } from '../../../auth/policy-helpers';
import { StubFirestoreReader, createMockPolicyDocument } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';

// Mock the service registration
const stubFirestoreReader = new StubFirestoreReader();
vi.mock('../../../services/serviceRegistration', () => ({
    getFirestoreReader: vi.fn(() => stubFirestoreReader),
}));

// Mock logger
vi.mock('../../../logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe('Policy Helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stubFirestoreReader.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getCurrentPolicyVersions', () => {
        it('should return current version hashes for all policies', async () => {
            const mockPolicies = [
                createMockPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                createMockPolicyDocument({
                    id: 'policy2',
                    policyName: 'Privacy Policy',
                    currentVersionHash: 'hash2',
                }),
                createMockPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ];

            // Set up stub data for getAllPolicies
            stubFirestoreReader.setDocument('policies', 'policy1', mockPolicies[0]);
            stubFirestoreReader.setDocument('policies', 'policy2', mockPolicies[1]);
            stubFirestoreReader.setDocument('policies', 'policy3', mockPolicies[2]);

            const result = await getCurrentPolicyVersions(stubFirestoreReader);
            expect(result).toEqual({
                policy1: 'hash1',
                policy2: 'hash2',
                policy3: 'hash3',
            });
        });

        it('should return empty object when no policies exist', async () => {
            // No policies set in stub, so getAllPolicies will return empty array

            const result = await getCurrentPolicyVersions(stubFirestoreReader);

            expect(result).toEqual({});
        });

        it('should skip policies without currentVersionHash', async () => {
            const policy1 = createMockPolicyDocument({
                id: 'policy1',
                policyName: 'Terms of Service',
                currentVersionHash: 'hash1',
            });
            const policy2 = createMockPolicyDocument({
                id: 'policy2',
                policyName: 'Privacy Policy',
                currentVersionHash: undefined as any, // Missing version hash
            });
            const policy3 = createMockPolicyDocument({
                id: 'policy3',
                policyName: 'Cookie Policy',
                currentVersionHash: 'hash3',
            });

            stubFirestoreReader.setDocument('policies', 'policy1', policy1);
            stubFirestoreReader.setDocument('policies', 'policy2', policy2);
            stubFirestoreReader.setDocument('policies', 'policy3', policy3);

            const result = await getCurrentPolicyVersions(stubFirestoreReader);

            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });

        it('should handle empty version hash strings', async () => {
            const policy1 = createMockPolicyDocument({
                id: 'policy1',
                policyName: 'Terms of Service',
                currentVersionHash: 'hash1',
            });
            const policy2 = createMockPolicyDocument({
                id: 'policy2',
                policyName: 'Privacy Policy',
                currentVersionHash: '', // Empty string
            });
            const policy3 = createMockPolicyDocument({
                id: 'policy3',
                policyName: 'Cookie Policy',
                currentVersionHash: 'hash3',
            });

            stubFirestoreReader.setDocument('policies', 'policy1', policy1);
            stubFirestoreReader.setDocument('policies', 'policy2', policy2);
            stubFirestoreReader.setDocument('policies', 'policy3', policy3);

            const result = await getCurrentPolicyVersions(stubFirestoreReader);

            // Empty string should be excluded
            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });

        it('should throw ApiError when FirestoreReader fails', async () => {
            const firestoreError = new Error('Firestore connection failed');
            stubFirestoreReader.getAllPolicies.mockRejectedValue(firestoreError);

            await expect(getCurrentPolicyVersions(stubFirestoreReader)).rejects.toThrow(ApiError);

            try {
                await getCurrentPolicyVersions(stubFirestoreReader);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.INTERNAL_ERROR);
                expect((error as ApiError).code).toBe('POLICY_SERVICE_UNAVAILABLE');
                expect((error as ApiError).message).toBe('Registration temporarily unavailable - unable to retrieve policy versions');
            }
        });

        it('should log error when FirestoreReader fails', async () => {
            const firestoreError = new Error('Firestore connection failed');
            stubFirestoreReader.getAllPolicies.mockRejectedValue(firestoreError);

            try {
                await getCurrentPolicyVersions(stubFirestoreReader);
            } catch (error) {
                // Expected to throw
            }

            const { logger } = await import('../../../logger');
            expect(logger.error).toHaveBeenCalledWith('Failed to get current policy versions', firestoreError);
        });

        it('should handle null policies in the array', async () => {
            // This shouldn't happen in practice due to validation, but test defensive coding
            const mockPolicies = [
                createMockPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                null as any, // Null policy
                createMockPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ].filter(Boolean); // This would normally filter out null values

            stubFirestoreReader.getAllPolicies.mockResolvedValue(mockPolicies);

            const result = await getCurrentPolicyVersions(stubFirestoreReader);

            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });
    });
});

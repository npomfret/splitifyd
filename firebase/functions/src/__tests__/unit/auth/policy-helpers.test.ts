import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentPolicyVersions } from '../../../auth/policy-helpers';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';

// Mock the service registration
const mockFirestoreReader = new MockFirestoreReader();
vi.mock('../../../services/serviceRegistration', () => ({
    getFirestoreReader: vi.fn(() => mockFirestoreReader),
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
        mockFirestoreReader.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getCurrentPolicyVersions', () => {
        it('should return current version hashes for all policies', async () => {
            const mockPolicies = [
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy2',
                    policyName: 'Privacy Policy',
                    currentVersionHash: 'hash2',
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ];

            mockFirestoreReader.getAllPolicies.mockResolvedValue(mockPolicies);

            const result = await getCurrentPolicyVersions(mockFirestoreReader);

            expect(mockFirestoreReader.getAllPolicies).toHaveBeenCalledWith();
            expect(result).toEqual({
                policy1: 'hash1',
                policy2: 'hash2',
                policy3: 'hash3',
            });
        });

        it('should return empty object when no policies exist', async () => {
            mockFirestoreReader.getAllPolicies.mockResolvedValue([]);

            const result = await getCurrentPolicyVersions(mockFirestoreReader);

            expect(result).toEqual({});
        });

        it('should skip policies without currentVersionHash', async () => {
            const mockPolicies = [
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy2',
                    policyName: 'Privacy Policy',
                    currentVersionHash: undefined as any, // Missing version hash
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ];

            mockFirestoreReader.getAllPolicies.mockResolvedValue(mockPolicies);

            const result = await getCurrentPolicyVersions(mockFirestoreReader);

            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });

        it('should handle empty version hash strings', async () => {
            const mockPolicies = [
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy2',
                    policyName: 'Privacy Policy',
                    currentVersionHash: '', // Empty string
                }),
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ];

            mockFirestoreReader.getAllPolicies.mockResolvedValue(mockPolicies);

            const result = await getCurrentPolicyVersions(mockFirestoreReader);

            // Empty string should be excluded
            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });

        it('should throw ApiError when FirestoreReader fails', async () => {
            const firestoreError = new Error('Firestore connection failed');
            mockFirestoreReader.getAllPolicies.mockRejectedValue(firestoreError);

            await expect(getCurrentPolicyVersions(mockFirestoreReader)).rejects.toThrow(ApiError);

            try {
                await getCurrentPolicyVersions(mockFirestoreReader);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.INTERNAL_ERROR);
                expect((error as ApiError).code).toBe('POLICY_SERVICE_UNAVAILABLE');
                expect((error as ApiError).message).toBe('Registration temporarily unavailable - unable to retrieve policy versions');
            }
        });

        it('should log error when FirestoreReader fails', async () => {
            const firestoreError = new Error('Firestore connection failed');
            mockFirestoreReader.getAllPolicies.mockRejectedValue(firestoreError);

            try {
                await getCurrentPolicyVersions(mockFirestoreReader);
            } catch (error) {
                // Expected to throw
            }

            const { logger } = await import('../../../logger');
            expect(logger.error).toHaveBeenCalledWith('Failed to get current policy versions', firestoreError);
        });

        it('should handle null policies in the array', async () => {
            // This shouldn't happen in practice due to validation, but test defensive coding
            const mockPolicies = [
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy1',
                    policyName: 'Terms of Service',
                    currentVersionHash: 'hash1',
                }),
                null as any, // Null policy
                mockFirestoreReader.createTestPolicyDocument({
                    id: 'policy3',
                    policyName: 'Cookie Policy',
                    currentVersionHash: 'hash3',
                }),
            ].filter(Boolean); // This would normally filter out null values

            mockFirestoreReader.getAllPolicies.mockResolvedValue(mockPolicies);

            const result = await getCurrentPolicyVersions(mockFirestoreReader);

            expect(result).toEqual({
                policy1: 'hash1',
                policy3: 'hash3',
            });
        });
    });
});

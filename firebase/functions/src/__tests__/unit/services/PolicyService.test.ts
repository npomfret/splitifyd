import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { PolicyService } from '../../../services/PolicyService';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { PolicyDocument, PolicyVersion } from '@splitifyd/shared';

// Mock the logger to prevent console output during tests
vi.mock('../../../logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('PolicyService - Unit Tests', () => {
    let policyService: PolicyService;
    let mockFirestoreReader: IFirestoreReader;
    let mockFirestoreWriter: IFirestoreWriter;

    const mockPolicy: PolicyDocument = {
        id: 'test-policy',
        policyName: 'Test Policy',
        currentVersionHash: 'abc123',
        versions: {
            'abc123': {
                text: 'This is a test policy.',
                createdAt: '2023-01-01T00:00:00.000Z',
            },
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
    };

    const mockWriteResult: WriteResult = {
        id: 'test-policy',
        success: true,
        timestamp: undefined,
    };

    beforeEach(() => {
        // Create mock implementations
        mockFirestoreReader = {
            getAllPolicies: vi.fn(),
            getPolicy: vi.fn(),
            getRawPolicyDocument: vi.fn(),
        } as any;

        mockFirestoreWriter = {
            createPolicy: vi.fn(),
            updatePolicy: vi.fn(),
            deletePolicy: vi.fn(),
        } as any;

        // Create service with mocked dependencies
        policyService = new PolicyService(mockFirestoreReader, mockFirestoreWriter);
    });

    describe('listPolicies', () => {
        it('should return list of policies with count', async () => {
            // Arrange
            const mockPolicies = [mockPolicy];
            (mockFirestoreReader.getAllPolicies as MockedFunction<any>).mockResolvedValue(mockPolicies);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: mockPolicies,
                count: 1,
            });
            expect(mockFirestoreReader.getAllPolicies).toHaveBeenCalledOnce();
        });

        it('should handle empty policy list', async () => {
            // Arrange
            (mockFirestoreReader.getAllPolicies as MockedFunction<any>).mockResolvedValue([]);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: [],
                count: 0,
            });
        });

        it('should handle errors from firestore reader', async () => {
            // Arrange
            (mockFirestoreReader.getAllPolicies as MockedFunction<any>).mockRejectedValue(
                new Error('Firestore error')
            );

            // Act & Assert
            await expect(policyService.listPolicies()).rejects.toThrow(ApiError);
        });
    });

    describe('getPolicy', () => {
        it('should return policy when found', async () => {
            // Arrange
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(mockPolicy);

            // Act
            const result = await policyService.getPolicy('test-policy');

            // Assert
            expect(result).toEqual(mockPolicy);
            expect(mockFirestoreReader.getPolicy).toHaveBeenCalledWith('test-policy');
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(null);

            // Act & Assert
            await expect(policyService.getPolicy('nonexistent')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                })
            );
        });
    });

    describe('createPolicy', () => {
        it('should create new policy successfully', async () => {
            // Arrange
            const policyName = 'New Policy';
            const text = 'Policy text content';
            
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue(null);
            (mockFirestoreWriter.createPolicy as MockedFunction<any>).mockResolvedValue(mockWriteResult);

            // Act
            const result = await policyService.createPolicy(policyName, text);

            // Assert
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('currentVersionHash');
            expect(mockFirestoreWriter.createPolicy).toHaveBeenCalled();
        });

        it('should throw CONFLICT when policy already exists', async () => {
            // Arrange
            const policyName = 'Existing Policy';
            const text = 'Policy text';
            
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: 'existing',
                exists: true,
            });

            // Act & Assert
            await expect(policyService.createPolicy(policyName, text)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                })
            );
        });

        it('should throw BAD_REQUEST when missing required fields', async () => {
            // Act & Assert
            await expect(policyService.createPolicy('', 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                })
            );

            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                })
            );
        });
    });

    describe('updatePolicy', () => {
        it('should update policy and create new version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const newText = 'Updated policy text';
            
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: policyId,
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: 'abc123',
                    versions: {
                        'abc123': {
                            text: 'Original text',
                            createdAt: '2023-01-01T00:00:00.000Z',
                        },
                    },
                }),
            });
            (mockFirestoreWriter.updatePolicy as MockedFunction<any>).mockResolvedValue(mockWriteResult);

            // Act
            const result = await policyService.updatePolicy(policyId, newText);

            // Assert
            expect(result).toHaveProperty('versionHash');
            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalled();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue(null);

            // Act & Assert
            await expect(policyService.updatePolicy('nonexistent', 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                })
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'def456';
            
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: policyId,
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: 'abc123',
                    versions: {
                        'abc123': { text: 'Old version', createdAt: '2023-01-01T00:00:00.000Z' },
                        'def456': { text: 'New version', createdAt: '2023-01-02T00:00:00.000Z' },
                    },
                }),
            });
            (mockFirestoreWriter.updatePolicy as MockedFunction<any>).mockResolvedValue(mockWriteResult);

            // Act
            const result = await policyService.publishPolicy(policyId, versionHash);

            // Assert
            expect(result).toEqual({ currentVersionHash: versionHash });
            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalledWith(
                policyId,
                expect.objectContaining({
                    currentVersionHash: versionHash,
                })
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const nonexistentHash = 'nonexistent';
            
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: policyId,
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: 'abc123',
                    versions: {
                        'abc123': { text: 'Only version', createdAt: '2023-01-01T00:00:00.000Z' },
                    },
                }),
            });

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, nonexistentHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                })
            );
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific policy version', async () => {
            // Arrange
            const versionHash = 'abc123';
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(mockPolicy);

            // Act
            const result = await policyService.getPolicyVersion('test-policy', versionHash);

            // Assert
            expect(result).toEqual({
                versionHash,
                text: 'This is a test policy.',
                createdAt: '2023-01-01T00:00:00.000Z',
            });
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(mockPolicy);

            // Act & Assert
            await expect(policyService.getPolicyVersion('test-policy', 'nonexistent')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                })
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should delete non-current version successfully', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionToDelete = 'old-version';
            
            const mockPolicyWithMultipleVersions = {
                id: policyId,
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: 'current-version',
                    versions: {
                        'current-version': { text: 'Current', createdAt: '2023-01-02T00:00:00.000Z' },
                        'old-version': { text: 'Old', createdAt: '2023-01-01T00:00:00.000Z' },
                    },
                }),
            };

            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue(
                mockPolicyWithMultipleVersions
            );
            (mockFirestoreWriter.updatePolicy as MockedFunction<any>).mockResolvedValue(mockWriteResult);

            // Act
            await policyService.deletePolicyVersion(policyId, versionToDelete);

            // Assert
            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalledWith(
                policyId,
                expect.objectContaining({
                    versions: expect.not.objectContaining({
                        'old-version': expect.anything(),
                    }),
                })
            );
        });

        it('should throw BAD_REQUEST when trying to delete current version', async () => {
            // Arrange
            const currentVersion = 'abc123';
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: 'test-policy',
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: currentVersion,
                    versions: {
                        [currentVersion]: { text: 'Current', createdAt: '2023-01-01T00:00:00.000Z' },
                    },
                }),
            });

            // Act & Assert
            await expect(policyService.deletePolicyVersion('test-policy', currentVersion)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                })
            );
        });

        it('should throw BAD_REQUEST when trying to delete the only version', async () => {
            // Arrange
            const onlyVersion = 'abc123';
            (mockFirestoreReader.getRawPolicyDocument as MockedFunction<any>).mockResolvedValue({
                id: 'test-policy',
                exists: true,
                data: () => ({
                    policyName: 'Test Policy',
                    currentVersionHash: onlyVersion,
                    versions: {
                        [onlyVersion]: { text: 'Only version', createdAt: '2023-01-01T00:00:00.000Z' },
                    },
                }),
            });

            // Act & Assert
            // When the only version is also the current version, it throws CANNOT_DELETE_CURRENT first
            await expect(policyService.deletePolicyVersion('test-policy', onlyVersion)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                })
            );
        });
    });

    describe('getCurrentPolicies', () => {
        it('should return current versions of all policies', async () => {
            // Arrange
            const mockPolicies = [
                mockPolicy,
                {
                    ...mockPolicy,
                    id: 'policy-2',
                    policyName: 'Another Policy',
                    currentVersionHash: 'def456',
                },
            ];
            (mockFirestoreReader.getAllPolicies as MockedFunction<any>).mockResolvedValue(mockPolicies);

            // Act
            const result = await policyService.getCurrentPolicies();

            // Assert
            expect(result).toEqual({
                policies: {
                    'test-policy': {
                        policyName: 'Test Policy',
                        currentVersionHash: 'abc123',
                    },
                    'policy-2': {
                        policyName: 'Another Policy',
                        currentVersionHash: 'def456',
                    },
                },
                count: 2,
            });
        });

        it('should filter out policies with missing required fields', async () => {
            // Arrange
            const mockPoliciesWithInvalid = [
                mockPolicy,
                {
                    id: 'invalid-policy',
                    policyName: '', // Missing policy name
                    currentVersionHash: 'abc123',
                    versions: {},
                    createdAt: '2023-01-01T00:00:00.000Z',
                    updatedAt: '2023-01-01T00:00:00.000Z',
                },
            ];
            (mockFirestoreReader.getAllPolicies as MockedFunction<any>).mockResolvedValue(mockPoliciesWithInvalid);

            // Act
            const result = await policyService.getCurrentPolicies();

            // Assert
            expect(result).toEqual({
                policies: {
                    'test-policy': {
                        policyName: 'Test Policy',
                        currentVersionHash: 'abc123',
                    },
                },
                count: 1,
            });
        });
    });

    describe('getCurrentPolicy', () => {
        it('should return current policy version with text', async () => {
            // Arrange
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(mockPolicy);

            // Act
            const result = await policyService.getCurrentPolicy('test-policy');

            // Assert
            expect(result).toEqual({
                id: 'test-policy',
                policyName: 'Test Policy',
                currentVersionHash: 'abc123',
                text: 'This is a test policy.',
                createdAt: '2023-01-01T00:00:00.000Z',
            });
        });

        it('should throw error when current version is missing', async () => {
            // Arrange
            const corruptPolicy = {
                ...mockPolicy,
                currentVersionHash: 'missing-version',
            };
            (mockFirestoreReader.getPolicy as MockedFunction<any>).mockResolvedValue(corruptPolicy);

            // Act & Assert
            await expect(policyService.getCurrentPolicy('test-policy')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.INTERNAL_ERROR,
                    code: 'VERSION_NOT_FOUND',
                })
            );
        });
    });
});
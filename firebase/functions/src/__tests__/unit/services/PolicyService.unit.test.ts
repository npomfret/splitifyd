import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { PolicyService } from '../../../services/PolicyService';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import {
    createMockFirestoreReader,
    createMockFirestoreWriter,
    createMockWriteResult,
    createMockWriteResultFailure,
    createMockPolicyDocument,
    createMockDocumentSnapshot
} from '../mocks/firestore.mocks';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import type { IFirestoreWriter } from '../../../services/firestore/IFirestoreWriter';

describe('PolicyService - Unit Tests', () => {
    let policyService: PolicyService;
    let mockFirestoreReader: IFirestoreReader;
    let mockFirestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        mockFirestoreReader = createMockFirestoreReader();
        mockFirestoreWriter = createMockFirestoreWriter();
        policyService = new PolicyService(mockFirestoreReader, mockFirestoreWriter);
    });

    describe('createPolicy', () => {
        it('should create a new policy with correct hash and structure', async () => {
            // Arrange
            const policyName = 'Test Privacy Policy';
            const policyText = 'This is the privacy policy content.';
            const expectedHash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');
            const expectedId = 'test-privacy-policy'; // Generated from policy name

            // Mock that no existing policy exists
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(null);
            vi.mocked(mockFirestoreWriter.createPolicy).mockResolvedValue(createMockWriteResult(expectedId));

            // Act
            const result = await policyService.createPolicy(policyName, policyText);

            // Assert
            expect(result).toEqual({
                id: expectedId,
                currentVersionHash: expectedHash,
            });

            expect(mockFirestoreReader.getRawPolicyDocument).toHaveBeenCalledWith(expectedId);
            expect(mockFirestoreWriter.createPolicy).toHaveBeenCalledWith(
                expectedId,
                expect.objectContaining({
                    policyName,
                    currentVersionHash: expectedHash,
                    versions: {
                        [expectedHash]: expect.objectContaining({
                            text: policyText,
                            createdAt: expect.any(String),
                        }),
                    },
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                })
            );
        });

        it('should handle firestore write failures', async () => {
            // Arrange
            const policyName = 'Test Policy';
            const policyText = 'Policy content';
            const expectedId = 'test-policy';

            // Mock that no existing policy exists
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(null);
            // Mock firestore write failure
            const firestoreError = new Error('Firestore write failed');
            vi.mocked(mockFirestoreWriter.createPolicy).mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(policyService.createPolicy(policyName, policyText))
                .rejects.toThrow(ApiError);
        });

        it('should generate different hashes for different content', async () => {
            // Arrange
            const policyName = 'Test Policy';
            const policyText1 = 'First version of policy';
            const policyText2 = 'Second version of policy';
            const mockPolicyId = 'policy-123';

            const expectedHash1 = crypto.createHash('sha256').update(policyText1, 'utf8').digest('hex');
            const expectedHash2 = crypto.createHash('sha256').update(policyText2, 'utf8').digest('hex');

            vi.mocked(mockFirestoreWriter.generateDocumentId).mockReturnValue(mockPolicyId);
            vi.mocked(mockFirestoreWriter.createPolicy).mockResolvedValue(createMockWriteResult(mockPolicyId));

            // Act
            const result1 = await policyService.createPolicy(policyName, policyText1);
            const result2 = await policyService.createPolicy(policyName, policyText2);

            // Assert
            expect(result1.currentVersionHash).toBe(expectedHash1);
            expect(result2.currentVersionHash).toBe(expectedHash2);
            expect(result1.currentVersionHash).not.toBe(result2.currentVersionHash);
        });
    });

    describe('getPolicy', () => {
        it('should retrieve an existing policy', async () => {
            // Arrange
            const policyId = 'policy-123';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Privacy Policy',
            });

            vi.mocked(mockFirestoreReader.getPolicy).mockResolvedValue(mockPolicy);

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(mockPolicy);
            expect(mockFirestoreReader.getPolicy).toHaveBeenCalledWith(policyId);
        });

        it('should throw ApiError when policy not found', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            vi.mocked(mockFirestoreReader.getPolicy).mockResolvedValue(null);

            // Act & Assert
            await expect(policyService.getPolicy(policyId))
                .rejects.toThrow(new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found'));

            expect(mockFirestoreReader.getPolicy).toHaveBeenCalledWith(policyId);
        });

        it('should handle firestore read failures', async () => {
            // Arrange
            const policyId = 'policy-123';
            const firestoreError = new Error('Firestore read failed');
            vi.mocked(mockFirestoreReader.getPolicy).mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(policyService.getPolicy(policyId))
                .rejects.toThrow(new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_GET_FAILED', 'Failed to retrieve policy'));
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
            // Arrange
            const mockPolicies = [
                createMockPolicyDocument({ id: 'policy-1', policyName: 'Privacy Policy' }),
                createMockPolicyDocument({ id: 'policy-2', policyName: 'Terms of Service' }),
                createMockPolicyDocument({ id: 'policy-3', policyName: 'Cookie Policy' }),
            ];

            vi.mocked(mockFirestoreReader.getAllPolicies).mockResolvedValue(mockPolicies);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: mockPolicies,
                count: 3,
            });
            expect(mockFirestoreReader.getAllPolicies).toHaveBeenCalledOnce();
        });

        it('should return empty array when no policies exist', async () => {
            // Arrange
            vi.mocked(mockFirestoreReader.getAllPolicies).mockResolvedValue([]);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: [],
                count: 0,
            });
        });

        it('should handle firestore read failures', async () => {
            // Arrange
            const firestoreError = new Error('Firestore read failed');
            vi.mocked(mockFirestoreReader.getAllPolicies).mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(policyService.listPolicies())
                .rejects.toThrow(new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_LIST_FAILED', 'Failed to retrieve policies'));
        });
    });

    describe('updatePolicy', () => {
        it('should create a draft version when published=false', async () => {
            // Arrange
            const policyId = 'policy-123';
            const originalText = 'Original policy content';
            const updatedText = 'Updated policy content';
            const originalHash = crypto.createHash('sha256').update(originalText, 'utf8').digest('hex');
            const expectedNewHash = crypto.createHash('sha256').update(updatedText, 'utf8').digest('hex');

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: originalHash,
                versions: {
                    [originalHash]: {
                        text: originalText,
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = createMockDocumentSnapshot(existingPolicyData, policyId);

            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(mockDoc);
            vi.mocked(mockFirestoreWriter.updatePolicy).mockResolvedValue(createMockWriteResult(policyId));

            // Act
            const result = await policyService.updatePolicy(policyId, updatedText, false);

            // Assert
            expect(result).toEqual({
                versionHash: expectedNewHash,
                // No currentVersionHash because it's a draft
            });

            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalledWith(
                policyId,
                expect.objectContaining({
                    versions: {
                        [originalHash]: existingPolicyData.versions[originalHash],
                        [expectedNewHash]: expect.objectContaining({
                            text: updatedText,
                            createdAt: expect.any(String),
                        }),
                    },
                    updatedAt: expect.any(Object),
                })
            );
        });

        it('should publish version when published=true', async () => {
            // Arrange
            const policyId = 'policy-123';
            const originalText = 'Original policy content';
            const updatedText = 'Updated policy content';
            const originalHash = crypto.createHash('sha256').update(originalText, 'utf8').digest('hex');
            const expectedNewHash = crypto.createHash('sha256').update(updatedText, 'utf8').digest('hex');

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: originalHash,
                versions: {
                    [originalHash]: {
                        text: originalText,
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = createMockDocumentSnapshot(existingPolicyData, policyId);
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(mockDoc);
            vi.mocked(mockFirestoreWriter.updatePolicy).mockResolvedValue(createMockWriteResult(policyId));

            // Act
            const result = await policyService.updatePolicy(policyId, updatedText, true);

            // Assert
            expect(result).toEqual({
                versionHash: expectedNewHash,
                currentVersionHash: expectedNewHash,
            });

            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalledWith(
                policyId,
                expect.objectContaining({
                    currentVersionHash: expectedNewHash,
                    versions: {
                        [originalHash]: existingPolicyData.versions[originalHash],
                        [expectedNewHash]: expect.objectContaining({
                            text: updatedText,
                            createdAt: expect.any(String),
                        }),
                    },
                    updatedAt: expect.any(Object),
                })
            );
        });

        it('should prevent creating duplicate versions', async () => {
            // Arrange
            const policyId = 'policy-123';
            const policyText = 'Policy content';
            const hash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: hash,
                versions: {
                    [hash]: {
                        text: policyText,
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = createMockDocumentSnapshot(existingPolicyData, policyId);
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(mockDoc);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, policyText, false))
                .rejects.toThrow(new ApiError(HTTP_STATUS.CONFLICT, 'VERSION_ALREADY_EXISTS', 'A version with this content already exists'));
        });

        it('should throw error when policy not found', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(null);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, 'New content', false))
                .rejects.toThrow(new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found'));
        });
    });

    describe('publishPolicy', () => {
        it('should publish an existing draft version', async () => {
            // Arrange
            const policyId = 'policy-123';
            const originalHash = 'original-hash';
            const draftHash = 'draft-hash';

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: originalHash,
                versions: {
                    [originalHash]: {
                        text: 'Original content',
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                    [draftHash]: {
                        text: 'Draft content',
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = createMockDocumentSnapshot(existingPolicyData, policyId);
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(mockDoc);
            vi.mocked(mockFirestoreWriter.updatePolicy).mockResolvedValue(createMockWriteResult(policyId));

            // Act
            const result = await policyService.publishPolicy(policyId, draftHash);

            // Assert
            expect(result).toEqual({
                currentVersionHash: draftHash,
            });

            expect(mockFirestoreWriter.updatePolicy).toHaveBeenCalledWith(
                policyId,
                expect.objectContaining({
                    currentVersionHash: draftHash,
                    updatedAt: expect.any(Timestamp),
                })
            );
        });

        it('should throw error when version does not exist', async () => {
            // Arrange
            const policyId = 'policy-123';
            const nonExistentHash = 'non-existent-hash';

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: 'existing-hash',
                versions: {
                    'existing-hash': {
                        text: 'Existing content',
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = createMockDocumentSnapshot(existingPolicyData, policyId);
            vi.mocked(mockFirestoreReader.getRawPolicyDocument).mockResolvedValue(mockDoc);

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, nonExistentHash))
                .rejects.toThrow(new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found'));
        });
    });

    describe('getCurrentPolicy', () => {
        it('should return current published version', async () => {
            // Arrange
            const policyId = 'policy-123';
            const currentHash = 'current-hash';
            const policyText = 'Current policy content';
            const createdAt = Timestamp.now();
            const createdAtISO = createdAt.toDate().toISOString();

            const policy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Privacy Policy',
                currentVersionHash: currentHash,
                versions: {
                    [currentHash]: {
                        text: policyText,
                        createdAt: createdAtISO,
                    },
                },
            });

            vi.mocked(mockFirestoreReader.getPolicy).mockResolvedValue(policy);

            // Act
            const result = await policyService.getCurrentPolicy(policyId);

            // Assert
            expect(result).toEqual({
                id: policyId,
                policyName: 'Privacy Policy',
                currentVersionHash: currentHash,
                text: policyText,
                createdAt: createdAtISO,
            });
        });

        it('should throw error when current version is missing', async () => {
            // Arrange
            const policyId = 'policy-123';
            const currentHash = 'current-hash';

            const policy = createMockPolicyDocument({
                id: policyId,
                currentVersionHash: currentHash,
                versions: {
                    'different-hash': {
                        text: 'Different content',
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            });

            vi.mocked(mockFirestoreReader.getPolicy).mockResolvedValue(policy);

            // Act & Assert
            await expect(policyService.getCurrentPolicy(policyId))
                .rejects.toThrow(new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_NOT_FOUND', 'Current policy version not found in versions map'));
        });
    });


    describe('Hash calculation', () => {
        it('should generate consistent hashes for same content', () => {
            // Arrange
            const content = 'Test policy content';
            const policyService1 = new PolicyService(mockFirestoreReader, mockFirestoreWriter);
            const policyService2 = new PolicyService(mockFirestoreReader, mockFirestoreWriter);

            // Act
            const hash1 = (policyService1 as any).calculatePolicyHash(content);
            const hash2 = (policyService2 as any).calculatePolicyHash(content);

            // Assert
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex string
        });

        it('should generate different hashes for different content', () => {
            // Arrange
            const content1 = 'First policy content';
            const content2 = 'Second policy content';

            // Act
            const hash1 = (policyService as any).calculatePolicyHash(content1);
            const hash2 = (policyService as any).calculatePolicyHash(content2);

            // Assert
            expect(hash1).not.toBe(hash2);
            expect(hash1).toHaveLength(64);
            expect(hash2).toHaveLength(64);
        });
    });
});
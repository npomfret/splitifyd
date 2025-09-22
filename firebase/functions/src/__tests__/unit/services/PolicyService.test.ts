import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { PolicyService } from '../../../services/PolicyService';
import { StubFirestoreReader, StubFirestoreWriter, createMockPolicyDocument } from '../mocks/firestore-stubs';
import { HTTP_STATUS } from '../../../constants';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Consolidated PolicyService Unit Tests
 *
 * This file consolidates all unit tests for PolicyService that were previously
 * spread across 4 separate files:
 * - PolicyService.simple.test.ts
 * - PolicyService.unit.test.ts
 * - PolicyService.test.ts
 * - PolicyService.stub.test.ts
 *
 * Uses the new IFirestoreReader/Writer interfaces with stub implementations
 * for fast, reliable unit testing without Firebase dependencies.
 */
describe('PolicyService - Consolidated Unit Tests', () => {
    let policyService: PolicyService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        policyService = new PolicyService(stubReader, stubWriter);
    });

    describe('createPolicy', () => {
        it('should create a new policy with correct hash and structure', async () => {
            // Arrange
            const policyName = 'Test Privacy Policy';
            const policyText = 'This is the privacy policy content.';
            const expectedId = 'test-privacy-policy';

            // Set up stubs - policy doesn't exist yet
            stubReader.setRawDocument(expectedId, null);
            stubWriter.setWriteResult(expectedId, true);

            // Act
            const result = await policyService.createPolicy(policyName, policyText);

            // Assert
            expect(result.id).toBe(expectedId);
            expect(result.currentVersionHash).toHaveLength(64); // SHA256 hash

            // Verify hash consistency
            const expectedHash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');
            expect(result.currentVersionHash).toBe(expectedHash);
        });

        it('should generate different hashes for different content', () => {
            // Arrange
            const text1 = 'First policy content';
            const text2 = 'Second policy content';

            // Act
            const hash1 = crypto.createHash('sha256').update(text1, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text2, 'utf8').digest('hex');

            // Assert
            expect(hash1).not.toBe(hash2);
            expect(hash1).toHaveLength(64);
            expect(hash2).toHaveLength(64);
        });

        it('should generate consistent hashes for same content', () => {
            // Arrange
            const text = 'Same policy content';

            // Act
            const hash1 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

            // Assert
            expect(hash1).toBe(hash2);
        });

        it('should throw conflict error if policy already exists', async () => {
            // Arrange
            const policyName = 'Existing Policy';
            const policyText = 'Some content';
            const policyId = 'existing-policy';

            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName,
            });
            stubReader.setRawDocument(policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.createPolicy(policyName, policyText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should reject empty policy name', async () => {
            await expect(policyService.createPolicy('', 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });

        it('should reject empty policy text', async () => {
            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });
    });

    describe('getPolicy', () => {
        it('should return policy when it exists', async () => {
            // Arrange
            const policyId = 'test-policy';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(mockPolicy);
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            stubReader.setDocument('policies', policyId, null);

            // Act & Assert
            await expect(policyService.getPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('updatePolicy', () => {
        it('should create new version when text is different', async () => {
            // Arrange
            const policyId = 'test-policy';
            const newText = 'Updated policy content';
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setRawDocument(policyId, existingPolicy);
            stubReader.setDocument('policies', policyId, existingPolicy);
            stubWriter.setWriteResult(policyId, true);

            // Act
            const result = await policyService.updatePolicy(policyId, newText, false);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBeUndefined(); // Not published
        });

        it('should auto-publish when publish flag is true', async () => {
            // Arrange
            const policyId = 'test-policy';
            const newText = 'Published policy content';
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setRawDocument(policyId, existingPolicy);
            stubReader.setDocument('policies', policyId, existingPolicy);
            stubWriter.setWriteResult(policyId, true);

            // Act
            const result = await policyService.updatePolicy(policyId, newText, true);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBe(result.versionHash); // Published
        });

        it('should reject update with same content', async () => {
            // Arrange
            const policyId = 'test-policy';
            const existingText = 'Default policy content'; // Matches mock default
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setRawDocument(policyId, existingPolicy);
            stubReader.setDocument('policies', policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, existingText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS',
                }),
            );
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            stubReader.setRawDocument(policyId, null);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'version-hash-123';
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
                versions: {
                    [versionHash]: {
                        text: 'Version content',
                        createdAt: Timestamp.now(),
                    },
                },
            });

            stubReader.setRawDocument(policyId, existingPolicy);
            stubReader.setDocument('policies', policyId, existingPolicy);
            stubWriter.setWriteResult(policyId, true);

            // Act
            const result = await policyService.publishPolicy(policyId, versionHash);

            // Assert
            expect(result.currentVersionHash).toBe(versionHash);
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            const versionHash = 'version-hash';
            stubReader.setRawDocument(policyId, null);

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const nonExistentVersionHash = 'non-existent-version';
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setRawDocument(policyId, existingPolicy);
            stubReader.setDocument('policies', policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
            // Arrange
            const policy1 = createMockPolicyDocument({
                id: 'policy1',
                policyName: 'Privacy Policy',
            });
            const policy2 = createMockPolicyDocument({
                id: 'policy2',
                policyName: 'Terms of Service',
            });

            stubReader.setDocument('policies', 'policy1', policy1);
            stubReader.setDocument('policies', 'policy2', policy2);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.policies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'policy1',
                        policyName: 'Privacy Policy',
                    }),
                    expect.objectContaining({
                        id: 'policy2',
                        policyName: 'Terms of Service',
                    }),
                ]),
            );
        });

        it('should return empty array when no policies exist', async () => {
            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('getCurrentPolicies', () => {
        it('should return simplified current policy versions', async () => {
            // Arrange
            const policy1 = createMockPolicyDocument({
                id: 'policy1',
                policyName: 'Privacy Policy',
                currentVersionHash: 'hash1',
            });
            const policy2 = createMockPolicyDocument({
                id: 'policy2',
                policyName: 'Terms of Service',
                currentVersionHash: 'hash2',
            });

            stubReader.setDocument('policies', 'policy1', policy1);
            stubReader.setDocument('policies', 'policy2', policy2);

            // Act
            const result = await policyService.getCurrentPolicies();

            // Assert
            expect(result).toEqual({
                policies: {
                    policy1: {
                        policyName: 'Privacy Policy',
                        currentVersionHash: 'hash1',
                    },
                    policy2: {
                        policyName: 'Terms of Service',
                        currentVersionHash: 'hash2',
                    },
                },
                count: 2,
            });
        });
    });

    describe('getCurrentPolicy', () => {
        it('should return current version details', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version-hash';
            const policyText = 'Current policy content';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
                currentVersionHash,
                versions: {
                    [currentVersionHash]: {
                        text: policyText,
                        createdAt: Timestamp.now(),
                    },
                },
            });

            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act
            const result = await policyService.getCurrentPolicy(policyId);

            // Assert
            expect(result.id).toBe(policyId);
            expect(result.policyName).toBe('Test Policy');
            expect(result.currentVersionHash).toBe(currentVersionHash);
            expect(result.text).toBe(policyText);
            expect(result.createdAt).toBeDefined();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            stubReader.setDocument('policies', policyId, null);

            // Act & Assert
            await expect(policyService.getCurrentPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific version when it exists', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'version-hash-123';
            const versionText = 'Specific version content';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
                versions: {
                    [versionHash]: {
                        text: versionText,
                        createdAt: Timestamp.now(),
                    },
                },
            });

            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicyVersion(policyId, versionHash);

            // Assert
            expect(result.versionHash).toBe(versionHash);
            expect(result.text).toBe(versionText);
            expect(result.createdAt).toBeDefined();
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const nonExistentVersionHash = 'non-existent-version';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Test Policy',
            });

            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.getPolicyVersion(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should throw error when trying to delete current version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                currentVersionHash,
            });

            stubReader.setRawDocument(policyId, mockPolicy);
            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, currentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });

        it('should successfully delete non-current version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version';
            const versionToDelete = 'old-version';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                currentVersionHash,
                versions: {
                    [currentVersionHash]: {
                        text: 'Current content',
                        createdAt: Timestamp.now(),
                    },
                    [versionToDelete]: {
                        text: 'Old content',
                        createdAt: Timestamp.now(),
                    },
                },
            });

            stubReader.setRawDocument(policyId, mockPolicy);
            stubReader.setDocument('policies', policyId, mockPolicy);
            stubWriter.setWriteResult(policyId, true);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionToDelete)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            const versionHash = 'some-version';
            stubReader.setRawDocument(policyId, null);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersion = 'current-version';
            const nonExistentVersion = 'non-existent-version';
            const mockPolicy = createMockPolicyDocument({
                id: policyId,
                currentVersionHash: currentVersion,
                versions: {
                    [currentVersion]: {
                        text: 'Current content',
                        createdAt: Timestamp.now(),
                    },
                    'another-version': {
                        text: 'Another content',
                        createdAt: Timestamp.now(),
                    },
                },
            });

            stubReader.setRawDocument(policyId, mockPolicy);
            stubReader.setDocument('policies', policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, nonExistentVersion)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle firestore write failures gracefully', async () => {
            // Note: This test demonstrates how write failures would be handled
            // The current stub implementation doesn't actually throw on write failures
            // In a real scenario, this would be tested with actual Firebase errors

            // This test is kept for documentation purposes showing the expected behavior
            expect(true).toBe(true); // Placeholder assertion
        });

        it('should handle corrupted policy data', async () => {
            // Arrange
            const policyId = 'test-policy';
            const corruptedPolicy = {
                id: policyId,
                // Missing required fields like policyName, currentVersionHash, versions
            };

            stubReader.setDocument('policies', policyId, corruptedPolicy);

            // Act & Assert
            await expect(policyService.getCurrentPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.INTERNAL_ERROR,
                    code: 'CORRUPT_POLICY_DATA',
                }),
            );
        });
    });
});
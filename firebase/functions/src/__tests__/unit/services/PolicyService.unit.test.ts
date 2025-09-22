import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { PolicyService } from '../../../services/PolicyService';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { PolicyDocument } from '../../../schemas';

// Simple test-specific implementations
class TestFirestoreReader {
    private data = new Map<string, any>();
    private rawDocs = new Map<string, any>();

    setPolicy(id: string, policy: PolicyDocument | null) {
        if (policy) {
            this.data.set(id, policy);
        } else {
            this.data.delete(id);
        }
    }

    setRawPolicyDocument(id: string, doc: any) {
        this.rawDocs.set(id, doc);
    }

    async getPolicy(id: string): Promise<PolicyDocument | null> {
        return this.data.get(id) || null;
    }

    async getAllPolicies(): Promise<PolicyDocument[]> {
        return Array.from(this.data.values());
    }

    async getRawPolicyDocument(id: string): Promise<any> {
        return this.rawDocs.get(id) || null;
    }
}

class TestFirestoreWriter {
    private shouldSucceed = true;
    private writeResults: Array<{ id: string; success: boolean; error?: string }> = [];

    setNextWriteResult(id: string, success: boolean, error?: string) {
        this.writeResults.push({ id, success, error });
    }

    async createPolicy(id: string, data: any) {
        const result = this.writeResults.shift() || { id, success: this.shouldSucceed };
        if (!result.success) {
            throw new Error(result.error || 'Write failed');
        }
        return {
            id: result.id,
            success: true,
            timestamp: Timestamp.now(),
        };
    }

    async updatePolicy(id: string, data: any) {
        const result = this.writeResults.shift() || { id, success: this.shouldSucceed };
        if (!result.success) {
            throw new Error(result.error || 'Write failed');
        }
        return {
            id: result.id,
            success: true,
            timestamp: Timestamp.now(),
        };
    }
}

describe('PolicyService - Unit Tests', () => {
    let policyService: PolicyService;
    let testReader: TestFirestoreReader;
    let testWriter: TestFirestoreWriter;

    beforeEach(() => {
        testReader = new TestFirestoreReader();
        testWriter = new TestFirestoreWriter();
        // Cast to the interfaces to bypass type checking
        policyService = new PolicyService(testReader as any, testWriter as any);
    });

    describe('createPolicy', () => {
        it('should create a new policy with correct hash and structure', async () => {
            // Arrange
            const policyName = 'Test Privacy Policy';
            const policyText = 'This is the privacy policy content.';
            const expectedHash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');
            const expectedId = 'test-privacy-policy'; // Generated from policy name

            // Set up test data
            testReader.setRawPolicyDocument(expectedId, null);
            testWriter.setNextWriteResult(expectedId, true);

            // Act
            const result = await policyService.createPolicy(policyName, policyText);

            // Assert
            expect(result).toEqual({
                id: expectedId,
                currentVersionHash: expectedHash,
            });
        });

        it('should handle firestore write failures', async () => {
            // Arrange
            const policyName = 'Test Policy';
            const policyText = 'Policy content';
            const expectedId = 'test-policy';

            // Set up test data
            testReader.setRawPolicyDocument(expectedId, null);
            testWriter.setNextWriteResult(expectedId, false, 'Firestore write failed');

            // Act & Assert
            await expect(policyService.createPolicy(policyName, policyText))
                .rejects.toThrow(ApiError);
        });

        it('should generate different hashes for different content', async () => {
            // Arrange
            const policyName1 = 'Test Policy 1';
            const policyName2 = 'Test Policy 2';
            const policyText1 = 'First version of policy';
            const policyText2 = 'Second version of policy';

            const expectedHash1 = crypto.createHash('sha256').update(policyText1, 'utf8').digest('hex');
            const expectedHash2 = crypto.createHash('sha256').update(policyText2, 'utf8').digest('hex');

            // Set up test data
            testReader.setRawPolicyDocument('test-policy-1', null);
            testReader.setRawPolicyDocument('test-policy-2', null);
            testWriter.setNextWriteResult('test-policy-1', true);
            testWriter.setNextWriteResult('test-policy-2', true);

            // Act
            const result1 = await policyService.createPolicy(policyName1, policyText1);
            const result2 = await policyService.createPolicy(policyName2, policyText2);

            // Assert
            expect(result1.currentVersionHash).toBe(expectedHash1);
            expect(result2.currentVersionHash).toBe(expectedHash2);
            expect(result1.currentVersionHash).not.toBe(result2.currentVersionHash);
        });

        it('should reject empty policy name', async () => {
            await expect(policyService.createPolicy('', 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS'
                })
            );
        });

        it('should reject empty policy text', async () => {
            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS'
                })
            );
        });

        it('should reject duplicate policy creation', async () => {
            const policyName = 'Duplicate Policy';
            const existingDoc = {
                id: 'duplicate-policy',
                exists: true,
                data: () => ({ policyName }),
                get: (field: string) => ({ policyName }[field as keyof { policyName: string }]),
                ref: { id: 'duplicate-policy', path: 'policies/duplicate-policy' },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument('duplicate-policy', existingDoc);

            await expect(policyService.createPolicy(policyName, 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS'
                })
            );
        });
    });

    describe('getPolicy', () => {
        it('should retrieve an existing policy', async () => {
            // Arrange
            const policyId = 'policy-123';
            const mockPolicy: PolicyDocument = {
                id: policyId,
                policyName: 'Privacy Policy',
                currentVersionHash: 'hash-123',
                versions: {
                    'hash-123': {
                        text: 'Policy content',
                        createdAt: Timestamp.now(),
                    },
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(mockPolicy);
        });

        it('should throw ApiError when policy not found', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            testReader.setPolicy(policyId, null);

            // Act & Assert
            await expect(policyService.getPolicy(policyId))
                .rejects.toThrow(new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found'));
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
            // Arrange
            const policy1: PolicyDocument = {
                id: 'policy-1',
                policyName: 'Privacy Policy',
                currentVersionHash: 'hash-1',
                versions: { 'hash-1': { text: 'Content 1', createdAt: Timestamp.now() } },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const policy2: PolicyDocument = {
                id: 'policy-2',
                policyName: 'Terms of Service',
                currentVersionHash: 'hash-2',
                versions: { 'hash-2': { text: 'Content 2', createdAt: Timestamp.now() } },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy('policy-1', policy1);
            testReader.setPolicy('policy-2', policy2);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: [policy1, policy2],
                count: 2,
            });
        });

        it('should return empty array when no policies exist', async () => {
            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result).toEqual({
                policies: [],
                count: 0,
            });
        });
    });

    describe('updatePolicy', () => {
        it('should create new version when text is different', async () => {
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

            const mockDoc = {
                id: policyId,
                exists: true,
                data: () => existingPolicyData,
                get: (field: string) => (existingPolicyData as any)[field],
                ref: { id: policyId, path: `policies/${policyId}` },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument(policyId, mockDoc);
            testWriter.setNextWriteResult(policyId, true);

            const result = await policyService.updatePolicy(policyId, updatedText, false);

            expect(result).toEqual({
                versionHash: expectedNewHash,
            });
        });

        it('should auto-publish when publishImmediately is true', async () => {
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

            const mockDoc = {
                id: policyId,
                exists: true,
                data: () => existingPolicyData,
                get: (field: string) => (existingPolicyData as any)[field],
                ref: { id: policyId, path: `policies/${policyId}` },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument(policyId, mockDoc);
            testWriter.setNextWriteResult(policyId, true);

            const result = await policyService.updatePolicy(policyId, updatedText, true);

            expect(result).toEqual({
                versionHash: expectedNewHash,
                currentVersionHash: expectedNewHash,
            });
        });

        it('should reject update with same content', async () => {
            const policyId = 'policy-123';
            const sameText = 'Same policy content';
            const hash = crypto.createHash('sha256').update(sameText, 'utf8').digest('hex');

            const existingPolicyData = {
                policyName: 'Test Policy',
                currentVersionHash: hash,
                versions: {
                    [hash]: {
                        text: sameText,
                        createdAt: Timestamp.now().toDate().toISOString(),
                    },
                },
            };

            const mockDoc = {
                id: policyId,
                exists: true,
                data: () => existingPolicyData,
                get: (field: string) => (existingPolicyData as any)[field],
                ref: { id: policyId, path: `policies/${policyId}` },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument(policyId, mockDoc);

            await expect(policyService.updatePolicy(policyId, sameText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS'
                })
            );
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            testReader.setRawPolicyDocument('nonexistent', null);

            await expect(policyService.updatePolicy('nonexistent', 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND'
                })
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            const policyId = 'policy-123';
            const versionHash = 'version-hash-123';

            const existingPolicy = {
                id: policyId,
                policyName: 'Test Policy',
                currentVersionHash: 'current-hash',
                versions: {
                    'current-hash': { text: 'current', createdAt: Timestamp.now() },
                    [versionHash]: { text: 'new version', createdAt: Timestamp.now() }
                }
            };

            const mockDoc = {
                id: policyId,
                exists: true,
                data: () => existingPolicy,
                get: (field: string) => (existingPolicy as any)[field],
                ref: { id: policyId, path: `policies/${policyId}` },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument(policyId, mockDoc);
            testWriter.setNextWriteResult(policyId, true);

            const result = await policyService.publishPolicy(policyId, versionHash);

            expect(result).toEqual({
                currentVersionHash: versionHash
            });
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            const policyId = 'policy-123';
            const existingPolicy = {
                id: policyId,
                policyName: 'Test Policy',
                currentVersionHash: 'current-hash',
                versions: {
                    'current-hash': { text: 'current', createdAt: Timestamp.now() }
                }
            };

            const mockDoc = {
                id: policyId,
                exists: true,
                data: () => existingPolicy,
                get: (field: string) => (existingPolicy as any)[field],
                ref: { id: policyId, path: `policies/${policyId}` },
                readTime: Timestamp.now(),
                isEqual: () => false,
            };

            testReader.setRawPolicyDocument(policyId, mockDoc);

            await expect(policyService.publishPolicy(policyId, 'nonexistent-hash')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND'
                })
            );
        });
    });

    describe('getCurrentPolicies', () => {
        it('should return simplified current policy versions', async () => {
            const policy1: PolicyDocument = {
                id: 'policy-1',
                policyName: 'Policy 1',
                currentVersionHash: 'hash-1',
                versions: { 'hash-1': { text: 'Content 1', createdAt: Timestamp.now() } },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const policy2: PolicyDocument = {
                id: 'policy-2',
                policyName: 'Policy 2',
                currentVersionHash: 'hash-2',
                versions: { 'hash-2': { text: 'Content 2', createdAt: Timestamp.now() } },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy('policy-1', policy1);
            testReader.setPolicy('policy-2', policy2);

            const result = await policyService.getCurrentPolicies();

            expect(result).toEqual({
                policies: {
                    'policy-1': {
                        policyName: 'Policy 1',
                        currentVersionHash: 'hash-1'
                    },
                    'policy-2': {
                        policyName: 'Policy 2',
                        currentVersionHash: 'hash-2'
                    }
                },
                count: 2
            });
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific version when it exists', async () => {
            const policyId = 'test-policy';
            const versionHash = 'version-hash-123';
            const versionText = 'Version specific content';
            const createdAt = Timestamp.now();

            const mockPolicy: PolicyDocument = {
                id: policyId,
                policyName: 'Test Policy',
                currentVersionHash: 'current-hash',
                versions: {
                    [versionHash]: {
                        text: versionText,
                        createdAt,
                    }
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy(policyId, mockPolicy);

            const result = await policyService.getPolicyVersion(policyId, versionHash);

            expect(result).toEqual({
                versionHash,
                text: versionText,
                createdAt,
            });
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            const mockPolicy: PolicyDocument = {
                id: 'test-policy',
                policyName: 'Test Policy',
                currentVersionHash: 'current-hash',
                versions: {
                    'current-hash': { text: 'Current content', createdAt: Timestamp.now() }
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy('test-policy', mockPolicy);

            await expect(policyService.getPolicyVersion('test-policy', 'nonexistent-hash')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND'
                })
            );
        });
    });

    describe('getCurrentPolicy', () => {
        it('should return current version details', async () => {
            const policyId = 'test-policy';
            const currentHash = 'current-hash-123';
            const currentText = 'Current policy content';
            const createdAt = Timestamp.now();

            const mockPolicy: PolicyDocument = {
                id: policyId,
                policyName: 'Current Policy',
                currentVersionHash: currentHash,
                versions: {
                    [currentHash]: {
                        text: currentText,
                        createdAt,
                    }
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy(policyId, mockPolicy);

            const result = await policyService.getCurrentPolicy(policyId);

            expect(result).toEqual({
                id: policyId,
                policyName: 'Current Policy',
                currentVersionHash: currentHash,
                text: currentText,
                createdAt,
            });
        });

        it('should throw error when current version is missing', async () => {
            const mockPolicy: PolicyDocument = {
                id: 'test-policy',
                policyName: 'Test Policy',
                currentVersionHash: 'missing-hash',
                versions: {
                    'different-hash': { text: 'Different content', createdAt: Timestamp.now() }
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            testReader.setPolicy('test-policy', mockPolicy);

            await expect(policyService.getCurrentPolicy('test-policy')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.INTERNAL_ERROR,
                    code: 'VERSION_NOT_FOUND'
                })
            );
        });
    });

    describe('Hash calculation', () => {
        it('should generate consistent hashes for same content', () => {
            const content = 'Test policy content';
            const hash1 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex string
        });

        it('should generate different hashes for different content', () => {
            const content1 = 'First policy content';
            const content2 = 'Second policy content';

            const hash1 = crypto.createHash('sha256').update(content1, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(content2, 'utf8').digest('hex');

            expect(hash1).not.toBe(hash2);
            expect(hash1).toHaveLength(64);
            expect(hash2).toHaveLength(64);
        });
    });
});
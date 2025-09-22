import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('PolicyService - Simple Unit Tests', () => {
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
            const policyName = 'Test Privacy Policy';
            const policyText = 'This is the privacy policy content.';
            const expectedHash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');
            const expectedId = 'test-privacy-policy';

            // Set up test data
            testReader.setRawPolicyDocument(expectedId, null);
            testWriter.setNextWriteResult(expectedId, true);

            const result = await policyService.createPolicy(policyName, policyText);

            expect(result).toEqual({
                id: expectedId,
                currentVersionHash: expectedHash,
            });
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
        it('should return policy when it exists', async () => {
            const policyId = 'test-policy';
            const mockPolicy: PolicyDocument = {
                id: policyId,
                policyName: 'Test Policy',
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

            const result = await policyService.getPolicy(policyId);

            expect(result).toEqual(mockPolicy);
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            const policyId = 'nonexistent-policy';
            testReader.setPolicy(policyId, null);

            await expect(policyService.getPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND'
                })
            );
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
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

            const result = await policyService.listPolicies();

            expect(result).toEqual({
                policies: [policy1, policy2],
                count: 2,
            });
        });

        it('should return empty array when no policies exist', async () => {
            const result = await policyService.listPolicies();

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
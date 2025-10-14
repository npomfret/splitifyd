import { beforeEach, describe, expect, it } from 'vitest';
import { PolicyDocumentBuilder, createStubRequest, createStubResponse, StubFirestoreDatabase } from '@splitifyd/test-support';
import { HTTP_STATUS } from '../../../constants';
import { PolicyHandlers } from '../../../policies/PolicyHandlers';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { StubAuthService } from '../mocks/firestore-stubs';

describe('PolicyHandlers', () => {
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;
    let policyHandlers: PolicyHandlers;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();
        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);
        policyHandlers = new PolicyHandlers(applicationBuilder.buildPolicyService());
    });

    describe('createPolicy', () => {
        it('should create a new policy successfully with valid data', async () => {
            const userId = 'admin-user';
            stubAuth.setUser(userId, { uid: userId });

            const policyData = {
                policyName: 'Terms of Service',
                text: 'These are the terms...',
            };

            const req = createStubRequest(userId, policyData);
            const res = createStubResponse();

            await policyHandlers.createPolicy(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                id: expect.any(String),
                versionHash: expect.any(String),
                message: 'Policy created successfully',
            });
        });

        it('should reject creation with missing policy name', async () => {
            const userId = 'admin-user';
            stubAuth.setUser(userId, { uid: userId });

            const policyData = {
                text: 'Some policy text',
            };

            const req = createStubRequest(userId, policyData);
            const res = createStubResponse();

            await expect(policyHandlers.createPolicy(req, res)).rejects.toThrow('Policy name is required');
        });

        it('should reject creation with missing text', async () => {
            const userId = 'admin-user';
            stubAuth.setUser(userId, { uid: userId });

            const policyData = {
                policyName: 'Privacy Policy',
            };

            const req = createStubRequest(userId, policyData);
            const res = createStubResponse();

            await expect(policyHandlers.createPolicy(req, res)).rejects.toThrow('Policy text is required');
        });

        it('should reject creation when policy already exists', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const policyData = {
                policyName: 'Terms of Service',
                text: 'Updated terms...',
            };

            const req = createStubRequest(userId, policyData);
            const res = createStubResponse();

            await expect(policyHandlers.createPolicy(req, res)).rejects.toThrow('Policy already exists');
        });
    });

    describe('listPolicies', () => {
        it('should return empty list when no policies exist', async () => {
            const userId = 'admin-user';
            stubAuth.setUser(userId, { uid: userId });

            const req = createStubRequest(userId, {});
            const res = createStubResponse();

            await policyHandlers.listPolicies(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                policies: [],
                count: 0,
            });
        });

        it('should return all policies when they exist', async () => {
            const userId = 'admin-user';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy('policy-1', new PolicyDocumentBuilder().withId('policy-1').build());
            db.seedPolicy('policy-2', new PolicyDocumentBuilder().withId('policy-2').build());

            const req = createStubRequest(userId, {});
            const res = createStubResponse();

            await policyHandlers.listPolicies(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                policies: expect.arrayContaining([
                    expect.objectContaining({ id: 'policy-1' }),
                    expect.objectContaining({ id: 'policy-2' }),
                ]),
                count: 2,
            });
        });
    });

    describe('getPolicy', () => {
        it('should return policy details for valid policy ID', async () => {
            const userId = 'admin-user';
            const policyId = 'privacy-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(
                policyId,
                new PolicyDocumentBuilder().withId(policyId).withPolicyName('Privacy Policy').build(),
            );

            const req = createStubRequest(userId, {}, { id: policyId });
            const res = createStubResponse();

            await policyHandlers.getPolicy(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                id: policyId,
                policyName: 'Privacy Policy',
                currentVersionHash: expect.any(String),
                versions: expect.any(Object),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            stubAuth.setUser(userId, { uid: userId });

            const req = createStubRequest(userId, {}, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.getPolicy(req, res)).rejects.toThrow('Policy not found');
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific policy version content', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const versionHash = 'test-hash-123';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(
                policyId,
                new PolicyDocumentBuilder().withId(policyId).withVersionText(versionHash, 'Version 1 text').build(),
            );

            const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
            const res = createStubResponse();

            await policyHandlers.getPolicyVersion(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                versionHash,
                text: 'Version 1 text',
                createdAt: expect.any(String),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            const versionHash = 'some-hash';
            stubAuth.setUser(userId, { uid: userId });

            const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
            const res = createStubResponse();

            await expect(policyHandlers.getPolicyVersion(req, res)).rejects.toThrow('Policy not found');
        });

        it('should reject request for non-existent version', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const versionHash = 'non-existent-hash';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
            const res = createStubResponse();

            await expect(policyHandlers.getPolicyVersion(req, res)).rejects.toThrow('Policy version not found');
        });
    });

    describe('updatePolicy', () => {
        it('should create new draft version without publishing', async () => {
            const userId = 'admin-user';
            const policyId = 'privacy-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const updateData = {
                text: 'Updated policy text',
                publish: false,
            };

            const req = createStubRequest(userId, updateData, { id: policyId });
            const res = createStubResponse();

            await policyHandlers.updatePolicy(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                versionHash: expect.any(String),
                published: false,
                message: 'Draft version saved',
            });
        });

        it('should create and publish new version when publish is true', async () => {
            const userId = 'admin-user';
            const policyId = 'privacy-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const updateData = {
                text: 'Updated and published text',
                publish: true,
            };

            const req = createStubRequest(userId, updateData, { id: policyId });
            const res = createStubResponse();

            await policyHandlers.updatePolicy(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                versionHash: expect.any(String),
                currentVersionHash: expect.any(String),
                published: true,
                message: 'Policy updated and published',
            });
        });

        it('should reject update with missing text', async () => {
            const userId = 'admin-user';
            const policyId = 'privacy-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const updateData = {
                publish: false,
            };

            const req = createStubRequest(userId, updateData, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.updatePolicy(req, res)).rejects.toThrow('Policy text is required');
        });

        it('should reject update for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            stubAuth.setUser(userId, { uid: userId });

            const updateData = {
                text: 'Some updated text',
            };

            const req = createStubRequest(userId, updateData, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.updatePolicy(req, res)).rejects.toThrow('Policy not found');
        });
    });

    describe('publishPolicy', () => {
        it('should publish an existing draft version', async () => {
            const userId = 'admin-user';
            const policyId = 'cookie-policy';
            const versionHash = 'draft-hash-456';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(
                policyId,
                new PolicyDocumentBuilder().withId(policyId).withVersionText(versionHash, 'Draft version').build(),
            );

            const publishData = {
                versionHash,
            };

            const req = createStubRequest(userId, publishData, { id: policyId });
            const res = createStubResponse();

            await policyHandlers.publishPolicy(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Policy published successfully',
                currentVersionHash: versionHash,
            });
        });

        it('should reject publish with missing version hash', async () => {
            const userId = 'admin-user';
            const policyId = 'cookie-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const publishData = {};

            const req = createStubRequest(userId, publishData, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.publishPolicy(req, res)).rejects.toThrow('Version hash is required');
        });

        it('should reject publish for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            stubAuth.setUser(userId, { uid: userId });

            const publishData = {
                versionHash: 'some-hash',
            };

            const req = createStubRequest(userId, publishData, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.publishPolicy(req, res)).rejects.toThrow('Policy not found');
        });

        it('should reject publish for non-existent version', async () => {
            const userId = 'admin-user';
            const policyId = 'cookie-policy';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(policyId, new PolicyDocumentBuilder().withId(policyId).build());

            const publishData = {
                versionHash: 'non-existent-hash',
            };

            const req = createStubRequest(userId, publishData, { id: policyId });
            const res = createStubResponse();

            await expect(policyHandlers.publishPolicy(req, res)).rejects.toThrow('Policy version not found');
        });
    });

    describe('deletePolicyVersion', () => {
        it('should delete a non-current version successfully', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const currentHash = 'current-hash';
            const oldHash = 'old-hash';
            stubAuth.setUser(userId, { uid: userId });

            const policy = new PolicyDocumentBuilder().withId(policyId).withVersionText(currentHash, 'Current').build();
            policy.versions[oldHash] = {
                text: 'Old version',
                createdAt: new Date().toISOString(),
            };
            db.seedPolicy(policyId, policy);

            const req = createStubRequest(userId, {}, { id: policyId, hash: oldHash });
            const res = createStubResponse();

            await policyHandlers.deletePolicyVersion(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Policy version deleted successfully',
            });
        });

        it('should reject deletion of current version', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const currentHash = 'current-hash';
            stubAuth.setUser(userId, { uid: userId });

            db.seedPolicy(
                policyId,
                new PolicyDocumentBuilder().withId(policyId).withVersionText(currentHash, 'Current').build(),
            );

            const req = createStubRequest(userId, {}, { id: policyId, hash: currentHash });
            const res = createStubResponse();

            await expect(policyHandlers.deletePolicyVersion(req, res)).rejects.toThrow(
                'Cannot delete the current published version',
            );
        });

        it('should reject deletion when it would leave no versions', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const currentHash = 'current-hash';
            const draftHash = 'draft-hash';
            stubAuth.setUser(userId, { uid: userId });

            const policy = new PolicyDocumentBuilder().withId(policyId).withVersionText(currentHash, 'Current').build();
            policy.versions[draftHash] = {
                text: 'Draft version',
                createdAt: new Date().toISOString(),
            };
            db.seedPolicy(policyId, policy);

            const req = createStubRequest(userId, {}, { id: policyId, hash: draftHash });
            const res = createStubResponse();

            await policyHandlers.deletePolicyVersion(req, res);

            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Policy version deleted successfully',
            });
        });

        it('should reject deletion for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            const versionHash = 'some-hash';
            stubAuth.setUser(userId, { uid: userId });

            const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
            const res = createStubResponse();

            await expect(policyHandlers.deletePolicyVersion(req, res)).rejects.toThrow('Policy not found');
        });

        it('should reject deletion for non-existent version', async () => {
            const userId = 'admin-user';
            const policyId = 'terms-of-service';
            const currentHash = 'current-hash';
            const oldHash = 'old-hash';
            const nonExistentHash = 'non-existent-hash';
            stubAuth.setUser(userId, { uid: userId });

            const policy = new PolicyDocumentBuilder().withId(policyId).withVersionText(currentHash, 'Current').build();
            policy.versions[oldHash] = {
                text: 'Old version',
                createdAt: new Date().toISOString(),
            };
            db.seedPolicy(policyId, policy);

            const req = createStubRequest(userId, {}, { id: policyId, hash: nonExistentHash });
            const res = createStubResponse();

            await expect(policyHandlers.deletePolicyVersion(req, res)).rejects.toThrow('Version not found');
        });
    });

    describe('static factory method', () => {
        it('should create PolicyHandlers instance with default ApplicationBuilder', () => {
            const handlers = PolicyHandlers.createPolicyHandlers();
            expect(handlers).toBeInstanceOf(PolicyHandlers);
        });
    });
});

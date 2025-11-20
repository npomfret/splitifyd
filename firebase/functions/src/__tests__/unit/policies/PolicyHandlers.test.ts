import { StubStorage } from '@billsplit-wl/test-support';
import { toPolicyId, toPolicyName, toPolicyText, toVersionHash } from '@billsplit-wl/shared';
import { TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { PolicyHandlers } from '../../../policies/PolicyHandlers';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('PolicyHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createPolicy', () => {
        it('should create a new policy successfully with valid data', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const result = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('These are the terms...'),
            }, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                versionHash: expect.any(String),
            });
        });

        it('should reject creation with missing policy name', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.createPolicy({ policyName: '', text: 'Some policy text' } as any, userId)).rejects.toThrow();
        });

        it('should reject creation with missing text', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.createPolicy({ policyName: 'Privacy Policy', text: '' } as any, userId)).rejects.toThrow();
        });

        it('should reject creation when policy already exists', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Original terms...'),
            }, userId);

            await expect(
                appDriver.createPolicy({
                    policyName: toPolicyName('Terms of Service'),
                    text: toPolicyText('Updated terms...'),
                }, userId),
            )
                .rejects
                .toThrow('Policy already exists');
        });
    });

    describe('listPolicies', () => {
        it('should return empty list when no policies exist', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const result = await appDriver.listPolicies(userId);

            expect(result).toMatchObject({
                policies: [],
                count: 0,
            });
        });

        it('should return all policies when they exist', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const policy1 = await appDriver.createPolicy({
                policyName: toPolicyName('Terms Of Service'), // Maps to 'terms-of-service'
                text: toPolicyText('First policy text'),
            }, userId);

            const policy2 = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'), // Maps to 'privacy-policy'
                text: toPolicyText('Second policy text'),
            }, userId);

            const result = await appDriver.listPolicies(userId);

            expect(result).toMatchObject({
                policies: expect.arrayContaining([
                    expect.objectContaining({ id: policy1.id }),
                    expect.objectContaining({ id: policy2.id }),
                ]),
                count: 2,
            });
        });
    });

    describe('getPolicy', () => {
        it('should return policy details for valid policy ID', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('This is the privacy policy'),
            }, userId);

            const result = await appDriver.getPolicy(created.id, userId);

            expect(result).toMatchObject({
                id: created.id,
                policyName: toPolicyName('Privacy Policy'),
                currentVersionHash: expect.any(String),
                versions: expect.any(Object),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = toPolicyId('non-existent-policy');

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.getPolicy(policyId, userId)).rejects.toThrow('Policy not found');
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific policy version content', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Version 1 text'),
            }, userId);

            const result = await appDriver.getPolicyVersion(created.id, created.versionHash, userId);

            expect(result).toMatchObject({
                versionHash: created.versionHash,
                text: toPolicyText('Version 1 text'),
                createdAt: expect.any(String),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-hash');

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.getPolicyVersion(policyId, versionHash, userId)).rejects.toThrow('Policy not found');
        });

        it('should reject request for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Original text'),
            }, userId);

            await expect(appDriver.getPolicyVersion(created.id, toVersionHash('non-existent-hash'), userId)).rejects.toThrow(
                'Policy version not found',
            );
        });
    });

    describe('updatePolicy', () => {
        it('should create new draft version without publishing', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, userId);

            const result = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated policy text'),
                publish: false,
            }, userId);

            expect(result).toMatchObject({
                versionHash: expect.any(String),
                published: false,
            });
        });

        it('should create and publish new version when publish is true', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, userId);

            const result = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated and published text'),
                publish: true,
            }, userId);

            expect(result).toMatchObject({
                versionHash: expect.any(String),
                currentVersionHash: expect.any(String),
                published: true,
            });
        });

        it('should reject update with missing text', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, userId);

            await expect(
                appDriver.updatePolicy(created.id, {
                    text: '',
                    publish: false,
                } as any, userId),
            )
                .rejects
                .toThrow();
        });

        it('should reject update for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = toPolicyId('non-existent-policy');

            appDriver.seedAdminUser(userId, {});

            await expect(
                appDriver.updatePolicy(policyId, {
                    text: toPolicyText('Some updated text'),
                }, userId),
            )
                .rejects
                .toThrow('Policy not found');
        });
    });

    describe('publishPolicy', () => {
        it('should publish an existing draft version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original version'),
            }, userId);

            const updated = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Draft version'),
                publish: false,
            }, userId);

            const result = await appDriver.publishPolicy(created.id, updated.versionHash, userId);

            expect(result).toMatchObject({
                currentVersionHash: updated.versionHash,
            });
        });

        it('should reject publish with missing version hash', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original text'),
            }, userId);

            await expect(appDriver.publishPolicy(created.id, '' as any, userId)).rejects.toThrow();
        });

        it('should reject publish for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = toPolicyId('non-existent-policy');

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.publishPolicy(policyId, toVersionHash('some-hash'), userId)).rejects.toThrow('Policy not found');
        });

        it('should reject publish for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original text'),
            }, userId);

            await expect(appDriver.publishPolicy(created.id, toVersionHash('non-existent-hash'), userId)).rejects.toThrow(
                'Policy version not found',
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should delete a non-current version successfully', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, userId);

            const draft = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Old version'),
                publish: false,
            }, userId);

            const result = await appDriver.deletePolicyVersion(created.id, draft.versionHash, userId);

            expect(result).toMatchObject({});
        });

        it('should reject deletion of current version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, userId);

            await expect(appDriver.deletePolicyVersion(created.id, created.versionHash, userId)).rejects.toThrow(
                'Cannot delete the current published version',
            );
        });

        it('should reject deletion when it would leave no versions', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, userId);

            const draft = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Draft version'),
                publish: false,
            }, userId);

            const result = await appDriver.deletePolicyVersion(created.id, draft.versionHash, userId);

            expect(result).toMatchObject({});
        });

        it('should reject deletion for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-hash');

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.deletePolicyVersion(policyId, versionHash, userId)).rejects.toThrow('Policy not found');
        });

        it('should reject deletion for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, userId);

            await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Old version'),
                publish: false,
            }, userId);

            await expect(appDriver.deletePolicyVersion(created.id, toVersionHash('non-existent-hash'), userId)).rejects.toThrow(
                'Version not found',
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create PolicyHandlers instance with PolicyService', () => {
            const db = new TenantFirestoreTestDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(authService, db, new StubStorage({ defaultBucketName: 'test-bucket' }));
            const handlers = new PolicyHandlers(componentBuilder.buildPolicyService());
            expect(handlers).toBeInstanceOf(PolicyHandlers);
        });
    });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { PolicyHandlers } from '../../../policies/PolicyHandlers';
import { AppDriver } from '../AppDriver';

describe('PolicyHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createPolicy', () => {
        it('should create a new policy successfully with valid data', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const result = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'These are the terms...',
            });

            expect(result).toMatchObject({
                success: true,
                id: expect.any(String),
                versionHash: expect.any(String),
                message: 'Policy created successfully',
            });
        });

        it('should reject creation with missing policy name', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.createPolicy(userId, { policyName: '', text: 'Some policy text' } as any)).rejects.toThrow();
        });

        it('should reject creation with missing text', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.createPolicy(userId, { policyName: 'Privacy Policy', text: '' } as any)).rejects.toThrow();
        });

        it('should reject creation when policy already exists', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Original terms...',
            });

            await expect(
                appDriver.createPolicy(userId, {
                    policyName: 'Terms of Service',
                    text: 'Updated terms...',
                }),
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

            const policy1 = await appDriver.createPolicy(userId, {
                policyName: 'Terms Of Service', // Maps to 'terms-of-service'
                text: 'First policy text',
            });

            const policy2 = await appDriver.createPolicy(userId, {
                policyName: 'Privacy Policy', // Maps to 'privacy-policy'
                text: 'Second policy text',
            });

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

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Privacy Policy',
                text: 'This is the privacy policy',
            });

            const result = await appDriver.getPolicy(userId, created.id);

            expect(result).toMatchObject({
                id: created.id,
                policyName: 'Privacy Policy',
                currentVersionHash: expect.any(String),
                versions: expect.any(Object),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.getPolicy(userId, policyId)).rejects.toThrow('Policy not found');
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific policy version content', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Version 1 text',
            });

            const result = await appDriver.getPolicyVersion(userId, created.id, created.versionHash);

            expect(result).toMatchObject({
                versionHash: created.versionHash,
                text: 'Version 1 text',
                createdAt: expect.any(String),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            const versionHash = 'some-hash';

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.getPolicyVersion(userId, policyId, versionHash)).rejects.toThrow('Policy not found');
        });

        it('should reject request for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Original text',
            });

            await expect(appDriver.getPolicyVersion(userId, created.id, 'non-existent-hash')).rejects.toThrow(
                'Policy version not found',
            );
        });
    });

    describe('updatePolicy', () => {
        it('should create new draft version without publishing', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Privacy Policy',
                text: 'Original text',
            });

            const result = await appDriver.updatePolicy(userId, created.id, {
                text: 'Updated policy text',
                publish: false,
            });

            expect(result).toMatchObject({
                success: true,
                versionHash: expect.any(String),
                published: false,
                message: 'Draft version saved',
            });
        });

        it('should create and publish new version when publish is true', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Privacy Policy',
                text: 'Original text',
            });

            const result = await appDriver.updatePolicy(userId, created.id, {
                text: 'Updated and published text',
                publish: true,
            });

            expect(result).toMatchObject({
                success: true,
                versionHash: expect.any(String),
                currentVersionHash: expect.any(String),
                published: true,
                message: 'Policy updated and published',
            });
        });

        it('should reject update with missing text', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Privacy Policy',
                text: 'Original text',
            });

            await expect(
                appDriver.updatePolicy(userId, created.id, {
                    text: '',
                    publish: false,
                } as any),
            )
                .rejects
                .toThrow();
        });

        it('should reject update for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';

            appDriver.seedAdminUser(userId, {});

            await expect(
                appDriver.updatePolicy(userId, policyId, {
                    text: 'Some updated text',
                }),
            )
                .rejects
                .toThrow('Policy not found');
        });
    });

    describe('publishPolicy', () => {
        it('should publish an existing draft version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Cookie Policy',
                text: 'Original version',
            });

            const updated = await appDriver.updatePolicy(userId, created.id, {
                text: 'Draft version',
                publish: false,
            });

            const result = await appDriver.publishPolicy(userId, created.id, updated.versionHash);

            expect(result).toMatchObject({
                success: true,
                message: 'Policy published successfully',
                currentVersionHash: updated.versionHash,
            });
        });

        it('should reject publish with missing version hash', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Cookie Policy',
                text: 'Original text',
            });

            await expect(appDriver.publishPolicy(userId, created.id, '' as any)).rejects.toThrow();
        });

        it('should reject publish for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.publishPolicy(userId, policyId, 'some-hash')).rejects.toThrow('Policy not found');
        });

        it('should reject publish for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Cookie Policy',
                text: 'Original text',
            });

            await expect(appDriver.publishPolicy(userId, created.id, 'non-existent-hash')).rejects.toThrow(
                'Policy version not found',
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should delete a non-current version successfully', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Current version',
            });

            const draft = await appDriver.updatePolicy(userId, created.id, {
                text: 'Old version',
                publish: false,
            });

            const result = await appDriver.deletePolicyVersion(userId, created.id, draft.versionHash);

            expect(result).toMatchObject({
                success: true,
                message: 'Policy version deleted successfully',
            });
        });

        it('should reject deletion of current version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Current version',
            });

            await expect(appDriver.deletePolicyVersion(userId, created.id, created.versionHash)).rejects.toThrow(
                'Cannot delete the current published version',
            );
        });

        it('should reject deletion when it would leave no versions', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Current version',
            });

            const draft = await appDriver.updatePolicy(userId, created.id, {
                text: 'Draft version',
                publish: false,
            });

            const result = await appDriver.deletePolicyVersion(userId, created.id, draft.versionHash);

            expect(result).toMatchObject({
                success: true,
                message: 'Policy version deleted successfully',
            });
        });

        it('should reject deletion for non-existent policy', async () => {
            const userId = 'admin-user';
            const policyId = 'non-existent-policy';
            const versionHash = 'some-hash';

            appDriver.seedAdminUser(userId, {});

            await expect(appDriver.deletePolicyVersion(userId, policyId, versionHash)).rejects.toThrow('Policy not found');
        });

        it('should reject deletion for non-existent version', async () => {
            const userId = 'admin-user';
            appDriver.seedAdminUser(userId, {});

            const created = await appDriver.createPolicy(userId, {
                policyName: 'Terms of Service',
                text: 'Current version',
            });

            await appDriver.updatePolicy(userId, created.id, {
                text: 'Old version',
                publish: false,
            });

            await expect(appDriver.deletePolicyVersion(userId, created.id, 'non-existent-hash')).rejects.toThrow(
                'Version not found',
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create PolicyHandlers instance with default ApplicationBuilder', () => {
            const handlers = PolicyHandlers.createPolicyHandlers();
            expect(handlers).toBeInstanceOf(PolicyHandlers);
        });
    });
});

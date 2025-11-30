import { StubCloudTasksClient, StubStorage } from '@billsplit-wl/firebase-simulator';
import { toPolicyId, toPolicyName, toPolicyText, toVersionHash } from '@billsplit-wl/shared';
import { StubFirestoreDatabase } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { PolicyHandlers } from '../../../policies/PolicyHandlers';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { createUnitTestServiceConfig } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('PolicyHandlers - Unit Tests', () => {
    let appDriver: AppDriver;
    let adminToken: string;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const admin = await appDriver.createAdminUser();
        adminToken = admin.token;
    });

    describe('createPolicy', () => {
        it('should create a new policy successfully with valid data', async () => {
            const result = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('These are the terms...'),
            }, adminToken);

            expect(result).toMatchObject({
                id: expect.any(String),
                versionHash: expect.any(String),
            });
        });

        it('should reject creation with missing policy name', async () => {
            await expect(appDriver.createPolicy({ policyName: '', text: 'Some policy text' } as any, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_REQUEST' }),
                    }),
                );
        });

        it('should reject creation with missing text', async () => {
            await expect(appDriver.createPolicy({ policyName: 'Privacy Policy', text: '' } as any, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_REQUEST' }),
                    }),
                );
        });

        it('should reject creation when policy already exists', async () => {
            await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Original terms...'),
            }, adminToken);

            await expect(appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Updated terms...'),
            }, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.CONFLICT,
                        code: 'ALREADY_EXISTS',
                    }),
                );
        });
    });

    describe('listPolicies', () => {
        it('should return empty list when no policies exist', async () => {
            const result = await appDriver.listPolicies(adminToken);

            expect(result).toMatchObject({
                policies: [],
                count: 0,
            });
        });

        it('should return all policies when they exist', async () => {
            const policy1 = await appDriver.createPolicy({
                policyName: toPolicyName('Terms Of Service'), // Maps to 'terms-of-service'
                text: toPolicyText('First policy text'),
            }, adminToken);

            const policy2 = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'), // Maps to 'privacy-policy'
                text: toPolicyText('Second policy text'),
            }, adminToken);

            const result = await appDriver.listPolicies(adminToken);

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
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('This is the privacy policy'),
            }, adminToken);

            const result = await appDriver.getPolicy(created.id, adminToken);

            expect(result).toMatchObject({
                id: created.id,
                policyName: toPolicyName('Privacy Policy'),
                currentVersionHash: expect.any(String),
                versions: expect.any(Object),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const policyId = toPolicyId('non-existent-policy');

            await expect(appDriver.getPolicy(policyId, adminToken))
                .rejects
                .toThrow(/Policy not found/);
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific policy version content', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Version 1 text'),
            }, adminToken);

            const result = await appDriver.getPolicyVersion(created.id, created.versionHash, adminToken);

            expect(result).toMatchObject({
                versionHash: created.versionHash,
                text: toPolicyText('Version 1 text'),
                createdAt: expect.any(String),
            });
        });

        it('should reject request for non-existent policy', async () => {
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-hash');

            await expect(appDriver.getPolicyVersion(policyId, versionHash, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });

        it('should reject request for non-existent version', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Original text'),
            }, adminToken);

            await expect(appDriver.getPolicyVersion(created.id, toVersionHash('non-existent-hash'), adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });
    });

    describe('updatePolicy', () => {
        it('should create new draft version without publishing', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, adminToken);

            const result = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated policy text'),
                publish: false,
            }, adminToken);

            expect(result).toMatchObject({
                versionHash: expect.any(String),
                published: false,
            });
        });

        it('should create and publish new version when publish is true', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, adminToken);

            const result = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated and published text'),
                publish: true,
            }, adminToken);

            expect(result).toMatchObject({
                versionHash: expect.any(String),
                currentVersionHash: expect.any(String),
                published: true,
            });
        });

        it('should reject update with missing text', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Original text'),
            }, adminToken);

            await expect(
                appDriver.updatePolicy(created.id, {
                    text: '',
                    publish: false,
                } as any, adminToken),
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                    }),
                );
        });

        it('should reject update for non-existent policy', async () => {
            const policyId = toPolicyId('non-existent-policy');

            await expect(
                appDriver.updatePolicy(policyId, {
                    text: toPolicyText('Some updated text'),
                }, adminToken),
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });
    });

    describe('publishPolicy', () => {
        it('should publish an existing draft version', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original version'),
            }, adminToken);

            const updated = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Draft version'),
                publish: false,
            }, adminToken);

            const result = await appDriver.publishPolicy(created.id, updated.versionHash, adminToken);

            expect(result).toMatchObject({
                currentVersionHash: updated.versionHash,
            });
        });

        it('should reject publish with missing version hash', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original text'),
            }, adminToken);

            await expect(appDriver.publishPolicy(created.id, '' as any, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                    }),
                );
        });

        it('should reject publish for non-existent policy', async () => {
            const policyId = toPolicyId('non-existent-policy');

            await expect(appDriver.publishPolicy(policyId, toVersionHash('some-hash'), adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });

        it('should reject publish for non-existent version', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Original text'),
            }, adminToken);

            await expect(appDriver.publishPolicy(created.id, toVersionHash('non-existent-hash'), adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should delete a non-current version successfully', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, adminToken);

            const draft = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Old version'),
                publish: false,
            }, adminToken);

            const result = await appDriver.deletePolicyVersion(created.id, draft.versionHash, adminToken);

            expect(result).toMatchObject({});
        });

        it('should reject deletion of current version', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, adminToken);

            await expect(appDriver.deletePolicyVersion(created.id, created.versionHash, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_REQUEST',
                    }),
                );
        });

        it('should reject deletion when it would leave no versions', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, adminToken);

            const draft = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Draft version'),
                publish: false,
            }, adminToken);

            const result = await appDriver.deletePolicyVersion(created.id, draft.versionHash, adminToken);

            expect(result).toMatchObject({});
        });

        it('should reject deletion for non-existent policy', async () => {
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-hash');

            await expect(appDriver.deletePolicyVersion(policyId, versionHash, adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });

        it('should reject deletion for non-existent version', async () => {
            const created = await appDriver.createPolicy({
                policyName: toPolicyName('Terms of Service'),
                text: toPolicyText('Current version'),
            }, adminToken);

            await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Old version'),
                publish: false,
            }, adminToken);

            await expect(appDriver.deletePolicyVersion(created.id, toVersionHash('non-existent-hash'), adminToken))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    }),
                );
        });
    });

    describe('Static Factory Method', () => {
        it('should create PolicyHandlers instance with PolicyService', () => {
            const db = new StubFirestoreDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(
                authService,
                db,
                new StubStorage({ defaultBucketName: 'test-bucket' }),
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
            );
            const handlers = new PolicyHandlers(componentBuilder.buildPolicyService());
            expect(handlers).toBeInstanceOf(PolicyHandlers);
        });
    });
});

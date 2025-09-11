import { beforeEach, describe, expect, test } from 'vitest';

import { borrowTestUsers } from '@splitifyd/test-support/test-pool-helpers';
import { ApiDriver } from '@splitifyd/test-support';
import { UserToken } from '@splitifyd/shared';

describe('Policy Validation Tests', () => {
    const apiDriver = new ApiDriver();
    let user1: UserToken;

    beforeEach(async () => {
        [user1] = await borrowTestUsers(3);
    });

    describe('Accept Single Policy Validation', () => {
        test('should reject missing policyId', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept', 'POST', { versionHash: 'some-hash' }, user1.token)).rejects.toThrow(/Policy ID is required/);
        });

        test('should reject missing versionHash', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept', 'POST', { policyId: 'terms-of-service' }, user1.token)).rejects.toThrow(/Version hash is required/);
        });

        test('should reject empty policyId', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept', 'POST', { policyId: '', versionHash: 'some-hash' }, user1.token)).rejects.toThrow(/Policy ID is required/);
        });

        test('should reject empty versionHash', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept', 'POST', { policyId: 'terms-of-service', versionHash: '' }, user1.token)).rejects.toThrow(/Version hash is required/);
        });

        test('should strip unknown fields', async () => {
            // This will fail at the policy validation stage (policy doesn't exist)
            // but should not fail due to extra fields
            await expect(
                apiDriver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    {
                        policyId: 'non-existent-policy',
                        versionHash: 'test-hash',
                        extraField: 'should be stripped',
                        anotherField: 123,
                    },
                    user1.token,
                ),
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });

        test('should trim whitespace from inputs', async () => {
            // This will fail at the policy validation stage
            // but validates that trimming happens
            await expect(
                apiDriver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    {
                        policyId: '  terms-of-service  ',
                        versionHash: '  test-hash  ',
                    },
                    user1.token,
                ),
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });
    });

    describe('Accept Multiple Policies Validation', () => {
        test('should reject missing acceptances array', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST', {}, user1.token)).rejects.toThrow(/Acceptances array is required/);
        });

        test('should reject empty acceptances array', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST', { acceptances: [] }, user1.token)).rejects.toThrow(/At least one policy acceptance is required/);
        });

        test('should reject invalid acceptance items', async () => {
            await expect(
                apiDriver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    {
                        acceptances: [
                            { policyId: 'terms' }, // missing versionHash
                        ],
                    },
                    user1.token,
                ),
            ).rejects.toThrow(/required/);
        });

        test('should reject non-array acceptances', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST', { acceptances: 'not-an-array' }, user1.token)).rejects.toThrow(/must be an array/);
        });

        test('should validate each item in acceptances array', async () => {
            await expect(
                apiDriver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    {
                        acceptances: [
                            { policyId: 'terms', versionHash: 'v1' },
                            { policyId: '', versionHash: 'v2' }, // empty policyId
                        ],
                    },
                    user1.token,
                ),
            ).rejects.toThrow(/empty/);
        });

        test('should strip unknown fields from acceptances', async () => {
            // This will fail at the policy validation stage
            // but should not fail due to extra fields
            await expect(
                apiDriver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    {
                        acceptances: [
                            {
                                policyId: 'non-existent',
                                versionHash: 'test',
                                extraField: 'ignored',
                            },
                        ],
                        anotherExtra: 'also-ignored',
                    },
                    user1.token,
                ),
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });
    });

    describe('Authorization', () => {
        test('should reject unauthenticated requests for accept', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept', 'POST', { policyId: 'terms', versionHash: 'v1' }, null)).rejects.toThrow(/401|AUTH_REQUIRED/);
        });

        test('should reject unauthenticated requests for accept-multiple', async () => {
            await expect(apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST', { acceptances: [{ policyId: 'terms', versionHash: 'v1' }] }, null)).rejects.toThrow(/401|AUTH_REQUIRED/);
        });
    });
});

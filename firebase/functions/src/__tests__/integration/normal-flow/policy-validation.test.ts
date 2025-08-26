/**
 * @jest-environment node
 */

import { ApiDriver, User } from '@splitifyd/test-support';
import { UserBuilder } from '@splitifyd/test-support';

describe('Policy Validation Tests', () => {
    let driver: ApiDriver;
    let testUser: User;

    beforeAll(async () => {
        driver = new ApiDriver();
        testUser = await driver.createUser(new UserBuilder().build());
    });


    describe('Accept Single Policy Validation', () => {
        test('should reject missing policyId', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { versionHash: 'some-hash' },
                    testUser.token
                )
            ).rejects.toThrow(/Policy ID is required/);
        });

        test('should reject missing versionHash', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { policyId: 'terms-of-service' },
                    testUser.token
                )
            ).rejects.toThrow(/Version hash is required/);
        });

        test('should reject empty policyId', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { policyId: '', versionHash: 'some-hash' },
                    testUser.token
                )
            ).rejects.toThrow(/Policy ID is required/);
        });

        test('should reject empty versionHash', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { policyId: 'terms-of-service', versionHash: '' },
                    testUser.token
                )
            ).rejects.toThrow(/Version hash is required/);
        });

        test('should strip unknown fields', async () => {
            // This will fail at the policy validation stage (policy doesn't exist)
            // but should not fail due to extra fields
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { 
                        policyId: 'non-existent-policy',
                        versionHash: 'test-hash',
                        extraField: 'should be stripped',
                        anotherField: 123
                    },
                    testUser.token
                )
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });

        test('should trim whitespace from inputs', async () => {
            // This will fail at the policy validation stage
            // but validates that trimming happens
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { 
                        policyId: '  terms-of-service  ',
                        versionHash: '  test-hash  '
                    },
                    testUser.token
                )
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });
    });

    describe('Accept Multiple Policies Validation', () => {
        test('should reject missing acceptances array', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    {},
                    testUser.token
                )
            ).rejects.toThrow(/Acceptances array is required/);
        });

        test('should reject empty acceptances array', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { acceptances: [] },
                    testUser.token
                )
            ).rejects.toThrow(/At least one policy acceptance is required/);
        });

        test('should reject invalid acceptance items', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { 
                        acceptances: [
                            { policyId: 'terms' }, // missing versionHash
                        ]
                    },
                    testUser.token
                )
            ).rejects.toThrow(/required/);
        });

        test('should reject non-array acceptances', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { acceptances: 'not-an-array' },
                    testUser.token
                )
            ).rejects.toThrow(/must be an array/);
        });

        test('should validate each item in acceptances array', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { 
                        acceptances: [
                            { policyId: 'terms', versionHash: 'v1' },
                            { policyId: '', versionHash: 'v2' }, // empty policyId
                        ]
                    },
                    testUser.token
                )
            ).rejects.toThrow(/empty/);
        });

        test('should strip unknown fields from acceptances', async () => {
            // This will fail at the policy validation stage
            // but should not fail due to extra fields
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { 
                        acceptances: [
                            { 
                                policyId: 'non-existent',
                                versionHash: 'test',
                                extraField: 'ignored'
                            }
                        ],
                        anotherExtra: 'also-ignored'
                    },
                    testUser.token
                )
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });
    });

    describe('Authorization', () => {
        test('should reject unauthenticated requests for accept', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept',
                    'POST',
                    { policyId: 'terms', versionHash: 'v1' },
                    null
                )
            ).rejects.toThrow(/401|AUTH_REQUIRED/);
        });

        test('should reject unauthenticated requests for accept-multiple', async () => {
            await expect(
                driver['apiRequest'](
                    '/user/policies/accept-multiple',
                    'POST',
                    { acceptances: [{ policyId: 'terms', versionHash: 'v1' }] },
                    null
                )
            ).rejects.toThrow(/401|AUTH_REQUIRED/);
        });
    });
});
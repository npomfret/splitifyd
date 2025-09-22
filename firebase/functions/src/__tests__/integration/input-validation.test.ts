/**
 * Essential API Input Validation Integration Tests
 *
 * Tests Firebase HTTP API input validation that requires actual HTTP endpoints
 * and cannot be stubbed. Most validation logic is now covered by unit tests.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { ApiDriver, borrowTestUsers, TestGroupManager } from '@splitifyd/test-support';
import { Group } from '@splitifyd/shared';
import { PooledTestUser } from '@splitifyd/shared';

describe('Input Validation - Integration Tests (Essential API Behavior)', () => {
    const apiDriver = new ApiDriver();
    let testGroup: Group;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 2 });
    });

    describe('HTTP API Request Validation', () => {
        test('should enforce authentication for policy acceptance endpoints', async () => {
            // This tests actual API authentication middleware
            await expect(
                apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST',
                    { acceptances: [{ policyId: 'terms', versionHash: 'v1' }] },
                    null // No token
                )
            ).rejects.toThrow(/401|AUTH_REQUIRED/);
        });

        test('should enforce required fields through HTTP validation', async () => {
            // This tests actual HTTP request validation middleware
            await expect(
                apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST',
                    { acceptances: [{ versionHash: 'some-hash' }] }, // Missing policyId
                    users[0].token
                )
            ).rejects.toThrow(/required/);
        });

        test('should strip unknown fields through HTTP middleware', async () => {
            // This tests actual HTTP request sanitization
            await expect(
                apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST', {
                    acceptances: [{
                        policyId: 'non-existent-policy',
                        versionHash: 'test-hash',
                        extraField: 'should be stripped', // Unknown field
                        anotherField: 123,
                    }],
                }, users[0].token)
            ).rejects.toThrow(/POLICY_NOT_FOUND|Policy not found|INVALID_VERSION_HASH/);
        });
    });

    describe('HTTP Content Type and Format Validation', () => {
        test('should validate JSON request format', async () => {
            // This tests actual HTTP content type validation
            await expect(
                apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST',
                    { acceptances: 'not-an-array' }, // Invalid type
                    users[0].token
                )
            ).rejects.toThrow(/must be an array/);
        });

        test('should validate array structure requirements', async () => {
            // This tests actual HTTP schema validation
            await expect(
                apiDriver['apiRequest']('/user/policies/accept-multiple', 'POST',
                    { acceptances: [] }, // Empty array not allowed
                    users[0].token
                )
            ).rejects.toThrow(/At least one policy acceptance is required/);
        });
    });
});

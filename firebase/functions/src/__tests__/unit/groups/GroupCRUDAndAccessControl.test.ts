// Unit tests for group CRUD operations and access control
// Extracted from groups-management-consolidated.test.ts integration tests

import { CreateGroupRequestBuilder, GroupUpdateBuilder } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Groups Management - CRUD and Access Control Unit Tests', () => {
    let appDriver: AppDriver;
    const userIds = ['user-0', 'user-1', 'user-2', 'user-3'];

    beforeEach(() => {
        appDriver = new AppDriver();

        // Seed users
        userIds.forEach((userId, index) => {
            appDriver.seedUser(userId, {
                displayName: `User ${index}`,
                email: `user${index}@test.local`,
            });
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('Group Creation and Basic Operations', () => {
        test('should create groups with proper business logic', async () => {
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Test Group ${uuidv4()}`)
                .withDescription('A test group for business logic testing')
                .build();

            // Test group creation
            const group = await appDriver.createGroup(userIds[0], groupData);
            expect(group.id).toBeDefined();
            expect(group.name).toBe(groupData.name);
            expect(group.description).toBe(groupData.description);
            expect(group.createdBy).toBe(userIds[0]);

            // Test immediate balance access
            const balances = await appDriver.getGroupBalances(userIds[0], group.id);
            expect(balances.groupId).toBe(group.id);
            expect(balances.balancesByCurrency).toBeDefined();
        });

        test('should require valid group data for creation', async () => {
            // Empty name should fail
            await expect(
                appDriver.createGroup(
                    userIds[0],
                    new CreateGroupRequestBuilder()
                        .withName('')
                        .build(),
                ),
            )
                .rejects
                .toThrow(/required|invalid|name/i);
        });
    });

    describe('Group Retrieval and Access Control', () => {
        test('should enforce proper access control', async () => {
            // Create group with user 0
            const testGroup = await appDriver.createGroup(userIds[0]);

            // Non-existent group
            await expect(appDriver.getGroupFullDetails(userIds[0], 'non-existent-id')).rejects.toThrow(
                /not.*found|does.*not.*exist/i,
            );

            // Non-member access (should be denied)
            await expect(appDriver.getGroupFullDetails(userIds[1], testGroup.id)).rejects.toThrow(
                /not.*found|not.*member|access.*denied/i,
            );

            // Add user 1 to group
            await appDriver.addMembersToGroup(testGroup.id, userIds[0], [userIds[1]]);

            // Member access should work
            const groupFromUser0 = await appDriver.getGroupFullDetails(userIds[0], testGroup.id);
            const groupFromUser1 = await appDriver.getGroupFullDetails(userIds[1], testGroup.id);

            expect(groupFromUser0.group.id).toBe(testGroup.id);
            expect(groupFromUser1.group.id).toBe(testGroup.id);
        });

        test('should prevent unauthorized access to groups', async () => {
            // Create private group for user 0 only
            const privateGroup = await appDriver.createGroup(
                userIds[0],
                new CreateGroupRequestBuilder()
                    .withName(`Private Group ${uuidv4()}`)
                    .withGroupDisplayName("Owner Display")
                    .build(),
            );

            // User 1 should not be able to access
            await expect(appDriver.getGroupFullDetails(userIds[1], privateGroup.id)).rejects.toThrow(
                /not.*found|not.*member|access.*denied/i,
            );

            await expect(appDriver.getGroupBalances(userIds[1], privateGroup.id)).rejects.toThrow(
                /not.*found|not.*member|access.*denied/i,
            );
        });
    });

    describe('Group Update Operations', () => {
        test('should allow group owner to update group settings', async () => {
            const testGroup = await appDriver.createGroup(
                userIds[0],
                new CreateGroupRequestBuilder()
                    .withName('Update Test Group')
                    .build(),
            );

            // Add second user as member
            await appDriver.addMembersToGroup(testGroup.id, userIds[0], [userIds[1]]);

            // Owner can update group
            const updateData = new GroupUpdateBuilder()
                .withName('Updated by Admin')
                .build();

            await appDriver.updateGroup(userIds[0], testGroup.id, updateData);

            const updatedGroup = await appDriver.getGroupFullDetails(userIds[0], testGroup.id);
            expect(updatedGroup.group.name).toBe('Updated by Admin');
        });

        test('should prevent non-member from modifying group', async () => {
            const testGroup = await appDriver.createGroup(userIds[0]);

            // Non-member should not be able to modify group
            await expect(
                appDriver.updateGroup(
                    userIds[2],
                    testGroup.id,
                    new GroupUpdateBuilder()
                        .withName('Hacked Name')
                        .build(),
                ),
            )
                .rejects
                .toThrow(/not.*found|not.*member|access.*denied/i);
        });

        test('should prevent member (not owner) from deleting group', async () => {
            const testGroup = await appDriver.createGroup(userIds[0]);
            await appDriver.addMembersToGroup(testGroup.id, userIds[0], [userIds[1]]);

            // Member (not owner) should not be able to delete group
            await expect(appDriver.deleteGroup(userIds[1], testGroup.id)).rejects.toThrow(
                /forbidden|unauthorized|only.*owner|only.*admin|access.*denied/i,
            );
        });
    });

    describe('Permission System and Role Management', () => {
        test('should enforce authorization for group updates', async () => {
            // Create group with users 0 and 1
            const roleTestGroup = await appDriver.createGroup(
                userIds[0],
                new CreateGroupRequestBuilder()
                    .withName('Role Test Group')
                    .build(),
            );
            await appDriver.addMembersToGroup(roleTestGroup.id, userIds[0], [userIds[1]]);

            // Admin (owner) can update group
            await appDriver.updateGroup(
                userIds[0],
                roleTestGroup.id,
                new GroupUpdateBuilder()
                    .withName('Updated by Admin')
                    .build(),
            );

            const updatedGroup = await appDriver.getGroupFullDetails(userIds[0], roleTestGroup.id);
            expect(updatedGroup.group.name).toBe('Updated by Admin');

            // Member cannot update group settings (depends on group permissions)
            await expect(
                appDriver.updateGroup(
                    userIds[1],
                    roleTestGroup.id,
                    new GroupUpdateBuilder()
                        .withName('Hacked by Member')
                        .build(),
                ),
            )
                .rejects
                .toThrow(/forbidden|unauthorized|only.*owner|only.*admin|permission.*denied|access.*denied/i);
        });
    });

    describe('Authentication Requirements', () => {
        test('should require valid user for all protected operations', async () => {
            const testGroup = await appDriver.createGroup(userIds[0]);

            // Test multiple endpoints require valid user
            const nonExistentUser = 'non-existent-user';

            await expect(appDriver.getGroupFullDetails(nonExistentUser, testGroup.id)).rejects.toThrow(
                /not.*found|user.*not.*exist|not.*member|access.*denied/i,
            );

            await expect(appDriver.getGroupBalances(nonExistentUser, testGroup.id)).rejects.toThrow(
                /not.*found|user.*not.*exist|not.*member|access.*denied/i,
            );

            await expect(appDriver.getGroupExpenses(nonExistentUser, testGroup.id)).rejects.toThrow(
                /not.*found|user.*not.*exist|not.*member|access.*denied/i,
            );

            await expect(
                appDriver.updateGroup(
                    nonExistentUser,
                    testGroup.id,
                    new GroupUpdateBuilder()
                        .withName('New Name')
                        .build(),
                ),
            )
                .rejects
                .toThrow(/not.*found|user.*not.*exist|not.*member|access.*denied/i);
        });
    });
});

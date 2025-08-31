// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { UserBuilder, CreateGroupRequestBuilder, ExpenseBuilder } from '@splitifyd/test-support';
import {firestoreDb} from "../../../../firebase";

describe('GET /groups - List Groups', () => {
    let driver: ApiDriver;
    let users: User[] = [];

    beforeAll(async () => {
        driver = new ApiDriver(firestoreDb);
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });

    beforeEach(async () => {
        // Create multiple groups for testing
        const groupPromises = [];
        for (let i = 0; i < 5; i++) {
            groupPromises.push(driver.createGroup(new CreateGroupRequestBuilder().withName(`List Test Group ${i} ${uuidv4()}`).build(), users[0].token));
        }
        await Promise.all(groupPromises);
    });

    test('should list all user groups', async () => {
        const response = await driver.listGroups(users[0].token);

        expect(response.groups).toBeDefined();
        expect(Array.isArray(response.groups)).toBe(true);
        expect(response.groups.length).toBeGreaterThanOrEqual(5);
        expect(response.count).toBe(response.groups.length);
        expect(response.hasMore).toBeDefined();
    });

    test('should include group summaries with balance', async () => {
        const response = await driver.listGroups(users[0].token);

        const firstGroup = response.groups[0];
        expect(firstGroup).toHaveProperty('id');
        expect(firstGroup).toHaveProperty('name');
        expect(firstGroup).toHaveProperty('members');
        expect(firstGroup).toHaveProperty('balance');
        expect(firstGroup.balance).toHaveProperty('userBalance');
        expect(firstGroup.balance).toHaveProperty('balancesByCurrency');
        // userBalance is null for groups without balances
        expect(firstGroup).toHaveProperty('lastActivity');
        // expenseCount and lastExpense removed - calculated on demand
    });

    test('should support pagination', async () => {
        // Get first page
        const page1 = await driver.listGroups(users[0].token, { limit: 2 });
        expect(page1.groups).toHaveLength(2);
        expect(page1.hasMore).toBe(true);
        expect(page1.nextCursor).toBeDefined();

        // Get second page
        const page2 = await driver.listGroups(users[0].token, {
            limit: 2,
            cursor: page1.nextCursor,
        });
        expect(page2.groups).toHaveLength(2);

        // Ensure no duplicate IDs
        const page1Ids = page1.groups.map((g: any) => g.id);
        const page2Ids = page2.groups.map((g: any) => g.id);
        const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(intersection).toHaveLength(0);
    });

    test('should support ordering', async () => {
        const responseDesc = await driver.listGroups(users[0].token, { order: 'desc' });
        const responseAsc = await driver.listGroups(users[0].token, { order: 'asc' });

        // The most recently updated should be first in desc, last in asc
        expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
    });

    test('should only show groups where user is member', async () => {
        // Create a group with only user[1]
        const otherGroup = await driver.createGroup(new CreateGroupRequestBuilder().withName(`Other User Group ${uuidv4()}`).build(), users[1].token);

        // user[0] should not see this group
        const response = await driver.listGroups(users[0].token);
        const groupIds = response.groups.map((g: any) => g.id);
        expect(groupIds).not.toContain(otherGroup.id);
    });

    test('should require authentication', async () => {
        await expect(driver.listGroups('')).rejects.toThrow(/401|unauthorized/i);
    });

    test('should handle includeMetadata parameter correctly', async () => {
        // Test without metadata
        const responseWithoutMeta = await driver.listGroups(users[0].token, {
            includeMetadata: false,
        });
        expect(responseWithoutMeta.metadata).toBeUndefined();

        // Test with metadata (note: may be undefined if no recent changes)
        const responseWithMeta = await driver.listGroups(users[0].token, {
            includeMetadata: true,
        });
        // Metadata might not exist if no recent changes, but structure should be correct if present
        if (responseWithMeta.metadata) {
            expect(responseWithMeta.metadata).toHaveProperty('lastChangeTimestamp');
            expect(responseWithMeta.metadata).toHaveProperty('changeCount');
            expect(responseWithMeta.metadata).toHaveProperty('serverTime');
            expect(responseWithMeta.metadata).toHaveProperty('hasRecentChanges');
        }
    });

    test('should handle groups with expenses and settlements correctly', async () => {
        // Create a group with expenses - using user objects that are already created
        const groupData = new CreateGroupRequestBuilder().withName(`Integration Test Group ${uuidv4()}`).withMembers([users[0], users[1]]).build();
        const testGroup = await driver.createGroup(groupData, users[0].token);

        // Add an expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Test expense for listGroups')
            .withAmount(100)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();
        await driver.createExpense(expenseData, users[0].token);

        // List groups and verify the test group has balance data
        const response = await driver.listGroups(users[0].token);
        const groupInList = response.groups.find((g: any) => g.id === testGroup.id);

        expect(groupInList).toBeDefined();
        if (groupInList) {
            expect(groupInList.balance).toBeDefined();
            const balance = groupInList.balance as any;
            expect(balance.userBalance).toBeDefined();
            expect(balance.userBalance.netBalance).toBe(50); // User paid 100, split with 1 other
            expect(balance.userBalance.totalOwed).toBe(50);
            expect(balance.userBalance.totalOwing).toBe(0);
            expect(groupInList.lastActivity).toBeDefined();
            expect(groupInList.lastActivityRaw).toBeDefined();
        }
    });
});
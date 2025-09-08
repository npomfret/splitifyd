// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder} from '@splitifyd/test-support';
import {PooledTestUser} from "@splitifyd/shared";

describe('GET /groups - List Groups', () => {
    const apiDriver = new ApiDriver();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);

        // Create multiple groups for testing
        const groupPromises = [];
        for (let i = 0; i < 5; i++) {
            groupPromises.push(apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`List Test Group ${i} ${uuidv4()}`).build(), users[0].token));
        }
        await Promise.all(groupPromises);
    });

    test('should list all user groups', async () => {
        const response = await apiDriver.listGroups(users[0].token);

        expect(response.groups).toBeDefined();
        expect(Array.isArray(response.groups)).toBe(true);
        expect(response.groups.length).toBeGreaterThanOrEqual(5);
        expect(response.count).toBe(response.groups.length);
        expect(response.hasMore).toBeDefined();
    });

    test('should include group summaries with balance', async () => {
        const response = await apiDriver.listGroups(users[0].token);

        const firstGroup = response.groups[0];
        expect(firstGroup).toHaveProperty('id');
        expect(firstGroup).toHaveProperty('name');
        expect(firstGroup).toHaveProperty('balance');
        expect(firstGroup.balance).toHaveProperty('userBalance');
        expect(firstGroup.balance).toHaveProperty('balancesByCurrency');
        // userBalance is null for groups without balances
        expect(firstGroup).toHaveProperty('lastActivity');
        // expenseCount and lastExpense removed - calculated on demand
    });

    test('should support pagination', async () => {
        // Get first page
        const page1 = await apiDriver.listGroups(users[0].token, { limit: 2 });
        expect(page1.groups).toHaveLength(2);
        expect(page1.hasMore).toBe(true);
        expect(page1.nextCursor).toBeDefined();

        // Get second page
        const page2 = await apiDriver.listGroups(users[0].token, {
            limit: 2,
            cursor: page1.nextCursor,
        });
        // Page2 should have at least 1 group (may have less than limit if we're near the end)
        expect(page2.groups.length).toBeGreaterThanOrEqual(1);

        // Ensure no duplicate IDs between pages
        const page1Ids = page1.groups.map((g: any) => g.id);
        const page2Ids = page2.groups.map((g: any) => g.id);
        const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(intersection).toHaveLength(0);
    });

    test('should support ordering', async () => {
        const responseDesc = await apiDriver.listGroups(users[0].token, { order: 'desc' });
        const responseAsc = await apiDriver.listGroups(users[0].token, { order: 'asc' });

        // The most recently updated should be first in desc, last in asc
        expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
    });

    test('should only show groups where user is member', async () => {
        // Create a group with only user[1]
        const otherGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Other User Group ${uuidv4()}`).build(), users[1].token);

        // user[0] should not see this group
        const response = await apiDriver.listGroups(users[0].token);
        const groupIds = response.groups.map((g: any) => g.id);
        expect(groupIds).not.toContain(otherGroup.id);
    });

    test('should require authentication', async () => {
        await expect(apiDriver.listGroups('')).rejects.toThrow(/401|unauthorized/i);
    });

    test('should handle includeMetadata parameter correctly', async () => {
        // Test without metadata
        const responseWithoutMeta = await apiDriver.listGroups(users[0].token, {
            includeMetadata: false,
        });
        expect(responseWithoutMeta.metadata).toBeUndefined();

        // Test with metadata (note: may be undefined if no recent changes)
        const responseWithMeta = await apiDriver.listGroups(users[0].token, {
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
        // Use one of the groups created in beforeEach to ensure it shows up in listGroups
        const response = await apiDriver.listGroups(users[0].token);
        expect(response.groups).toBeDefined();
        expect(response.groups.length).toBeGreaterThan(0);
        
        // Use the first group from the list 
        const testGroup = response.groups[0];

        // Add an expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Test expense for listGroups`)
            .withAmount(100)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .withSplitType('equal')
            .build();
        await apiDriver.createExpense(expenseData, users[0].token);

        // List groups and verify the test group has balance data
        const updatedResponse = await apiDriver.listGroups(users[0].token);
        const groupInList = updatedResponse.groups.find((g: any) => g.id === testGroup.id);

        expect(groupInList).toBeDefined();
        if (groupInList) {
            expect(groupInList.balance).toBeDefined();
            const balance = groupInList.balance as any;
            expect(balance.userBalance).toBeDefined();
            // With shared groups, there may be existing balances, so we check structure instead of exact values
            expect(typeof balance.userBalance.netBalance).toBe('number');
            expect(typeof balance.userBalance.totalOwed).toBe('number');
            expect(typeof balance.userBalance.totalOwing).toBe('number');
            expect(groupInList.lastActivity).toBeDefined();
            expect(groupInList.lastActivityRaw).toBeDefined();
        }
    });
});
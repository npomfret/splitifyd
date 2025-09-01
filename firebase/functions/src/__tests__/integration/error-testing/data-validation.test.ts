import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, ExpenseBuilder, User} from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { Group } from '@splitifyd/shared';

describe('API Validation Smoke Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: Group;

    let users: User[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);

        testGroup = await apiDriver.createGroupWithMembers(`Test Group ${uuidv4()}`, users, users[0].token);
    });

    describe('Date Validation - Smoke Tests', () => {
        test('should reject invalid date formats', async () => {
            const expenseData = {
                ...new ExpenseBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                date: 'invalid-date-format',
            };

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should reject future dates', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDate(futureDate.toISOString()).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should accept valid dates', async () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDate(validDate.toISOString()).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
        });
    });

    describe('Category Validation - Smoke Tests', () => {
        test('should accept valid category', async () => {
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory('food').withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
        });

        test('should reject empty category', async () => {
            const expenseData = {
                ...new ExpenseBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                category: '',
            };

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should reject null category', async () => {
            const expenseData = {
                ...new ExpenseBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                category: null as any,
            };

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });
    });

    describe('String Length & Security Validation - Smoke Tests', () => {
        test('should accept valid description within limits', async () => {
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Valid description').withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
        });

        test('should reject description exceeding length limit', async () => {
            const longDescription = 'A'.repeat(201); // Over 200 char limit
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription(longDescription).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should accept valid group name', async () => {
            const groupData = new CreateGroupRequestBuilder().withName('Valid Group Name').build();
            const response = await apiDriver.createGroup(groupData, users[0].token);
            expect(response.id).toBeDefined();
        });

        test('should reject group name exceeding length limit', async () => {
            const longGroupName = 'A'.repeat(101); // Over 100 char limit
            const groupData = new CreateGroupRequestBuilder().withName(longGroupName).build();
            await expect(apiDriver.createGroup(groupData, users[0].token)).rejects.toThrow();
        });

        test('should reject XSS attempts', async () => {
            const xssDescription = '<script>alert("xss")</script>Valid content';
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription(xssDescription).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();

            // API should reject dangerous content rather than sanitize it
            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/400|invalid|dangerous/i);
        });
    });

    describe('Required Fields - Smoke Tests', () => {
        test('should reject missing required expense fields', async () => {
            const incompleteData = {
                groupId: testGroup.id,
                // Missing required fields like amount, description, etc.
            };

            await expect(apiDriver.createExpense(incompleteData, users[0].token)).rejects.toThrow();
        });

        test('should reject missing required group fields', async () => {
            const incompleteGroupData = {
                // Missing required name field
                description: 'Test description',
            };

            await expect(apiDriver.createGroup(incompleteGroupData, users[0].token)).rejects.toThrow();
        });
    });
});

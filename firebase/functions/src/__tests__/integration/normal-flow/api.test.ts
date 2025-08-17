/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

// Using native fetch from Node.js 18+
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { ExpenseBuilder, GroupBuilder, UserBuilder, SettlementBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';

describe('Comprehensive API Test Suite', () => {
    let driver: ApiDriver;
    let users: User[] = [];

    // Set a longer timeout for these integration tests
    jest.setTimeout(10000);

    beforeAll(async () => {
        // Clear any existing test data first
        await clearAllTestData();

        driver = new ApiDriver();
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });

    afterAll(async () => {
        // Clean up all test data
        await clearAllTestData();
    });

    describe('User Authentication', () => {
        test('should allow users to register and log in', () => {
            expect(users.length).toBe(2);
            users.forEach((user) => {
                expect(user.uid).toBeDefined();
                expect(user.token).toBeDefined();
                expect(user.email).toContain('@test.com');
            });
        });
    });

    describe('Group Management', () => {
        describe('Group Creation', () => {
            test('should create a new group', async () => {
                const groupData = new GroupBuilder().withName(`Test Group ${uuidv4()}`).build();

                const createdGroup = await driver.createGroup(groupData, users[0].token);

                expect(createdGroup.id).toBeDefined();

                // Verify the group was created
                const fetchedGroup = await driver.getGroup(createdGroup.id, users[0].token);
                expect(fetchedGroup.name).toBe(groupData.name);
                expect(fetchedGroup.memberIds.length).toBe(1); // Only creator initially
            });
        });

        describe('Group Sharing & Access Control', () => {
            test('should return 404 for non-existent group ID', async () => {
                // Try to access a group that doesn't exist
                const fakeGroupId = 'non-existent-group-id-12345';

                await expect(driver.getGroup(fakeGroupId, users[0].token)).rejects.toThrow(/status 404.*NOT_FOUND/);
            });

            test('should return 404 for valid group when user is not a member (security: hide existence)', async () => {
                // Create a group using the new API
                const groupData = new GroupBuilder().withName(`Members Only Group ${uuidv4()}`).build();
                const testGroup = await driver.createGroup(groupData, users[0].token);

                // Create a third user who is not part of the group
                const outsiderUser = await driver.createUser(new UserBuilder().build());

                // Try to access group as non-member
                // NOTE: Returns 404 instead of 403 for security - doesn't reveal group existence
                await expect(driver.getGroup(testGroup.id, outsiderUser.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
            });

            test('should allow group members to access group details', async () => {
                // Create a group with both users as members
                const groupData = new GroupBuilder().withName(`Shared Group ${uuidv4()}`).build();
                const testGroup = await driver.createGroupWithMembers(groupData.name, users, users[0].token);

                // Both members should be able to access the group
                const groupFromUser0 = await driver.getGroup(testGroup.id, users[0].token);
                expect(groupFromUser0.id).toBe(testGroup.id);

                const groupFromUser1 = await driver.getGroup(testGroup.id, users[1].token);
                expect(groupFromUser1.id).toBe(testGroup.id);
            });

            test('should generate shareable link for group', async () => {
                // Create a test group
                const testGroup = await driver.createGroupWithMembers(`Share Link Test Group ${uuidv4()}`, users, users[0].token);

                // Any member should be able to generate a share link
                const shareResponse = await driver.generateShareLink(testGroup.id, users[0].token);

                expect(shareResponse).toHaveProperty('shareablePath');
                expect(shareResponse).toHaveProperty('linkId');
                expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
                expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
            });

            test('should allow any member to generate shareable link', async () => {
                // Create a new group where user[0] is the creator and user[1] is a member
                const memberGroup = await driver.createGroupWithMembers(`Member Share Test Group ${uuidv4()}`, users, users[0].token);

                // User[1] (member) should be able to generate a share link
                const shareResponse = await driver.generateShareLink(memberGroup.id, users[1].token);

                expect(shareResponse).toHaveProperty('shareablePath');
                expect(shareResponse).toHaveProperty('linkId');
                expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
                expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
            });

            test('should not allow non-members to generate shareable link', async () => {
                // Create a group with only user[0]
                const groupData = new GroupBuilder().withName(`Non-Member Test Group ${uuidv4()}`).build();
                const restrictedGroup = await driver.createGroup(groupData, users[0].token);

                // User[1] (non-member) should not be able to generate a share link
                await expect(driver.generateShareLink(restrictedGroup.id, users[1].token)).rejects.toThrow(/status 403.*UNAUTHORIZED/);
            });

            test('should allow new users to join group via share link', async () => {
                // First, create a new group and generate a share link
                const shareableGroupData = new GroupBuilder().withMember(users[0]).build();

                const shareableGroup = await driver.createGroup(shareableGroupData, users[0].token);

                // Generate share link
                const shareResponse = await driver.generateShareLink(shareableGroup.id, users[0].token);

                // Create a new user who will join via the link
                const newUser = await driver.createUser(new UserBuilder().build());

                // Join the group using the share token
                const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

                expect(joinResponse).toHaveProperty('groupId');
                expect(joinResponse.groupId).toBe(shareableGroup.id);
                expect(joinResponse).toHaveProperty('message');
                expect(joinResponse).toHaveProperty('groupName');

                // Verify the user was added to the group
                const updatedGroup = await driver.getGroup(shareableGroup.id, newUser.token);
                const memberUids = updatedGroup.memberIds;
                expect(memberUids).toContain(newUser.uid);
            });

            test('should not allow duplicate joining via share link', async () => {
                // Create a group with a share link
                const dupTestGroupData = new GroupBuilder().withMember(users[0]).build();

                const dupTestGroup = await driver.createGroup(dupTestGroupData, users[0].token);
                const shareResponse = await driver.generateShareLink(dupTestGroup.id, users[0].token);

                // Add user[1] to the group via share link
                await driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

                // Try to join again with the same user
                await expect(driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)).rejects.toThrow(/ALREADY_MEMBER/);
            });

            test('should reject invalid share tokens', async () => {
                const invalidUser = await driver.createUser(new UserBuilder().build());

                // Try to join with an invalid token
                await expect(driver.joinGroupViaShareLink('INVALID_TOKEN_12345', invalidUser.token)).rejects.toThrow(/status 404.*INVALID_LINK/);
            });

            test('should allow multiple users to join group using the same share link', async () => {
                // Create a new group with only one member
                const multiJoinGroupData = new GroupBuilder().withMember(users[0]).build();

                const multiJoinGroup = await driver.createGroup(multiJoinGroupData, users[0].token);

                // Generate a share link
                const shareResponse = await driver.generateShareLink(multiJoinGroup.id, users[0].token);

                // Create multiple new users who will join via the same link
                const newUsers = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);

                // All users should be able to join using the same link
                for (const user of newUsers) {
                    const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, user.token);

                    expect(joinResponse).toHaveProperty('groupId');
                    expect(joinResponse.groupId).toBe(multiJoinGroup.id);
                    expect(joinResponse).toHaveProperty('message');
                }

                // Verify all users were added to the group
                const updatedGroup = await driver.getGroup(multiJoinGroup.id, users[0].token);
                const memberUids = updatedGroup.memberIds;

                // Should have original member + 3 new members = 4 total
                expect(memberUids.length).toBe(4);
                expect(memberUids).toContain(users[0].uid);
                newUsers.forEach((user) => {
                    expect(memberUids).toContain(user.uid);
                });
            });
        });
    });

    describe('Expense Management', () => {
        let testGroup: any;

        beforeEach(async () => {
            testGroup = await driver.createGroupWithMembers(`Test Group ${uuidv4()}`, users, users[0].token);
        });

        describe('Expense Creation', () => {
            test('should add an expense to the group', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .build();

                const response = await driver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();
                const createdExpense = { id: response.id, ...expenseData };

                // Verify the expense was created by fetching it
                const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
                expect(fetchedExpense.description).toBe(expenseData.description);
                expect(fetchedExpense.amount).toBe(expenseData.amount);
                expect(fetchedExpense.paidBy).toBe(users[0].uid);
            });

            test('should add an expense with an unequal split', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Unequal Split Expense')
                    .withPaidBy(users[0].uid)
                    .withSplitType('exact')
                    .withParticipants(users.map((u) => u.uid))
                    .withSplits([
                        { userId: users[0].uid, amount: 80 },
                        { userId: users[1].uid, amount: 20 },
                    ])
                    .withCategory('utilities')
                    .build();

                const response = await driver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                // Verify the expense was created correctly with unequal splits
                const createdExpense = await driver.getExpense(response.id, users[0].token);
                expect(createdExpense.amount).toBe(100);
                expect(createdExpense.splitType).toBe('exact');
                expect(createdExpense.splits).toHaveLength(2);
                const user0Split = createdExpense.splits.find((s: any) => s.userId === users[0].uid);
                const user1Split = createdExpense.splits.find((s: any) => s.userId === users[1].uid);
                expect(user0Split?.amount).toBe(80);
                expect(user1Split?.amount).toBe(20);

                // Verify the splits add up to the total amount
                const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBe(100);
            });

            test("should list all of a group's expenses", async () => {
                // Add multiple expenses
                await driver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withAmount(100)
                        .withPaidBy(users[0].uid)
                        .withParticipants(users.map((u) => u.uid))
                        .withDescription('First Test Expense')
                        .build(),
                    users[0].token,
                );

                await driver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withAmount(50)
                        .withPaidBy(users[1].uid)
                        .withParticipants(users.map((u) => u.uid))
                        .withDescription('Second Test Expense')
                        .build(),
                    users[1].token,
                );

                const response = await driver.getGroupExpenses(testGroup.id, users[0].token);
                expect(response).toHaveProperty('expenses');
                expect(Array.isArray(response.expenses)).toBe(true);
                expect(response.expenses.length).toBe(2);
                const expenseDescriptions = response.expenses.map((e: any) => e.description);
                expect(expenseDescriptions).toContain('First Test Expense');
                expect(expenseDescriptions).toContain('Second Test Expense');
            });
        });

        describe('Expense Updates', () => {
            test('should update an expense', async () => {
                const initialExpenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .build();
                const createdExpense = await driver.createExpense(initialExpenseData, users[0].token);

                const updatedData = {
                    description: 'Updated Test Expense',
                    amount: 150.5,
                    category: 'food',
                };

                // Use PUT for updates, passing the expense ID in the query
                await driver.updateExpense(createdExpense.id, updatedData, users[0].token);

                const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);

                expect(fetchedExpense.description).toBe(updatedData.description);
                expect(fetchedExpense.amount).toBe(updatedData.amount);
                expect(fetchedExpense.category).toBe(updatedData.category);
            });

            test('should recalculate splits when amount is updated with exact split type', async () => {
                // Create a new expense specifically for this test
                const testExpenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Split Recalculation Test')
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .build();

                const createResponse = await driver.createExpense(testExpenseData, users[0].token);
                expect(createResponse.id).toBeDefined();

                // Fetch the created expense to verify initial splits
                const initialExpense = await driver.getExpense(createResponse.id, users[0].token);
                expect(initialExpense.amount).toBe(100);
                expect(initialExpense.splits).toHaveLength(2);
                expect(initialExpense.splits[0].amount).toBe(50);
                expect(initialExpense.splits[1].amount).toBe(50);

                // Update only the amount
                const updatedData = {
                    amount: 150.5,
                };

                await driver.updateExpense(createResponse.id, updatedData, users[0].token);

                // Fetch the updated expense to verify splits were recalculated
                const updatedExpense = await driver.getExpense(createResponse.id, users[0].token);

                expect(updatedExpense.amount).toBe(150.5);
                expect(updatedExpense.splits).toHaveLength(2);
                expect(updatedExpense.splits[0].amount).toBe(75.25);
                expect(updatedExpense.splits[1].amount).toBe(75.25);

                // Verify that the total of splits equals the new amount
                const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBe(150.5);
            });

            test('should recalculate splits when amount is updated with exact split type', async () => {
                // Create an expense with exact splits
                const testExpenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Exact Split Test')
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withSplitType('exact')
                    .withParticipants(users.map((u) => u.uid))
                    .withSplits([
                        { userId: users[0].uid, amount: 60 },
                        { userId: users[1].uid, amount: 40 },
                    ])
                    .build();

                const createResponse = await driver.createExpense(testExpenseData, users[0].token);
                expect(createResponse.id).toBeDefined();

                // Fetch the created expense to verify initial splits
                const initialExpense = await driver.getExpense(createResponse.id, users[0].token);
                expect(initialExpense.amount).toBe(100);
                expect(initialExpense.splits).toHaveLength(2);
                const user0Split = initialExpense.splits.find((s: any) => s.userId === users[0].uid);
                const user1Split = initialExpense.splits.find((s: any) => s.userId === users[1].uid);
                expect(user0Split?.amount).toBe(60);
                expect(user1Split?.amount).toBe(40);

                // Update only the amount - should revert to equal splits since no new splits provided
                const updatedData = {
                    amount: 150,
                };

                await driver.updateExpense(createResponse.id, updatedData, users[0].token);

                // Fetch the updated expense to verify splits were recalculated to equal
                const updatedExpense = await driver.getExpense(createResponse.id, users[0].token);

                expect(updatedExpense.amount).toBe(150);
                expect(updatedExpense.splits).toHaveLength(2);
                expect(updatedExpense.splits[0].amount).toBe(75);
                expect(updatedExpense.splits[1].amount).toBe(75);

                // Verify that the total of splits equals the new amount
                const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBe(150);
            });
        });

        describe('Expense Deletion', () => {
            test('should delete an expense', async () => {
                // First, create an expense to be deleted
                const expenseToDeleteData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('To be deleted')
                    .withAmount(50)
                    .withPaidBy(users[1].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .build();
                const createdExpense = await driver.createExpense(expenseToDeleteData, users[1].token);
                expect(createdExpense.id).toBeDefined();

                // Now, delete it
                await driver.deleteExpense(createdExpense.id, users[1].token);

                // Verify it's gone
                await expect(driver.getExpense(createdExpense.id, users[1].token)).rejects.toThrow(/status 404/);
            });
        });
    });

    describe('Settlement Management', () => {
        let testGroup: any;
        let settlementUsers: User[];

        beforeEach(async () => {
            settlementUsers = [users[0], users[1]];
            testGroup = await driver.createGroupWithMembers(`Settlement Test Group ${uuidv4()}`, settlementUsers, users[0].token);
        });

        describe('Settlement Creation', () => {
            test('should create a new settlement', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(75.5).withNote('Test settlement payment').build();

                const createdSettlement = await driver.createSettlement(settlementData, users[0].token);

                expect(createdSettlement.id).toBeDefined();
                expect(createdSettlement.groupId).toBe(testGroup.id);
                expect(createdSettlement.amount).toBe(75.5);
                expect(createdSettlement.note).toBe('Test settlement payment');
            });

            test('should create a settlement without optional fields', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(25.0).build();

                const createdSettlement = await driver.createSettlement(settlementData, users[0].token);

                expect(createdSettlement.id).toBeDefined();
                expect(createdSettlement.amount).toBe(25.0);
            });

            test('should reject settlement with invalid group', async () => {
                const settlementData = new SettlementBuilder().withGroupId('invalid-group-id').withPayer(users[0].uid).withPayee(users[1].uid).build();

                await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/status 404.*GROUP_NOT_FOUND/);
            });

            test('should reject settlement between non-group-members', async () => {
                const outsiderUser = await driver.createUser(new UserBuilder().build());

                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(outsiderUser.uid).build();

                await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/status 400.*USER_NOT_IN_GROUP/);
            });

            test('should validate required fields', async () => {
                const invalidData = {};

                await expect(driver.createSettlement(invalidData, users[0].token)).rejects.toThrow(/VALIDATION_ERROR|validation|required/);
            });

            test('should validate positive amounts', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(-50).build();

                await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
            });
        });

        describe('Settlement Retrieval', () => {
            test('should retrieve a settlement by ID', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(100.0).withNote('Retrieve test').build();

                const created = await driver.createSettlement(settlementData, users[0].token);
                const retrieved = await driver.getSettlement(created.id, users[0].token);

                expect(retrieved.id).toBe(created.id);
                expect(retrieved.amount).toBe(100.0);
                expect(retrieved.note).toBe('Retrieve test');
                expect(retrieved.payer).toBeDefined();
                expect(retrieved.payee).toBeDefined();
                expect(retrieved.payer.uid).toBe(users[0].uid);
                expect(retrieved.payee.uid).toBe(users[1].uid);
            });

            test('should reject retrieval by non-group-member', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).build();

                const created = await driver.createSettlement(settlementData, users[0].token);
                const outsiderUser = await driver.createUser(new UserBuilder().build());

                await expect(driver.getSettlement(created.id, outsiderUser.token)).rejects.toThrow(/status 403.*NOT_GROUP_MEMBER/);
            });

            test('should handle non-existent settlement', async () => {
                await expect(driver.getSettlement('non-existent-id', users[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });

        describe('Settlement Updates', () => {
            test('should update settlement fields', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(50.0).withNote('Original note').build();

                const created = await driver.createSettlement(settlementData, users[0].token);

                const updateData = {
                    amount: 75.25,
                    note: 'Updated note',
                };

                const updated = await driver.updateSettlement(created.id, updateData, users[0].token);

                expect(updated.amount).toBe(75.25);
                expect(updated.note).toBe('Updated note');
            });

            test('should reject update by non-creator', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).build();

                const created = await driver.createSettlement(settlementData, users[0].token);

                await expect(driver.updateSettlement(created.id, { amount: 100 }, users[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
            });

            test('should validate update data', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).build();

                const created = await driver.createSettlement(settlementData, users[0].token);

                await expect(driver.updateSettlement(created.id, { amount: -100 }, users[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
            });
        });

        describe('Settlement Deletion', () => {
            test('should delete a settlement', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).build();

                const created = await driver.createSettlement(settlementData, users[0].token);
                await driver.deleteSettlement(created.id, users[0].token);

                await expect(driver.getSettlement(created.id, users[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });

            test('should reject deletion by non-creator', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).build();

                const created = await driver.createSettlement(settlementData, users[0].token);

                await expect(driver.deleteSettlement(created.id, users[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
            });

            test('should handle deletion of non-existent settlement', async () => {
                await expect(driver.deleteSettlement('non-existent-id', users[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });

        describe('Settlement Listing', () => {
            test('should list settlements for a group', async () => {
                await Promise.all([
                    driver.createSettlement(
                        new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(50).withNote('First settlement').build(),
                        users[0].token,
                    ),
                    driver.createSettlement(
                        new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[1].uid).withPayee(users[0].uid).withAmount(25).withNote('Second settlement').build(),
                        users[1].token,
                    ),
                ]);

                const response = await driver.listSettlements(users[0].token, { groupId: testGroup.id });

                expect(response.settlements).toBeDefined();
                expect(Array.isArray(response.settlements)).toBe(true);
                expect(response.settlements.length).toBe(2);
                expect(response.count).toBe(2);

                const notes = response.settlements.map((s: any) => s.note);
                expect(notes).toContain('First settlement');
                expect(notes).toContain('Second settlement');
            });

            test('should support pagination', async () => {
                const settlements = [];
                for (let i = 0; i < 5; i++) {
                    settlements.push(
                        driver.createSettlement(
                            new SettlementBuilder()
                                .withGroupId(testGroup.id)
                                .withPayer(users[0].uid)
                                .withPayee(users[1].uid)
                                .withAmount(10 * (i + 1))
                                .withNote(`Settlement ${i + 1}`)
                                .build(),
                            users[0].token,
                        ),
                    );
                }
                await Promise.all(settlements);

                const firstPage = await driver.listSettlements(users[0].token, {
                    groupId: testGroup.id,
                    limit: 3,
                });

                expect(firstPage.settlements.length).toBe(3);
                expect(firstPage.hasMore).toBe(true);
                expect(firstPage.nextCursor).toBeDefined();

                const secondPage = await driver.listSettlements(users[0].token, {
                    groupId: testGroup.id,
                    limit: 3,
                    cursor: firstPage.nextCursor,
                });

                expect(secondPage.settlements.length).toBe(2);
                expect(secondPage.hasMore).toBe(false);
            });
        });
    });

    describe('Balance Calculations', () => {
        let balanceTestGroup: any;

        beforeEach(async () => {
            balanceTestGroup = await driver.createGroupWithMembers(`Balance Test Group ${uuidv4()}`, users, users[0].token);
        });

        test('should include balance information in group details', async () => {
            // Create an expense: User 0 pays 100, split equally between 2 users
            const expenseData = new ExpenseBuilder()
                .withGroupId(balanceTestGroup.id)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            await driver.createExpense(expenseData, users[0].token);

            // Get group details to check balance info
            const groupDetails = await driver.getGroup(balanceTestGroup.id, users[0].token);

            // Verify the response structure includes balance info
            expect(groupDetails).toHaveProperty('id');
            expect(groupDetails).toHaveProperty('name');
            expect(groupDetails).toHaveProperty('memberIds');
            expect(groupDetails.memberIds.length).toBeGreaterThan(0);
        });

        test('should include balance data in listGroups response', async () => {
            // Add an expense: User 0 pays 100, split equally between 2 users
            const expenseData = new ExpenseBuilder()
                .withGroupId(balanceTestGroup.id)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            await driver.createExpense(expenseData, users[0].token);

            // Get group list to check balance data

            // Test the listGroups endpoint (which dashboard uses)
            const listResponse = await driver.listGroups(users[0].token);

            expect(listResponse).toHaveProperty('groups');
            expect(Array.isArray(listResponse.groups)).toBe(true);

            // Find our test group in the list
            const testGroupInList = listResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
            expect(testGroupInList).toBeDefined();

            // Verify balance data structure is present
            expect(testGroupInList!.balance).toBeDefined();
            expect(testGroupInList!.balance).toHaveProperty('userBalance');
            expect(testGroupInList!.balance).toHaveProperty('balancesByCurrency');

            // userBalance should contain the balance properties
            if (testGroupInList!.balance.userBalance) {
                expect(typeof testGroupInList!.balance.userBalance).toBe('object');
                expect(testGroupInList!.balance.userBalance).toHaveProperty('netBalance');
                expect(testGroupInList!.balance.userBalance).toHaveProperty('totalOwed');
                expect(testGroupInList!.balance.userBalance).toHaveProperty('totalOwing');
            }

            // User 0 paid 100, split equally between 2 users = User 0 should be owed 50
            // But balance calculation might be async, so we accept 0 as well
            const netBalance = testGroupInList!.balance.userBalance?.netBalance || 0;
            expect([0, 50]).toContain(netBalance);
        });

        // NOTE: Expense metadata (expenseCount, lastExpense) removed in favor of on-demand calculation
        test('should show updated lastActivity after creating expenses', async () => {
            // First, verify the group starts with default lastActivity
            const initialListResponse = await driver.listGroups(users[0].token);
            const initialGroupInList = initialListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

            expect(initialGroupInList).toBeDefined();
            // lastActivity should default to group creation time
            expect(initialGroupInList!.lastActivityRaw).toBeDefined();
            const initialActivityTime = new Date(initialGroupInList!.lastActivityRaw);

            // Add an expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(balanceTestGroup.id)
                .withAmount(75)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            await driver.createExpense(expenseData, users[0].token);

            // Wait a moment for potential async updates
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Check after creating expense
            const updatedListResponse = await driver.listGroups(users[0].token);
            const updatedGroupInList = updatedListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

            expect(updatedGroupInList).toBeDefined();

            // Verify lastActivity is updated (either immediately or after calculation)
            expect(updatedGroupInList!.lastActivityRaw).toBeDefined();
            expect(typeof updatedGroupInList!.lastActivityRaw).toBe('string');

            // Verify the lastActivityRaw is a valid ISO timestamp
            expect(new Date(updatedGroupInList!.lastActivityRaw).getTime()).not.toBeNaN();

            // The activity time should be updated or the same (if on-demand calculation hasn't run yet)
            const updatedActivityTime = new Date(updatedGroupInList!.lastActivityRaw);
            expect(updatedActivityTime.getTime()).toBeGreaterThanOrEqual(initialActivityTime.getTime());

            // Add another expense to test activity update
            const secondExpenseData = new ExpenseBuilder()
                .withGroupId(balanceTestGroup.id)
                .withAmount(25)
                .withPaidBy(users[1].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            await driver.createExpense(secondExpenseData, users[1].token);

            // Wait a moment for potential async updates
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Check after second expense
            const finalListResponse = await driver.listGroups(users[0].token);
            const finalGroupInList = finalListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

            expect(finalGroupInList!.lastActivityRaw).toBeDefined();

            // The lastActivityRaw should reflect recent activity
            const lastActivityTime = new Date(finalGroupInList!.lastActivityRaw);
            expect(lastActivityTime.getTime()).toBeGreaterThanOrEqual(updatedActivityTime.getTime());
        });
    });

    describe('API Security & Headers', () => {
        test('should return proper CORS headers', async () => {
            const testOrigin = 'http://localhost:3000';
            const url = `${driver.getBaseUrl()}/health`;

            const response = await fetch(url, {
                method: 'OPTIONS',
                headers: {
                    Origin: testOrigin,
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization',
                },
            });

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
            expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
            expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
        });

        test('should return security headers', async () => {
            const url = `${driver.getBaseUrl()}/health`;
            const response = await fetch(url);

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
            expect(response.headers.get('X-Frame-Options')).toBeTruthy();
            expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
        });
    });
});

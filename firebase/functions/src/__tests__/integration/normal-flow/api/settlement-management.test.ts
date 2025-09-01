// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, SettlementBuilder, borrowTestUsers} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Settlement Management', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let settlementUsers: AuthenticatedFirebaseUser[];
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6);
    });

    // Helper to get users from pool
    const getTestUsers = (count: number): AuthenticatedFirebaseUser[] => {
        return users.slice(0, count);
    };

    beforeEach(async () => {
        settlementUsers = getTestUsers(2);
        testGroup = await apiDriver.createGroupWithMembers(`Settlement Test Group ${uuidv4()}`, settlementUsers, settlementUsers[0].token);
    });

    describe('Settlement Creation', () => {
        test('should create a new settlement', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(settlementUsers[0].uid)
                .withPayee(settlementUsers[1].uid)
                .withAmount(75.5)
                .withNote('Test settlement payment')
                .build();

            const createdSettlement = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            expect(createdSettlement.id).toBeDefined();
            expect(createdSettlement.groupId).toBe(testGroup.id);
            expect(createdSettlement.amount).toBe(75.5);
            expect(createdSettlement.note).toBe('Test settlement payment');
        });

        test('should create a settlement without optional fields', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).withAmount(25.0).build();

            const createdSettlement = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            expect(createdSettlement.id).toBeDefined();
            expect(createdSettlement.amount).toBe(25.0);
        });

        test('should reject settlement with invalid group', async () => {
            const settlementData = new SettlementBuilder().withGroupId('invalid-group-id').withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 404.*GROUP_NOT_FOUND/);
        });

        test('should reject settlement between non-group-members', async () => {
            const outsiderUser = getTestUsers(3)[2]; // Get a third user from pool

            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(outsiderUser.uid).build();

            await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 400.*USER_NOT_IN_GROUP/);
        });

        test('should validate required fields', async () => {
            const invalidData = {};

            await expect(apiDriver.createSettlement(invalidData, settlementUsers[0].token)).rejects.toThrow(/VALIDATION_ERROR|validation|required/);
        });

        test('should validate positive amounts', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).withAmount(-50).build();

            await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
        });
    });

    describe('Settlement Retrieval', () => {
        test('should retrieve a settlement by ID', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(settlementUsers[0].uid)
                .withPayee(settlementUsers[1].uid)
                .withAmount(100.0)
                .withNote('Retrieve test')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
            const retrieved = await apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token);

            expect(retrieved.id).toBe(created.id);
            expect(retrieved.amount).toBe(100.0);
            expect(retrieved.note).toBe('Retrieve test');
            expect(retrieved.payer).toBeDefined();
            expect(retrieved.payee).toBeDefined();
            expect(retrieved.payer.uid).toBe(settlementUsers[0].uid);
            expect(retrieved.payee.uid).toBe(settlementUsers[1].uid);
        });

        test('should reject retrieval by non-group-member', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
            const outsiderUser = getTestUsers(3)[2]; // Get a third user from pool

            await expect(apiDriver.getSettlement(testGroup.id, created.id, outsiderUser.token)).rejects.toThrow(/status 403.*NOT_GROUP_MEMBER/);
        });

        test('should handle non-existent settlement', async () => {
            await expect(apiDriver.getSettlement(testGroup.id, 'non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });
    });

    describe('Settlement Updates', () => {
        test('should update settlement fields', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(settlementUsers[0].uid)
                .withPayee(settlementUsers[1].uid)
                .withAmount(50.0)
                .withNote('Original note')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            const updateData = {
                amount: 75.25,
                note: 'Updated note',
            };

            const updated = await apiDriver.updateSettlement(created.id, updateData, settlementUsers[0].token);

            expect(updated.amount).toBe(75.25);
            expect(updated.note).toBe('Updated note');
        });

        test('should reject update by non-creator', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            await expect(apiDriver.updateSettlement(created.id, { amount: 100 }, settlementUsers[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
        });

        test('should validate update data', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            await expect(apiDriver.updateSettlement(created.id, { amount: -100 }, settlementUsers[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
        });
    });

    describe('Settlement Deletion', () => {
        test('should delete a settlement', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
            await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

            await expect(apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });

        test('should reject deletion by non-creator', async () => {
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            await expect(apiDriver.deleteSettlement(created.id, settlementUsers[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
        });

        test('should handle deletion of non-existent settlement', async () => {
            await expect(apiDriver.deleteSettlement('non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });
    });

    describe('Settlement Listing', () => {
        test('should list settlements for a group', async () => {
            await Promise.all([
                apiDriver.createSettlement(
                    new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).withAmount(50).withNote('First settlement').build(),
                    settlementUsers[0].token,
                ),
                apiDriver.createSettlement(
                    new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[1].uid).withPayee(settlementUsers[0].uid).withAmount(25).withNote('Second settlement').build(),
                    settlementUsers[1].token,
                ),
            ]);

            const response = await apiDriver.listSettlements(settlementUsers[0].token, { groupId: testGroup.id });

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
                    apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(testGroup.id)
                            .withPayer(settlementUsers[0].uid)
                            .withPayee(settlementUsers[1].uid)
                            .withAmount(10 * (i + 1))
                            .withNote(`Settlement ${i + 1}`)
                            .build(),
                        settlementUsers[0].token,
                    ),
                );
            }
            await Promise.all(settlements);

            const firstPage = await apiDriver.listSettlements(settlementUsers[0].token, {
                groupId: testGroup.id,
                limit: 3,
            });

            expect(firstPage.settlements.length).toBe(3);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            const secondPage = await apiDriver.listSettlements(settlementUsers[0].token, {
                groupId: testGroup.id,
                limit: 3,
                cursor: firstPage.nextCursor,
            });

            expect(secondPage.settlements.length).toBe(2);
            expect(secondPage.hasMore).toBe(false);
        });
    });
});
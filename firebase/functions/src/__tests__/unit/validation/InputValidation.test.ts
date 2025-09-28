import { describe, it, expect, beforeEach } from 'vitest';
import { ExpenseService } from '../../../services/ExpenseService';
import { SettlementService } from '../../../services/SettlementService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService, StubPermissionEngine } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import type { CreateExpenseRequest, CreateSettlementRequest } from '@splitifyd/shared';

describe('Input Validation Unit Tests', () => {
    let expenseService: ExpenseService;
    let settlementService: SettlementService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;

    const testGroupId = 'test-group-id';
    const testUser1 = 'user1';
    const testUser2 = 'user2';
    const testUser3 = 'user3';

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        const applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);

        // Build services - ExpenseService needs StubPermissionEngine for validation tests
        expenseService = new ExpenseService(
            stubReader,
            stubWriter,
            applicationBuilder.buildGroupMemberService(),
            applicationBuilder.buildUserService(),
            undefined, // dateHelpers
            undefined, // logger
            undefined, // loggerContext
            StubPermissionEngine as any, // permission engine
            undefined, // measure
            undefined  // validator
        );
        settlementService = applicationBuilder.buildSettlementService();

        // Set up test group with proper permissions and members
        const testGroup = new FirestoreGroupBuilder()
            .withId(testGroupId)
            .withCreatedBy(testUser1)
            .build();

        // Add test users as members in the group document
        testGroup.members[testUser2] = { role: 'member', status: 'active' };
        testGroup.members[testUser3] = { role: 'member', status: 'active' };

        stubReader.setDocument('groups', testGroupId, testGroup);

        // Set up group member subcollection documents that GroupMemberService expects
        [testUser1, testUser2, testUser3].forEach(userId => {
            stubReader.setDocument('group-members', `${testGroupId}_${userId}`, {
                uid: userId,
                groupId: testGroupId,
                memberRole: userId === testUser1 ? 'admin' : 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString()
            });
        });

        // Set up users in auth service
        [testUser1, testUser2, testUser3].forEach(userId => {
            stubAuth.setUser(userId, {
                uid: userId,
                email: `${userId}@test.com`,
                displayName: `User ${userId}`,
                emailVerified: true,
            });
        });
    });

    describe('Amount Validation', () => {
        describe('Decimal Precision Edge Cases', () => {
            it('should handle very small amounts with proper precision', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 0.01,
                    description: 'Small amount test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = await expenseService.createExpense(testUser1, expenseData);

                expect(result.amount).toBe(0.01);
                expect(result.splits).toHaveLength(2);

                const totalSplits = result.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBeGreaterThanOrEqual(0.01);
                expect(totalSplits).toBeLessThanOrEqual(0.02);
            });

            it('should handle amounts with many decimal places', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 33.333333,
                    description: 'Decimal places test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2, testUser3],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = await expenseService.createExpense(testUser1, expenseData);

                expect(result.amount).toBe(33.333333);

                const expectedSplitAmount = 33.333333 / 3;
                result.splits.forEach((split: any) => {
                    expect(split.amount).toBeCloseTo(expectedSplitAmount, 2);
                });
            });

            it('should handle very large amounts', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 999999.99,
                    description: 'Large amount test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = await expenseService.createExpense(testUser1, expenseData);

                expect(result.amount).toBe(999999.99);
                expect(result.splits).toHaveLength(2);

                const totalSplits = result.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBeCloseTo(999999.99, 1);
            });
        });

        describe('Invalid Amount Validation', () => {
            it('should reject zero amounts', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 0,
                    description: 'Zero amount test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject negative amounts', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: -50,
                    description: 'Negative amount test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject very small negative numbers', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: -0.01,
                    description: 'Tiny negative test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject negative infinity', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: Number.NEGATIVE_INFINITY,
                    description: 'Negative infinity test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should handle NaN values gracefully', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: NaN,
                    description: 'NaN test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });
        });
    });

    describe('Split Validation', () => {
        describe('Exact Split Validation', () => {
            it('should reject splits that do not add up to total amount', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Split validation test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 60 },
                        { uid: testUser2, amount: 30 }, // Only adds up to 90, not 100
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should accept splits with minor rounding differences (within 1 cent)', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Rounding test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2, testUser3],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 33.33 },
                        { uid: testUser2, amount: 33.33 },
                        { uid: testUser3, amount: 33.34 }, // Total: 100.00
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = await expenseService.createExpense(testUser1, expenseData);

                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject splits with differences greater than 1 cent', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Large difference test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 50.0 },
                        { uid: testUser2, amount: 49.0 }, // Total: 99.00
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject negative split amounts', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Negative split test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 120 },
                        { uid: testUser2, amount: -20 }, // Negative amount
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject zero split amounts', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Zero split test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 100 },
                        { uid: testUser2, amount: 0 }, // Zero amount
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject duplicate users in splits', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Duplicate user test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 50 },
                        { uid: testUser1, amount: 50 }, // Duplicate user
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject splits for users not in participants list', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Invalid participant test',
                    paidBy: testUser1,
                    participants: [testUser1], // Only user1 is a participant
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 50 },
                        { uid: testUser2, amount: 50 }, // User2 is not a participant
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should require splits for all participants in exact split type', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Missing splits test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2, testUser3], // 3 participants
                    splitType: 'exact',
                    splits: [
                        { uid: testUser1, amount: 50 },
                        { uid: testUser2, amount: 50 }, // Missing split for user3
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });
        });

        describe('Percentage Split Validation', () => {
            it('should reject percentages that do not add up to 100%', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Percentage validation test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'percentage',
                    splits: [
                        { uid: testUser1, amount: 60, percentage: 60 },
                        { uid: testUser2, amount: 30, percentage: 30 }, // Only adds up to 90%
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should accept percentages with minor rounding differences (within 0.01%)', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Percentage rounding test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2, testUser3],
                    splitType: 'percentage',
                    splits: [
                        { uid: testUser1, amount: 33.33, percentage: 33.33 },
                        { uid: testUser2, amount: 33.33, percentage: 33.33 },
                        { uid: testUser3, amount: 33.34, percentage: 33.34 }, // Total: 100.00%
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = await expenseService.createExpense(testUser1, expenseData);

                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject negative percentages', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Negative percentage test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2],
                    splitType: 'percentage',
                    splits: [
                        { uid: testUser1, amount: 120, percentage: 120 },
                        { uid: testUser2, amount: -20, percentage: -20 }, // Negative percentage
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should reject percentages over 100%', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Percentage over 100 test',
                    paidBy: testUser1,
                    participants: [testUser1],
                    splitType: 'percentage',
                    splits: [
                        { uid: testUser1, amount: 100, percentage: 150 }, // 150% is over limit
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });

            it('should require splits for all participants in percentage split type', async () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: testGroupId,
                    amount: 100,
                    description: 'Missing percentage splits test',
                    paidBy: testUser1,
                    participants: [testUser1, testUser2], // 2 participants
                    splitType: 'percentage',
                    splits: [
                        { uid: testUser1, amount: 100, percentage: 100 }, // Missing split for user2
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
            });
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', async () => {
            const settlementData: CreateSettlementRequest = {
                groupId: testGroupId,
                payerId: testUser1,
                payeeId: testUser2,
                amount: -50, // Negative amount
                currency: 'USD',
                note: 'Test negative settlement',
            };

            await expect(settlementService.createSettlement(settlementData, testUser1)).rejects.toThrow(ApiError);
        });

        it('should reject zero settlement amounts', async () => {
            const settlementData: CreateSettlementRequest = {
                groupId: testGroupId,
                payerId: testUser1,
                payeeId: testUser2,
                amount: 0, // Zero amount
                currency: 'USD',
                note: 'Test zero settlement',
            };

            await expect(settlementService.createSettlement(settlementData, testUser1)).rejects.toThrow(ApiError);
        });

        it('should validate settlement amount does not exceed maximum', async () => {
            const settlementData: CreateSettlementRequest = {
                groupId: testGroupId,
                payerId: testUser1,
                payeeId: testUser2,
                amount: 1000000, // Amount exceeds max of 999,999.99
                currency: 'USD',
                note: 'Test max amount',
            };

            await expect(settlementService.createSettlement(settlementData, testUser1)).rejects.toThrow(ApiError);
        });

        it('should accept valid settlement amounts', async () => {
            const settlementData: CreateSettlementRequest = {
                groupId: testGroupId,
                payerId: testUser1,
                payeeId: testUser2,
                amount: 50.0,
                currency: 'USD',
                note: 'Valid settlement test',
            };

            const result = await settlementService.createSettlement(settlementData, testUser1);

            expect(result.amount).toBe(50.0);
            expect(result.payerId).toBe(testUser1);
            expect(result.payeeId).toBe(testUser2);
        });
    });

    describe('Date Validation', () => {
        it('should reject future dates', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const expenseData: CreateExpenseRequest = {
                groupId: testGroupId,
                amount: 100,
                description: 'Future date test',
                paidBy: testUser1,
                participants: [testUser1],
                splitType: 'equal',
                category: 'other',
                currency: 'USD',
                date: futureDate.toISOString(),
            };

            await expect(expenseService.createExpense(testUser1, expenseData)).rejects.toThrow(ApiError);
        });

        it('should accept valid dates', async () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData: CreateExpenseRequest = {
                groupId: testGroupId,
                amount: 100,
                description: 'Valid date test',
                paidBy: testUser1,
                participants: [testUser1],
                splitType: 'equal',
                category: 'other',
                currency: 'USD',
                date: validDate.toISOString(),
            };

            const result = await expenseService.createExpense(testUser1, expenseData);

            expect(result.id).toBeDefined();
            expect(result.amount).toBe(100);
        });
    });

    describe('Category Validation', () => {
        it('should accept valid category', async () => {
            const expenseData: CreateExpenseRequest = {
                groupId: testGroupId,
                amount: 100,
                description: 'Valid category test',
                paidBy: testUser1,
                participants: [testUser1],
                splitType: 'equal',
                category: 'food',
                currency: 'USD',
                date: new Date().toISOString(),
            };

            const result = await expenseService.createExpense(testUser1, expenseData);

            expect(result.id).toBeDefined();
            expect(result.category).toBe('food');
        });
    });
});

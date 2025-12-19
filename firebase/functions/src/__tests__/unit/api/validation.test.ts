import { calculateEqualSplits, toAmount, toCurrencyISOCode, toEmail, toExpenseId, toPassword, toUserId, USD } from '@billsplit-wl/shared';
import type { ShareLinkToken, UserId } from '@billsplit-wl/shared';
import {
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseSplitBuilder,
    ExpenseUpdateBuilder,
    PasswordChangeRequestBuilder,
    RegisterRequestBuilder,
    SettlementUpdateBuilder,
    UserRegistrationBuilder,
} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('validation and edge cases', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId;
    let user4: UserId;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users, admin } = await appDriver.createTestUsers({
            count: 4,
            includeAdmin: true,
        });
        [user1, user2, user3, user4] = users;
        adminUser = admin!;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    it('should reject expense creation when splits total does not match amount', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        const invalidExpense = new CreateExpenseRequestBuilder()
            .withGroupId(groupId)
            .withAmount(100, USD)
            .withPaidBy(user1)
            .withParticipants(participants)
            .withSplitType('exact')
            .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
            .withMismatchedSplitTotal(['80.00', '30.00']) // total 110 != 100
            .build();

        await expect(appDriver.createExpense(invalidExpense, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject expense creation with invalid currency precision', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        // JPY doesn't support decimals, so 12.34 is invalid precision
        const invalidExpense = new CreateExpenseRequestBuilder()
            .withGroupId(groupId)
            .withAmount(12, toCurrencyISOCode('JPY'))
            .withPaidBy(user1)
            .withParticipants(participants)
            .withSplitType('exact')
            .withSplits(calculateEqualSplits(toAmount(12), toCurrencyISOCode('JPY'), participants))
            .withInvalidCurrencyPrecision('12.34', ['6.17', '6.17'])
            .build();

        await expect(appDriver.createExpense(invalidExpense, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject group comment creation with empty text', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        await expect(appDriver.createGroupComment(groupId, '', undefined, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_COMMENT_TEXT' } });
    });

    it('should reject share link previews with invalid tokens', async () => {
        await expect(appDriver.previewGroupByLink('invalid-token-123' as ShareLinkToken, user1))
            .rejects
            .toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should reject group updates without any fields', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        await expect(appDriver.updateGroup(group.id, {} as any, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject settlement updates with invalid amount precision', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(120, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(120), USD, participants))
                .build(),
            user1,
        );

        await appDriver.createSettlement(
            new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(60.00, USD)
                .build(),
            user2,
        );

        const details = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const settlementId = details.settlements.settlements[0].id;

        await expect(appDriver.updateSettlement(settlementId, new SettlementUpdateBuilder().withAmount('20.123', USD).withCurrency(USD).build(), user2))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject expense comment creation with empty text', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(30, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(30), USD, participants))
                .build(),
            user1,
        );

        await expect(appDriver.createExpenseComment(expense.id, '', undefined, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_COMMENT_TEXT' } });
    });

    it('should reject expense creation with invalid receipt URL', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        const expense = new CreateExpenseRequestBuilder()
            .withGroupId(groupId)
            .withDescription('Invalid receipt URL')
            .withAmount(40, USD)
            .withPaidBy(user1)
            .withReceiptUrl('not-a-url')
            .withParticipants(participants)
            .withSplitType('equal')
            .withSplits(calculateEqualSplits(toAmount(40), USD, participants))
            .build();

        await expect(appDriver.createExpense(expense, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject expense updates when participants include non-members', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const baseExpense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Original expense')
                .withAmount(60, USD)
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(60), USD, [user1, user2]))
                .build(),
            user1,
        );

        const updatedParticipants = [user1, user2, user4];
        const updatedSplits = calculateEqualSplits(toAmount(90), USD, updatedParticipants);

        await expect(appDriver.updateExpense(
            baseExpense.id,
            ExpenseUpdateBuilder
                .minimal()
                .withAmount(90, USD)
                .withParticipants(updatedParticipants)
                .withSplits(updatedSplits)
                .withSplitType('equal')
                .build(),
            user1,
        ))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should reject group member display name updates with empty value', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        await expect(appDriver.updateGroupMemberDisplayName(groupId, '', user2))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_DISPLAY_NAME' } });
    });

    it('should reject group member display name updates when the name collides with another member (base58 normalization)', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        // Owner picks a display name that should conflict with visually similar variants.
        await appDriver.updateGroupMemberDisplayName(groupId, 'Alice', user1);

        await expect(appDriver.updateGroupMemberDisplayName(groupId, 'ALICE', user2))
            .rejects
            .toMatchObject({ code: 'CONFLICT' });
    });

    it('should reject settlements involving non-members', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const settlement = new CreateSettlementRequestBuilder()
            .withGroupId(groupId)
            .withPayerId(user4)
            .withPayeeId(user1)
            .withAmount(20.00, USD)
            .build();

        await expect(appDriver.createSettlement(settlement, user1))
            .rejects
            .toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    describe('split validation', () => {
        it('should reject percentage splits not totaling 100%', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];
            const invalidPercentageSplits = new ExpenseSplitBuilder()
                .withSplit(user1, '40.00', 40)
                .withSplit(user2, '40.00', 40)
                .withSplit(user3, '19.00', 19)
                .build();

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('percentage')
                .withSplits(invalidPercentageSplits)
                .build();

            await expect(appDriver.createExpense(expenseRequest, user1))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject negative percentage in splits', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const invalidPercentageSplits = new ExpenseSplitBuilder()
                .withSplit(user1, '120.00', 120)
                .withSplit(user2, '-20.00', -20)
                .build();

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('percentage')
                .withSplits(invalidPercentageSplits)
                .build();

            await expect(appDriver.createExpense(expenseRequest, user1))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject expense where payer is not a participant', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2];
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, USD)
                .withPaidBy(user3)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                .build();

            await expect(appDriver.createExpense(expenseRequest, user1))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should handle equal split with single participant', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const singleParticipant = [user1];
            const splits = calculateEqualSplits(toAmount(100), USD, singleParticipant);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(singleParticipant)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            expect(expense.id).toBeDefined();

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            expect(usdBalances![user1].netBalance).toBe('0.00');
            expect(usdBalances![user1].owedBy).toEqual({});
            expect(usdBalances![user1].owes).toEqual({});
        });
    });

    describe('boundary and limit testing', () => {
        it('should handle very large expense amounts', async () => {
            const LARGE_AMOUNT = toAmount(9999999.99);
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(LARGE_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            expect(expense.amount).toBe(String(LARGE_AMOUNT));
        });

        it('should handle minimum valid amounts', async () => {
            const MIN_AMOUNT = toAmount(0.02);
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const splits = calculateEqualSplits(MIN_AMOUNT, CURRENCY, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(MIN_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            expect(expense.amount).toBe(String(MIN_AMOUNT));
        });

        it('should enforce maximum length on group description', async () => {
            const longDescription = 'x'.repeat(10000);

            await expect(
                appDriver.createGroup(
                    new CreateGroupRequestBuilder()
                        .withName('Test Group')
                        .withDescription(longDescription)
                        .build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_DESCRIPTION' } });
        });

        it('should enforce maximum length on expense description', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const longDescription = 'x'.repeat(10000);
            const participants = [user1];

            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription(longDescription)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                        .build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_DESCRIPTION' } });
        });

        it('should handle expense with many participants', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);

            // Join initial users to the group
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);
            await appDriver.joinGroupByLink(shareToken, undefined, user4);

            const manyUsers = [user1, user2, user3, user4];
            for (let i = 5; i <= 20; i++) {
                // Register user via API
                const userReg = new UserRegistrationBuilder()
                    .withEmail(`user${i}@example.com`)
                    .withDisplayName(`User ${i}`)
                    .withPassword('password12345')
                    .build();
                const userResult = await appDriver.registerUser(userReg);
                const userId = toUserId(userResult.user.uid);
                await appDriver.joinGroupByLink(shareToken, undefined, userId);
                manyUsers.push(userId);
            }

            const AMOUNT = toAmount(1000);
            const CURRENCY = USD;
            const splits = calculateEqualSplits(AMOUNT, CURRENCY, manyUsers);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(manyUsers)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            expect(expense.id).toBeDefined();
        });
    });

    describe('data consistency and integrity', () => {
        it('should reject malformed group ID', async () => {
            await expect(appDriver.getGroupFullDetails('not-a-valid-id', {}, user1))
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject creating expense with zero amount', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const participants = [user1];
            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(0, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits([{ uid: user1, amount: '0.00' }])
                        .build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_AMOUNT' } });
        });

        it('should reject creating expense with negative amount', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const participants = [user1];
            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(-100, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits([{ uid: user1, amount: '-100.00' }])
                        .build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR', data: { detail: 'INVALID_AMOUNT' } });
        });

        it('should reject settlement with zero amount', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(groupId)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(0.00, USD)
                        .build(),
                    user2,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject settlement with negative amount', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(groupId)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount('-25.00', USD)
                        .build(),
                    user2,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });
    });

    describe('user account endpoints', () => {
        it('should reject registration when privacy policy is not accepted', async () => {
            await expect(
                appDriver.registerUser(
                    new RegisterRequestBuilder()
                        .withDisplayName('Privacy Reject')
                        .withEmail('privacy.reject@example.com')
                        .withPassword('ValidPass123!')
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(true)
                        .withPrivacyPolicyAccepted(false)
                        .build(),
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        describe('changePassword', () => {
            const VALID_CURRENT_PASSWORD = toPassword('password12345');
            const VALID_NEW_PASSWORD = toPassword('NewSecurePass123!');

            it('should reject when current password is incorrect', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword('WrongPassword123!')
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'AUTH_INVALID' });
            });

            it('should reject when new password is same as current', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword(VALID_CURRENT_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when new password is too short', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword('Short1!')
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when currentPassword field is missing', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when newPassword field is missing', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when currentPassword is empty string', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword('')
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when newPassword is empty string', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword('')
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });
        });

        describe('changeEmail', () => {
            const CURRENT_PASSWORD = toPassword('password12345');
            const NEW_EMAIL = toEmail('newemail@example.com');

            it('should reject when current password is incorrect', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: toPassword('WrongPassword123!'),
                        newEmail: NEW_EMAIL,
                    }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'AUTH_INVALID' });
            });

            it('should reject when new email is same as current email', async () => {
                const currentProfile = await appDriver.getUserProfile(user1);

                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: currentProfile.email!,
                    }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_REQUEST' });
            });

            it('should reject when new email has invalid format', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: toEmail('not-an-email'),
                    }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when currentPassword field is missing', async () => {
                await expect(
                    appDriver.changeEmail({
                        newEmail: NEW_EMAIL,
                    } as any, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when newEmail field is missing', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                    } as any, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when currentPassword is empty string', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: toPassword(''),
                        newEmail: NEW_EMAIL,
                    }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject when newEmail is empty string', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: toEmail(''),
                    }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            // NOTE: Email duplicate check doesn't happen at changeEmail time.
            // The new flow sends a verification email first; duplicate checking
            // would happen when the user clicks the verification link.
            // See users.test.ts for comprehensive changeEmail tests.
        });
    });

    it('should prevent removal of member with outstanding balance', async () => {
        const CURRENCY = USD;

        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user3);

        const participants = [user1, user2, user3];

        await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(150, CURRENCY)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(150), CURRENCY, participants))
                .build(),
            user1,
        );

        const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

        expect(usdBalances).toBeDefined();
        expect(usdBalances![user3].netBalance).not.toBe('0.00');

        await expect(appDriver.removeGroupMember(groupId, user3, user1))
            .rejects
            .toMatchObject({
                code: 'CONFLICT',
            });
    });

    it('should allow removal of member with zero balance', async () => {
        const CURRENCY = toCurrencyISOCode('EUR');
        const eur = CURRENCY;

        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user3);

        await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, CURRENCY)
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(100), CURRENCY, [user1, user2]))
                .build(),
            user1,
        );

        let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

        expect(eurBalances).toBeDefined();
        expect(eurBalances![user3].netBalance).toBe('0.00');

        await appDriver.removeGroupMember(groupId, user3, user1);

        groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const members = groupDetails.members.members;

        expect(members).toHaveLength(2);
        expect(members.find(m => m.uid === user3)).toBeUndefined();
    });

    it('should reject operations on deleted group', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        await appDriver.deleteGroup(groupId, user1);

        const participants = [user1];
        await expect(
            appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            ),
        )
            .rejects
            .toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should reject malformed expense ID', async () => {
        await expect(appDriver.getExpenseFullDetails(toExpenseId('not-a-valid-id'), user1))
            .rejects
            .toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should reject operations on non-existent expense', async () => {
        await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const nonExistentExpenseId = 'expense-does-not-exist';

        await expect(appDriver.deleteExpense(nonExistentExpenseId, user1))
            .rejects
            .toMatchObject({ code: 'NOT_FOUND' });
    });
});

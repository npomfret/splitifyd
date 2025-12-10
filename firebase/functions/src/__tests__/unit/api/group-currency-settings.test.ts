import { calculateEqualSplits, EUR, GBP, MemberRoles, toAmount, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder, GroupUpdateBuilder, SettlementUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('group currency settings', () => {
    let appDriver: AppDriver;
    let adminUser: UserId;
    let memberUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const { users } = await appDriver.createTestUsers({ count: 2 });
        [adminUser, memberUser] = users;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('group creation with currency settings', () => {
        it('should create group with currency settings', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Trip to Europe')
                    .withCurrencySettings(['USD', 'EUR', 'GBP'], 'EUR')
                    .build(),
                adminUser,
            );

            expect(group.currencySettings).toBeDefined();
            expect(group.currencySettings!.permitted).toEqual([
                toCurrencyISOCode('USD'),
                toCurrencyISOCode('EUR'),
                toCurrencyISOCode('GBP'),
            ]);
            expect(group.currencySettings!.default).toBe(toCurrencyISOCode('EUR'));
        });

        it('should create group without currency settings (all currencies allowed)', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('General Group')
                    .build(),
                adminUser,
            );

            expect(group.currencySettings).toBeUndefined();
        });

        it('should reject creation when default is not in permitted list', async () => {
            await expect(
                appDriver.createGroup(
                    new CreateGroupRequestBuilder()
                        .withName('Invalid Settings')
                        .withCurrencySettingsObject({
                            permitted: [toCurrencyISOCode('USD'), toCurrencyISOCode('EUR')],
                            default: toCurrencyISOCode('GBP'), // Not in permitted
                        })
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow();
        });

        it('should reject creation with empty permitted list', async () => {
            await expect(
                appDriver.createGroup(
                    new CreateGroupRequestBuilder()
                        .withName('Empty Permitted')
                        .withCurrencySettingsObject({
                            permitted: [] as any,
                            default: toCurrencyISOCode('USD'),
                        })
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow();
        });
    });

    describe('group update with currency settings', () => {
        it('should allow admin to add currency settings to existing group', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('No Settings Initially').build(),
                adminUser,
            );

            expect(group.currencySettings).toBeUndefined();

            await appDriver.updateGroup(
                group.id,
                GroupUpdateBuilder
                    .empty()
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            const updatedGroup = await appDriver.getGroupFullDetails(group.id, {}, adminUser);
            expect(updatedGroup.group.currencySettings).toBeDefined();
            expect(updatedGroup.group.currencySettings!.permitted).toEqual([
                toCurrencyISOCode('USD'),
                toCurrencyISOCode('EUR'),
            ]);
            expect(updatedGroup.group.currencySettings!.default).toBe(toCurrencyISOCode('USD'));
        });

        it('should allow admin to clear currency settings (set to null)', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Has Settings')
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            expect(group.currencySettings).toBeDefined();

            await appDriver.updateGroup(
                group.id,
                GroupUpdateBuilder.empty().clearCurrencySettings().build(),
                adminUser,
            );

            const updatedGroup = await appDriver.getGroupFullDetails(group.id, {}, adminUser);
            // When cleared, currencySettings is set to null in the database
            expect(updatedGroup.group.currencySettings).toBeNull();
        });

        it('should reject update when default is not in permitted list', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                adminUser,
            );

            await expect(
                appDriver.updateGroup(
                    group.id,
                    GroupUpdateBuilder
                        .empty()
                        .withCurrencySettingsObject({
                            permitted: [toCurrencyISOCode('USD')],
                            default: toCurrencyISOCode('EUR'), // Not in permitted
                        })
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow();
        });

        it('should reject update by non-admin member', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                adminUser,
            );

            // Add member to group
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            // Member tries to update currency settings
            await expect(
                appDriver.updateGroup(
                    group.id,
                    GroupUpdateBuilder
                        .empty()
                        .withCurrencySettings(['USD'], 'USD')
                        .build(),
                    memberUser,
                ),
            )
                .rejects
                .toThrow(/FORBIDDEN|INSUFFICIENT_PERMISSIONS/);
        });
    });

    describe('expense creation with currency restrictions', () => {
        it('should allow expense with permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD and EUR Only')
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const splits = calculateEqualSplits(toAmount(50), USD, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Lunch')
                    .withAmount(50, USD)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                adminUser,
            );

            expect(expense.currency).toBe(toCurrencyISOCode('USD'));
        });

        it('should reject expense with non-permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD Only')
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const splits = calculateEqualSplits(toAmount(50), EUR, participants);

            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withDescription('Dinner')
                        .withAmount(50, EUR) // EUR is not permitted
                        .withPaidBy(adminUser)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow(/CURRENCY_NOT_PERMITTED|FORBIDDEN/);
        });

        it('should allow any currency when no settings defined', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('No Restrictions')
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const splits = calculateEqualSplits(toAmount(100), GBP, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Tea')
                    .withAmount(100, GBP)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                adminUser,
            );

            expect(expense.currency).toBe(toCurrencyISOCode('GBP'));
        });

        it('should allow expense with any permitted currency, not just default', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi-currency')
                    .withCurrencySettings(['USD', 'EUR', 'GBP'], 'USD') // Default is USD
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const eurSplits = calculateEqualSplits(toAmount(75), EUR, participants);

            // Should allow EUR even though default is USD
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Paris dinner')
                    .withAmount(75, EUR)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(eurSplits)
                    .build(),
                adminUser,
            );

            expect(expense.currency).toBe(toCurrencyISOCode('EUR'));
        });
    });

    describe('expense update with currency restrictions', () => {
        it('should allow updating expense to a permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi-currency')
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const usdSplits = calculateEqualSplits(toAmount(50), USD, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Original')
                    .withAmount(50, USD)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdSplits)
                    .build(),
                adminUser,
            );

            const eurSplits = calculateEqualSplits(toAmount(45), EUR, participants);

            const updatedExpense = await appDriver.updateExpense(
                expense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(45, EUR)
                    .withParticipants(participants)
                    .withSplits(eurSplits)
                    .build(),
                adminUser,
            );

            expect(updatedExpense.currency).toBe(toCurrencyISOCode('EUR'));
        });

        it('should reject updating expense to a non-permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD Only')
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            const participants = [adminUser];
            const usdSplits = calculateEqualSplits(toAmount(50), USD, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Original')
                    .withAmount(50, USD)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdSplits)
                    .build(),
                adminUser,
            );

            const eurSplits = calculateEqualSplits(toAmount(45), EUR, participants);

            await expect(
                appDriver.updateExpense(
                    expense.id,
                    ExpenseUpdateBuilder
                        .minimal()
                        .withAmount(45, EUR) // EUR is not permitted
                        .withParticipants(participants)
                        .withSplits(eurSplits)
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow(/CURRENCY_NOT_PERMITTED|FORBIDDEN/);
        });
    });

    describe('clearing currency settings', () => {
        it('should allow any currency after settings are cleared', async () => {
            // Create group with restrictions
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Initially Restricted')
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            // Clear the settings
            await appDriver.updateGroup(
                group.id,
                GroupUpdateBuilder.empty().clearCurrencySettings().build(),
                adminUser,
            );

            // Now should be able to use any currency
            const participants = [adminUser];
            const gbpSplits = calculateEqualSplits(toAmount(100), GBP, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('GBP allowed now')
                    .withAmount(100, GBP)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(gbpSplits)
                    .build(),
                adminUser,
            );

            expect(expense.currency).toBe(toCurrencyISOCode('GBP'));
        });
    });

    describe('settlement creation with currency restrictions', () => {
        it('should allow settlement with permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD and EUR Only')
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            // Add a second member so we have someone to settle with
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(adminUser)
                    .withPayeeId(memberUser)
                    .withAmount(50, USD)
                    .withNote('Test settlement')
                    .build(),
                adminUser,
            );

            expect(settlement.currency).toBe(toCurrencyISOCode('USD'));
        });

        it('should reject settlement with non-permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD Only')
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            // Add a second member so we have someone to settle with
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(adminUser)
                        .withPayeeId(memberUser)
                        .withAmount(50, EUR) // EUR is not permitted
                        .withNote('Test settlement')
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow(/CURRENCY_NOT_PERMITTED|FORBIDDEN/);
        });

        it('should allow any currency for settlement when no settings defined', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('No Restrictions')
                    .build(),
                adminUser,
            );

            // Add a second member so we have someone to settle with
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(adminUser)
                    .withPayeeId(memberUser)
                    .withAmount(100, GBP)
                    .withNote('Test settlement')
                    .build(),
                adminUser,
            );

            expect(settlement.currency).toBe(toCurrencyISOCode('GBP'));
        });
    });

    describe('settlement update with currency restrictions', () => {
        it('should allow updating settlement to a permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi-currency')
                    .withCurrencySettings(['USD', 'EUR'], 'USD')
                    .build(),
                adminUser,
            );

            // Add a second member
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(adminUser)
                    .withPayeeId(memberUser)
                    .withAmount(50, USD)
                    .withNote('Original settlement')
                    .build(),
                adminUser,
            );

            const updatedSettlement = await appDriver.updateSettlement(
                settlement.id,
                SettlementUpdateBuilder
                    .empty()
                    .withAmount(45, EUR)
                    .build(),
                adminUser,
            );

            expect(updatedSettlement.currency).toBe(toCurrencyISOCode('EUR'));
        });

        it('should reject updating settlement to a non-permitted currency', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('USD Only')
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            // Add a second member
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(adminUser)
                    .withPayeeId(memberUser)
                    .withAmount(50, USD)
                    .withNote('Original settlement')
                    .build(),
                adminUser,
            );

            await expect(
                appDriver.updateSettlement(
                    settlement.id,
                    SettlementUpdateBuilder
                        .empty()
                        .withAmount(45, EUR) // EUR is not permitted
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toThrow(/CURRENCY_NOT_PERMITTED|FORBIDDEN/);
        });
    });

    describe('API response includes currency settings', () => {
        it('should include currencySettings in getGroupFullDetails response', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Group with settings')
                    .withCurrencySettings(['USD', 'EUR', 'GBP'], 'EUR')
                    .build(),
                adminUser,
            );

            const details = await appDriver.getGroupFullDetails(group.id, {}, adminUser);

            expect(details.group.currencySettings).toBeDefined();
            expect(details.group.currencySettings!.permitted).toEqual([
                toCurrencyISOCode('USD'),
                toCurrencyISOCode('EUR'),
                toCurrencyISOCode('GBP'),
            ]);
            expect(details.group.currencySettings!.default).toBe(toCurrencyISOCode('EUR'));
        });

        it('should include currencySettings in listGroups response', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Listed group with settings')
                    .withCurrencySettings(['USD', 'GBP'], 'GBP')
                    .build(),
                adminUser,
            );

            const response = await appDriver.listGroups({}, adminUser);
            const listedGroup = response.groups.find(g => g.id === group.id);

            expect(listedGroup).toBeDefined();
            expect(listedGroup!.currencySettings).toBeDefined();
            expect(listedGroup!.currencySettings!.permitted).toEqual([
                toCurrencyISOCode('USD'),
                toCurrencyISOCode('GBP'),
            ]);
            expect(listedGroup!.currencySettings!.default).toBe(toCurrencyISOCode('GBP'));
        });
    });

    describe('existing data with changed currency settings', () => {
        it('should still be able to read expense with now-disallowed currency', async () => {
            // Create group without restrictions
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Initially unrestricted')
                    .build(),
                adminUser,
            );

            // Create expense with EUR
            const participants = [adminUser];
            const splits = calculateEqualSplits(toAmount(100), EUR, participants);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('EUR expense')
                    .withAmount(100, EUR)
                    .withPaidBy(adminUser)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                adminUser,
            );

            // Now restrict to USD only
            await appDriver.updateGroup(
                group.id,
                GroupUpdateBuilder
                    .empty()
                    .withCurrencySettings(['USD'], 'USD')
                    .build(),
                adminUser,
            );

            // Should still be able to read group details including the EUR expense
            const details = await appDriver.getGroupFullDetails(group.id, {}, adminUser);

            expect(details.group.currencySettings).toBeDefined();
            expect(details.group.currencySettings!.permitted).toEqual([toCurrencyISOCode('USD')]);

            // The expense should still be present and readable
            const eurExpense = details.expenses.expenses.find(e => e.id === expense.id);
            expect(eurExpense).toBeDefined();
            expect(eurExpense!.currency).toBe(toCurrencyISOCode('EUR'));
        });
    });

    describe('viewer role permissions', () => {
        it('should reject currency settings update by viewer', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                adminUser,
            );

            // Add member and change to viewer role
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUser);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUser);
            await appDriver.updateMemberRole(group.id, memberUser, MemberRoles.VIEWER, adminUser);

            // Viewer tries to update currency settings
            await expect(
                appDriver.updateGroup(
                    group.id,
                    GroupUpdateBuilder
                        .empty()
                        .withCurrencySettings(['USD'], 'USD')
                        .build(),
                    memberUser,
                ),
            )
                .rejects
                .toThrow(/FORBIDDEN|INSUFFICIENT_PERMISSIONS/);
        });
    });
});

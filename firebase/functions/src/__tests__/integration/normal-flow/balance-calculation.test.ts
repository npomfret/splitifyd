import {beforeEach, describe, expect, it} from 'vitest';

import {ApiDriver, borrowTestUsers} from '@splitifyd/test-support';
import { CreateGroupRequestBuilder, ExpenseBuilder } from '@splitifyd/test-support';
import {UserToken} from "@splitifyd/shared";

describe('Balance Calculation Integration Test', () => {
    let apiDriver = new ApiDriver()
    let groupId: string;
    let shareLinkId: string;

    let user1: UserToken;
    let user2: UserToken;
    let user3: UserToken;

    beforeEach(async () => {
        ([user1, user2, user3] = await borrowTestUsers(3));
    });

    it('should correctly calculate balances for multi-user expense sharing', async () => {
        // Step 1: User 1 creates a group using builder
        const groupData = new CreateGroupRequestBuilder().withName('Test Balance Group').build();
        const createGroupResponse = await apiDriver.createGroup(groupData, user1.token);
        groupId = createGroupResponse.id;

        // Step 2: User 1 creates a share link
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        shareLinkId = shareResponse.linkId;

        // Step 3: User 2 joins via share link
        await apiDriver.joinGroupViaShareLink(shareLinkId, user2.token);

        // Step 4: User 1 adds a shared expense ($100, split equally between User 1 and User 2)
        const expense1Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(100)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        const expense1Response = await apiDriver.createExpense(expense1Data, user1.token);
        expect(expense1Response.id).toBeDefined();

        // Wait for balance calculation using proper polling
        const balancesAfterFirst = await apiDriver.waitForBalanceUpdate(groupId, user1.token, 5000);

        // The balance structure has userBalances at the top level, then each user has netBalance directly
        const user1BalanceAfterFirst = balancesAfterFirst.userBalances[user1.uid];
        const user2BalanceAfterFirst = balancesAfterFirst.userBalances[user2.uid];

        expect(user1BalanceAfterFirst).toBeDefined();
        expect(user2BalanceAfterFirst).toBeDefined();
        expect(user1BalanceAfterFirst.netBalance).toBe(50); // User 1 is owed $50
        expect(user2BalanceAfterFirst.netBalance).toBe(-50); // User 2 owes $50

        // Step 5: User 2 adds another shared expense ($60, split equally)
        const expense2Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(60)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        const expense2Response = await apiDriver.createExpense(expense2Data, user2.token);
        expect(expense2Response.id).toBeDefined();

        // Wait for balance recalculation using polling
        const balancesAfterSecond = await apiDriver.pollGroupBalancesUntil(
            groupId,
            user1.token,
            (balances) => {
                // Check that balances have been updated (User 1 should be owed $20)
                const user1Balance = balances.userBalances[user1.uid];
                return user1Balance && user1Balance.netBalance === 20;
            },
            { timeout: 5000, errorMsg: 'Balance not updated after second expense' },
        );

        // After two expenses: User 1 paid $100 (gets back $50), User 2 paid $60 (gets back $30)
        // User 1 balance: +$50 - $30 = +$20 (is owed)
        // User 2 balance: -$50 + $30 = -$20 (owes)
        const user1BalanceAfterSecond = balancesAfterSecond.userBalances[user1.uid];
        const user2BalanceAfterSecond = balancesAfterSecond.userBalances[user2.uid];

        expect(user1BalanceAfterSecond.netBalance).toBe(20); // User 1 is owed $20
        expect(user2BalanceAfterSecond.netBalance).toBe(-20); // User 2 owes $20

        // Step 6: User 3 joins via share link
        await apiDriver.joinGroupViaShareLink(shareLinkId, user3.token);

        // Step 7: User 3 adds an expense ($90, split equally among all three)
        const expense3Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(90)
            .withCurrency('USD')
            .withPaidBy(user3.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        const expense3Response = await apiDriver.createExpense(expense3Data, user3.token);
        expect(expense3Response.id).toBeDefined();

        // Wait for final balance calculation using polling
        const finalBalances = await apiDriver.pollGroupBalancesUntil(
            groupId,
            user1.token,
            (balances) => {
                // Check that User 3's balance exists and is calculated
                const user3Balance = balances.userBalances[user3.uid];
                return user3Balance && user3Balance.netBalance === 60;
            },
            { timeout: 5000, errorMsg: 'Balance not updated after third expense' },
        );

        // Final balance calculation:
        // User 1: Previous balance +$20, owes $30 to User 3 = -$10
        // User 2: Previous balance -$20, owes $30 to User 3 = -$50
        // User 3: Paid $90, gets $30 from each = +$60
        const user1Final = finalBalances.userBalances[user1.uid];
        const user2Final = finalBalances.userBalances[user2.uid];
        const user3Final = finalBalances.userBalances[user3.uid];

        expect(user1Final).toBeDefined();
        expect(user2Final).toBeDefined();
        expect(user3Final).toBeDefined();

        expect(user1Final.netBalance).toBe(-10); // User 1 owes $10
        expect(user2Final.netBalance).toBe(-50); // User 2 owes $50
        expect(user3Final.netBalance).toBe(60); // User 3 is owed $60

        // Verify total balances sum to zero (conservation of money)
        const totalBalance = user1Final.netBalance + user2Final.netBalance + user3Final.netBalance;
        expect(totalBalance).toBe(0);

        // Additional verification: Check individual debts
        expect(finalBalances.simplifiedDebts).toBeDefined();
        expect(Array.isArray(finalBalances.simplifiedDebts)).toBe(true);
        
        // Expected simplified debts based on final balances:
        // User 1 owes $10 (negative balance)
        // User 2 owes $50 (negative balance) 
        // User 3 is owed $60 (positive balance)
        //
        // Optimal debt simplification should be:
        // - User 1 pays $10 to User 3
        // - User 2 pays $50 to User 3
        const debts = finalBalances.simplifiedDebts;
        expect(debts.length).toBe(2); // Should be exactly 2 debts for optimal simplification
        
        // Find the debt from User 1 to User 3
        const user1Debt = debts.find(debt => debt.from.userId === user1.uid && debt.to.userId === user3.uid);
        expect(user1Debt).toBeDefined();
        expect(user1Debt!.amount).toBe(10);
        expect(user1Debt!.currency).toBe('USD');
        
        // Find the debt from User 2 to User 3  
        const user2Debt = debts.find(debt => debt.from.userId === user2.uid && debt.to.userId === user3.uid);
        expect(user2Debt).toBeDefined();
        expect(user2Debt!.amount).toBe(50);
        expect(user2Debt!.currency).toBe('USD');
        
        // Verify no other debts exist (efficient simplification)
        const unexpectedDebts = debts.filter(debt => 
            !(debt.from.userId === user1.uid && debt.to.userId === user3.uid) &&
            !(debt.from.userId === user2.uid && debt.to.userId === user3.uid)
        );
        expect(unexpectedDebts).toHaveLength(0);
        
        // Verify total debt amounts match the balance discrepancies
        const totalDebtAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
        const totalPositiveBalance = Math.abs(user3Final.netBalance); // User 3 is owed $60
        expect(totalDebtAmount).toBe(totalPositiveBalance);

        // Get full group details to verify everything is consistent
        const fullDetails = await apiDriver.getGroupFullDetails(groupId, user1.token);

        // Verify the full details endpoint returns consistent balances
        // We know we're using USD currency, so verify the structure accordingly
        expect(fullDetails.balances.balancesByCurrency).toBeDefined();
        expect(fullDetails.balances.balancesByCurrency.USD).toBeDefined();
        expect(fullDetails.balances.balancesByCurrency.USD[user1.uid].netBalance).toBe(-10);
        expect(fullDetails.balances.balancesByCurrency.USD[user2.uid].netBalance).toBe(-50);
        expect(fullDetails.balances.balancesByCurrency.USD[user3.uid].netBalance).toBe(60);
    });
    
    it('should correctly handle complex debt simplification with circular debts', async () => {
        // Create a scenario where debt simplification is more complex
        // User 1 owes User 2, User 2 owes User 3, User 3 owes User 1 (circular)
        
        ([user1, user2, user3] = await borrowTestUsers(3));
        
        // Step 1: Create group and add all users
        const groupData = new CreateGroupRequestBuilder()
            .withName('Complex Debt Test Group')
            .build();
        const createGroupResponse = await apiDriver.createGroup(groupData, user1.token);
        groupId = createGroupResponse.id;
        
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        shareLinkId = shareResponse.linkId;
        
        await apiDriver.joinGroupViaShareLink(shareLinkId, user2.token);
        await apiDriver.joinGroupViaShareLink(shareLinkId, user3.token);
        
        // Step 2: Create expenses that result in circular debts
        // User 1 pays $120 for User 1 and User 2 (User 2 owes User 1 $60)
        const expense1Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(120)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expense1Data, user1.token);
        
        // User 2 pays $150 for User 2 and User 3 (User 3 owes User 2 $75)
        const expense2Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(150)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(expense2Data, user2.token);
        
        // User 3 pays $90 for User 3 and User 1 (User 1 owes User 3 $45)
        const expense3Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(90)
            .withCurrency('USD')
            .withPaidBy(user3.uid)
            .withSplitType('equal')
            .withParticipants([user3.uid, user1.uid])
            .build();
        await apiDriver.createExpense(expense3Data, user3.token);
        
        // Step 3: Wait for balance calculation
        const complexBalances = await apiDriver.pollGroupBalancesUntil(
            groupId,
            user1.token,
            (balances) => {
                // Wait until all users have calculated balances
                return balances.userBalances[user1.uid] && 
                       balances.userBalances[user2.uid] && 
                       balances.userBalances[user3.uid] &&
                       balances.simplifiedDebts && 
                       balances.simplifiedDebts.length > 0;
            },
            { timeout: 10000, errorMsg: 'Complex balance calculation did not complete' }
        );
        
        // Step 4: Verify net balances
        // User 1: +60 (owed by User 2) - 45 (owes User 3) = +15
        // User 2: -60 (owes User 1) + 75 (owed by User 3) = +15  
        // User 3: -75 (owes User 2) + 45 (owed by User 1) = -30
        const user1Balance = complexBalances.userBalances[user1.uid];
        const user2Balance = complexBalances.userBalances[user2.uid];
        const user3Balance = complexBalances.userBalances[user3.uid];
        
        expect(user1Balance.netBalance).toBe(15);
        expect(user2Balance.netBalance).toBe(15);
        expect(user3Balance.netBalance).toBe(-30);
        
        // Verify conservation of money
        const total = user1Balance.netBalance + user2Balance.netBalance + user3Balance.netBalance;
        expect(total).toBe(0);
        
        // Step 5: Verify debt simplification
        expect(complexBalances.simplifiedDebts).toBeDefined();
        const debts = complexBalances.simplifiedDebts;
        expect(Array.isArray(debts)).toBe(true);
        
        // With optimal simplification, User 3 should pay $15 to User 1 and $15 to User 2
        // Or some other optimal arrangement that minimizes transactions
        expect(debts.length).toBeGreaterThan(0);
        expect(debts.length).toBeLessThanOrEqual(3); // Should not need more than 3 transactions
        
        // Verify each debt has required properties
        debts.forEach(debt => {
            expect(debt.from).toBeDefined();
            expect(debt.from.userId).toBeDefined();
            expect(debt.to).toBeDefined();
            expect(debt.to.userId).toBeDefined();
            expect(typeof debt.amount).toBe('number');
            expect(debt.amount).toBeGreaterThan(0);
            expect(debt.currency).toBe('USD');
        });
        
        // Verify total debt amounts equal total negative balances
        const totalDebtAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
        const totalNegativeBalances = Math.abs(user3Balance.netBalance); // Only User 3 has negative balance
        expect(totalDebtAmount).toBe(totalNegativeBalances);
        
        // Verify no user appears as both debtor and creditor (optimal simplification)
        const debtors = new Set(debts.map(debt => debt.from.userId));
        const creditors = new Set(debts.map(debt => debt.to.userId));
        const intersection = [...debtors].filter(userId => creditors.has(userId));
        expect(intersection.length).toBe(0); // No user should be both owing and owed money after simplification
    });
    
    it('should handle zero-sum scenario with no debts', async () => {
        ([user1, user2] = await borrowTestUsers(2));
        
        // Create group
        const groupData = new CreateGroupRequestBuilder()
            .withName('Zero Sum Test Group')
            .build();
        const createGroupResponse = await apiDriver.createGroup(groupData, user1.token);
        groupId = createGroupResponse.id;
        
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
        
        // User 1 pays $50, split equally (User 2 owes $25)
        const expense1Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expense1Data, user1.token);
        
        // User 2 pays $50, split equally (User 1 owes $25)
        const expense2Data = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expense2Data, user2.token);
        
        // Wait for balance calculation
        const zeroSumBalances = await apiDriver.waitForBalanceUpdate(groupId, user1.token, 5000);
        
        // Both users should have zero net balance
        expect(zeroSumBalances.userBalances[user1.uid].netBalance).toBe(0);
        expect(zeroSumBalances.userBalances[user2.uid].netBalance).toBe(0);
        
        // Simplified debts should be empty or contain no meaningful debts
        expect(zeroSumBalances.simplifiedDebts).toBeDefined();
        expect(Array.isArray(zeroSumBalances.simplifiedDebts)).toBe(true);
        
        // Filter out any minimal debts (due to floating point precision)
        const significantDebts = zeroSumBalances.simplifiedDebts.filter(debt => Math.abs(debt.amount) > 0.01);
        expect(significantDebts).toHaveLength(0);
    });
    
    it('should correctly handle multi-currency debt simplification', async () => {
        // Test scenario: Group with expenses in multiple currencies
        // This tests that debt simplification works correctly when dealing with USD, EUR, and GBP
        
        ([user1, user2, user3] = await borrowTestUsers(3));
        
        // Create group
        const groupData = new CreateGroupRequestBuilder()
            .withName('International Travel Group')
            .build();
        const createGroupResponse = await apiDriver.createGroup(groupData, user1.token);
        groupId = createGroupResponse.id;
        
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        shareLinkId = shareResponse.linkId;
        
        await apiDriver.joinGroupViaShareLink(shareLinkId, user2.token);
        await apiDriver.joinGroupViaShareLink(shareLinkId, user3.token);
        
        // Create expenses in USD
        const usdExpense1 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(300) // $300
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(usdExpense1, user1.token);
        
        // Create expenses in EUR
        const eurExpense1 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(150) // €150
            .withCurrency('EUR')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(eurExpense1, user2.token);
        
        const eurExpense2 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(60) // €60
            .withCurrency('EUR')
            .withPaidBy(user3.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(eurExpense2, user3.token);
        
        // Create expenses in GBP
        const gbpExpense1 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(90) // £90
            .withCurrency('GBP')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(gbpExpense1, user1.token);
        
        // Wait for balance calculation
        const multiCurrencyBalances = await apiDriver.pollGroupBalancesUntil(
            groupId,
            user1.token,
            (balances) => {
                // Wait until all currencies are calculated
                return balances.balancesByCurrency &&
                       balances.balancesByCurrency.USD &&
                       balances.balancesByCurrency.EUR &&
                       balances.balancesByCurrency.GBP &&
                       balances.simplifiedDebts &&
                       balances.simplifiedDebts.length > 0;
            },
            { timeout: 10000, errorMsg: 'Multi-currency balance calculation did not complete' }
        );
        
        // Verify balances by currency
        expect(multiCurrencyBalances.balancesByCurrency).toBeDefined();
        expect(multiCurrencyBalances.balancesByCurrency.USD).toBeDefined();
        expect(multiCurrencyBalances.balancesByCurrency.EUR).toBeDefined();
        expect(multiCurrencyBalances.balancesByCurrency.GBP).toBeDefined();
        
        // Check USD balances
        // User 1 paid $300, split 3 ways = each owes $100
        // User 1 gets back $200, User 2 owes $100, User 3 owes $100
        const usdBalances = multiCurrencyBalances.balancesByCurrency.USD;
        expect(usdBalances[user1.uid].netBalance).toBe(200);  // User 1 is owed $200
        expect(usdBalances[user2.uid].netBalance).toBe(-100); // User 2 owes $100
        expect(usdBalances[user3.uid].netBalance).toBe(-100); // User 3 owes $100
        
        // Check EUR balances
        // User 2 paid €150 (split 3 ways = each owes €50), gets back €100
        // User 3 paid €60 (split 3 ways = each owes €20), gets back €40
        // User 1 owes €50 + €20 = €70
        // User 2: +€100 - €20 = +€80
        // User 3: +€40 - €50 = -€10
        const eurBalances = multiCurrencyBalances.balancesByCurrency.EUR;
        expect(eurBalances[user1.uid].netBalance).toBe(-70);  // User 1 owes €70
        expect(eurBalances[user2.uid].netBalance).toBe(80);   // User 2 is owed €80
        expect(eurBalances[user3.uid].netBalance).toBe(-10);  // User 3 owes €10
        
        // Check GBP balances (only User 1 and User 2 involved)
        // User 1 paid £90, split 2 ways = each owes £45
        // User 1 gets back £45, User 2 owes £45
        const gbpBalances = multiCurrencyBalances.balancesByCurrency.GBP;
        expect(gbpBalances[user1.uid].netBalance).toBe(45);   // User 1 is owed £45
        expect(gbpBalances[user2.uid].netBalance).toBe(-45);  // User 2 owes £45
        // User 3 should have zero balance in GBP (not involved)
        if (gbpBalances[user3.uid]) {
            expect(gbpBalances[user3.uid].netBalance).toBe(0);
        }
        
        // Verify simplified debts are separated by currency
        expect(multiCurrencyBalances.simplifiedDebts).toBeDefined();
        const debts = multiCurrencyBalances.simplifiedDebts;
        
        // Group debts by currency
        const debtsByCurrency: Record<string, typeof debts> = {};
        debts.forEach(debt => {
            if (!debtsByCurrency[debt.currency]) {
                debtsByCurrency[debt.currency] = [];
            }
            debtsByCurrency[debt.currency].push(debt);
        });
        
        // Verify USD debts
        expect(debtsByCurrency.USD).toBeDefined();
        expect(debtsByCurrency.USD.length).toBe(2); // User 2 and User 3 each owe User 1
        
        const usdDebtFromUser2 = debtsByCurrency.USD.find(d => 
            d.from.userId === user2.uid && d.to.userId === user1.uid
        );
        expect(usdDebtFromUser2).toBeDefined();
        expect(usdDebtFromUser2!.amount).toBe(100);
        
        const usdDebtFromUser3 = debtsByCurrency.USD.find(d => 
            d.from.userId === user3.uid && d.to.userId === user1.uid
        );
        expect(usdDebtFromUser3).toBeDefined();
        expect(usdDebtFromUser3!.amount).toBe(100);
        
        // Verify EUR debts
        expect(debtsByCurrency.EUR).toBeDefined();
        // User 1 owes €70 and User 3 owes €10, both to User 2
        const eurDebts = debtsByCurrency.EUR;
        
        const eurDebtFromUser1 = eurDebts.find(d => 
            d.from.userId === user1.uid && d.to.userId === user2.uid
        );
        expect(eurDebtFromUser1).toBeDefined();
        expect(eurDebtFromUser1!.amount).toBe(70);
        
        const eurDebtFromUser3 = eurDebts.find(d => 
            d.from.userId === user3.uid && d.to.userId === user2.uid
        );
        expect(eurDebtFromUser3).toBeDefined();
        expect(eurDebtFromUser3!.amount).toBe(10);
        
        // Verify GBP debts
        expect(debtsByCurrency.GBP).toBeDefined();
        expect(debtsByCurrency.GBP.length).toBe(1); // Only User 2 owes User 1
        
        const gbpDebt = debtsByCurrency.GBP[0];
        expect(gbpDebt.from.userId).toBe(user2.uid);
        expect(gbpDebt.to.userId).toBe(user1.uid);
        expect(gbpDebt.amount).toBe(45);
        
        // Verify conservation of money per currency
        Object.entries(multiCurrencyBalances.balancesByCurrency).forEach(([, balances]) => {
            const total = Object.values(balances).reduce((sum, userBalance) => 
                sum + userBalance.netBalance, 0
            );
            expect(Math.abs(total)).toBeLessThan(0.01); // Allow for floating point precision
        });
        
        // Verify no cross-currency debt simplification
        // Each debt should have a single, consistent currency
        debts.forEach(debt => {
            expect(['USD', 'EUR', 'GBP']).toContain(debt.currency);
        });
    });
    
    it('should handle edge case with single currency but multiple exchange rates over time', async () => {
        // This test verifies that even when exchange rates might change over time,
        // debts within the same currency are still properly simplified
        
        ([user1, user2] = await borrowTestUsers(2));
        
        const groupData = new CreateGroupRequestBuilder()
            .withName('Exchange Rate Test Group')
            .build();
        const createGroupResponse = await apiDriver.createGroup(groupData, user1.token);
        groupId = createGroupResponse.id;
        
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
        
        // Create multiple USD expenses at different times
        // (simulating potential exchange rate changes if converted from another currency)
        const expense1 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(100)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expense1, user1.token);
        
        // Small delay to simulate time passing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const expense2 = new ExpenseBuilder()
            .withGroupId(groupId)
            .withAmount(80)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expense2, user2.token);
        
        // Wait for balance calculation
        const balances = await apiDriver.waitForBalanceUpdate(groupId, user1.token, 5000);
        
        // User 1 paid $100 (gets back $50), owes $40 = net +$10
        // User 2 paid $80 (gets back $40), owes $50 = net -$10
        expect(balances.userBalances[user1.uid].netBalance).toBe(10);
        expect(balances.userBalances[user2.uid].netBalance).toBe(-10);
        
        // Verify simplified debt
        expect(balances.simplifiedDebts).toHaveLength(1);
        const debt = balances.simplifiedDebts[0];
        expect(debt.from.userId).toBe(user2.uid);
        expect(debt.to.userId).toBe(user1.uid);
        expect(debt.amount).toBe(10);
        expect(debt.currency).toBe('USD');
    });
});

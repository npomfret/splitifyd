import {ApiDriver, User} from '../support/ApiDriver';
import {CreateGroupRequestBuilder, ExpenseBuilder, UserBuilder} from '../support/builders';

describe('Balance Calculation Integration Test', () => {
    let apiDriver: ApiDriver;
    let user1: User;
    let user2: User;
    let user3: User;
    let groupId: string;
    let shareLinkId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
    });

    beforeEach(async () => {
        // Create fresh test users using builders
        user1 = await apiDriver.createUser(
            new UserBuilder()
                .withEmail('user1.balance@test.com')
                .withPassword('Password123!')
                .withDisplayName('User One')
                .build()
        );
        
        user2 = await apiDriver.createUser(
            new UserBuilder()
                .withEmail('user2.balance@test.com')
                .withPassword('Password123!')
                .withDisplayName('User Two')
                .build()
        );
        
        user3 = await apiDriver.createUser(
            new UserBuilder()
                .withEmail('user3.balance@test.com')
                .withPassword('Password123!')
                .withDisplayName('User Three')
                .build()
        );
    });

    it('should correctly calculate balances for multi-user expense sharing', async () => {
        // Step 1: User 1 creates a group using builder
        const groupData = new CreateGroupRequestBuilder()
            .withName('Test Balance Group')
            .withDescription('Testing balance calculations')
            .build();
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
            .withDescription('Dinner')
            .withAmount(100)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withCategory('food')
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
            .withDescription('Lunch')
            .withAmount(60)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withCategory('food')
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
            {timeout: 5000, errorMsg: 'Balance not updated after second expense'}
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
            .withDescription('Movie tickets')
            .withAmount(90)
            .withCurrency('USD')
            .withPaidBy(user3.uid)
            .withCategory('entertainment')
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
            {timeout: 5000, errorMsg: 'Balance not updated after third expense'}
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
        const totalBalance =
            user1Final.netBalance +
            user2Final.netBalance +
            user3Final.netBalance;
        expect(totalBalance).toBe(0);

        // Additional verification: Check individual debts
        if (finalBalances.debtMatrix) {
        }

        // Get full group details to verify everything is consistent
        const fullDetails = await apiDriver.getGroupFullDetails(groupId, user1.token);

        // The full details endpoint returns balances in a different format with balancesByCurrency
        // Check if the structure has balancesByCurrency
        if (fullDetails.balances.balancesByCurrency?.USD) {
            expect((fullDetails.balances.balancesByCurrency.USD)[user1.uid].netBalance).toBe(-10);
            expect((fullDetails.balances.balancesByCurrency.USD)[user2.uid].netBalance).toBe(-50);
            expect((fullDetails.balances.balancesByCurrency.USD)[user3.uid].netBalance).toBe(60);
        } else {
            // Fallback to direct userBalances structure
            expect(fullDetails.balances.userBalances[user1.uid].netBalance).toBe(-10);
            expect(fullDetails.balances.userBalances[user2.uid].netBalance).toBe(-50);
            expect(fullDetails.balances.userBalances[user3.uid].netBalance).toBe(60);
        }
    });
});
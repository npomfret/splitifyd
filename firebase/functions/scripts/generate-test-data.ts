#!/usr/bin/env tsx

import type { User } from '../src/__tests__/support/ApiDriver';
import { ApiDriver } from '../src/__tests__/support/ApiDriver';
import { ExpenseBuilder } from '../src/__tests__/support/builders';
// import { logger } from '../src/logger';
const logger = {
    info: (msg: string, data?: any) => console.log(msg, data || ''),
    error: (msg: string, err: any, data?: any) => console.error(msg, err, data || ''),
    warn: (msg: string, data?: any) => console.warn(msg, data || '')
};
import type { Group } from '../src/shared/shared-types';

// Initialize ApiDriver which handles all configuration
const driver = new ApiDriver();

interface TestUser {
    email: string;
    password: string;
    displayName: string;
}

interface TestExpense {
    description: string;
    amount: number;
    category: string;
}

interface GroupWithInvite extends Group {
    inviteLink: string;
}

interface TestDataConfig {
    userCount: number;
    groupCount: number;
    regularExpensesPerUser: { min: number; max: number };
    largeGroupExpenseCount: number;
    mode: 'fast' | 'full';
}

// Configuration presets
const TEST_CONFIGS: Record<string, TestDataConfig> = {
    fast: {
        userCount: 3,
        groupCount: 5,
        regularExpensesPerUser: { min: 1, max: 1 },
        largeGroupExpenseCount: 10,
        mode: 'fast',
    },
    full: {
        userCount: 5,
        groupCount: 10,
        regularExpensesPerUser: { min: 1, max: 2 },
        largeGroupExpenseCount: 50,
        mode: 'full',
    },
};

// Get configuration from environment or default to 'full'
const getTestConfig = (): TestDataConfig => {
    const mode = (process.env.TEST_DATA_MODE as 'fast' | 'full') || 'full';
    return TEST_CONFIGS[mode];
};

const generateTestUsers = (config: TestDataConfig): TestUser[] => {
    const users: TestUser[] = [];

    // Keep test1@test.com as the first user for easy reference
    users.push({
        email: 'test1@test.com',
        password: 'rrRR44$$',
        displayName: 'Bill Splitter',
    });

    // More realistic test users with @example.com emails
    const testUsers = [
        { email: 'sarah.johnson@example.com', displayName: 'Sarah Johnson' },
        { email: 'mike.chen@example.com', displayName: 'Mike Chen' },
        { email: 'emily.davis@example.com', displayName: 'Emily Davis' },
        { email: 'alex.martinez@example.com', displayName: 'Alex Martinez' },
        { email: 'jessica.taylor@example.com', displayName: 'Jessica Taylor' },
        { email: 'david.wilson@example.com', displayName: 'David Wilson' },
        { email: 'lisa.anderson@example.com', displayName: 'Lisa Anderson' },
        { email: 'james.thompson@example.com', displayName: 'James Thompson' },
        { email: 'amanda.garcia@example.com', displayName: 'Amanda Garcia' },
        { email: 'robert.lee@example.com', displayName: 'Robert Lee' },
        { email: 'michelle.brown@example.com', displayName: 'Michelle Brown' },
        { email: 'chris.rodriguez@example.com', displayName: 'Chris Rodriguez' },
        { email: 'jennifer.white@example.com', displayName: 'Jennifer White' },
        { email: 'daniel.harris@example.com', displayName: 'Daniel Harris' },
        { email: 'sophia.clark@example.com', displayName: 'Sophia Clark' },
        { email: 'matthew.lewis@example.com', displayName: 'Matthew Lewis' },
        { email: 'olivia.walker@example.com', displayName: 'Olivia Walker' },
        { email: 'ryan.hall@example.com', displayName: 'Ryan Hall' },
        { email: 'natalie.young@example.com', displayName: 'Natalie Young' },
        { email: 'kevin.allen@example.com', displayName: 'Kevin Allen' },
    ];

    // Add users based on config count (minus 1 since we already have test1@test.com)
    const remainingCount = Math.min(config.userCount - 1, testUsers.length);
    for (let i = 0; i < remainingCount; i++) {
        users.push({
            ...testUsers[i],
            password: 'rrRR44$$',
        });
    }

    return users;
};

// TEST_USERS will be generated based on config in generateTestData()

const EXPENSE_CATEGORIES = ['food', 'transport', 'entertainment', 'accommodation', 'utilities', 'shopping', 'healthcare', 'other'];
const EXPENSE_DESCRIPTIONS = [
    // Food & Dining
    'Dinner at restaurant',
    'Grocery shopping',
    'Coffee shop',
    'Lunch',
    'Breakfast',
    'Snacks',
    'Pizza delivery',
    'Takeout dinner',
    'Brunch',
    'Food truck',
    'Ice cream',
    'Bakery treats',
    'Wine tasting',
    'Cooking class',
    'Bar drinks',
    'Happy hour',
    'Cocktails',
    'Beer garden',
    'Food festival',
    'Farmers market',

    // Transport
    'Gas for car',
    'Taxi ride',
    'Uber ride',
    'Train ticket',
    'Bus fare',
    'Parking fee',
    'Tolls',
    'Rental car',
    'Flight ticket',
    'Airport shuttle',
    'Metro pass',
    'Car wash',
    'Car maintenance',
    'Bike repair',
    'Scooter rental',
    'Ferry ride',
    'Subway card',
    'Rideshare',
    'Car insurance',
    'Vehicle registration',

    // Entertainment
    'Movie tickets',
    'Concert tickets',
    'Theater show',
    'Sports game',
    'Museum entry',
    'Zoo visit',
    'Amusement park',
    'Bowling',
    'Mini golf',
    'Arcade games',
    'Escape room',
    'Karaoke',
    'Comedy show',
    'Art gallery',
    'Music festival',
    'Dance class',
    'Gaming tournament',
    'Board game cafe',

    // Accommodation
    'Hotel booking',
    'Airbnb stay',
    'Room service',
    'Minibar',
    'Resort fees',
    'Camping fees',
    'Hostel bed',
    'Vacation rental',
    'Hotel breakfast',
    'Room upgrade',
    'Late checkout fee',

    // Utilities & Services
    'Laundry',
    'Dry cleaning',
    'Phone bill',
    'Internet bill',
    'Streaming service',
    'Cloud storage',
    'Software subscription',
    'App purchase',
    'Online course',
    'Gym membership',
    'Spa treatment',

    // Shopping
    'Clothes shopping',
    'Electronics',
    'Home supplies',
    'Gifts',
    'Books',
    'Stationery',
    'Hardware store',
    'Furniture',
    'Decorations',
    'Kitchen supplies',
    'Sporting goods',
    'Toys',
    'Jewelry',
    'Cosmetics',
    'Garden supplies',
    'Pet supplies',
    'Office supplies',

    // Healthcare
    'Medical checkup',
    'Pharmacy',
    'Dental visit',
    'Eye exam',
    'Prescription',
    'Vitamins',
    'Therapy session',
    'Massage',
    'Chiropractor',
    'Lab tests',
    'Emergency room',
    'Urgent care',

    // Other
    'Home repair',
    'Legal fees',
    'Bank charges',
    'Postage',
    'Printing',
    'Storage unit',
    'Moving costs',
    'Cleaning service',
    'Pet grooming',
    'Childcare',
    'Tuition',
    'Wedding gift',
    'Baby shower gift',
    'Birthday party',
    'Holiday decorations',
    'Charity donation',
];

const generateRandomExpense = (): TestExpense => {
    const description = EXPENSE_DESCRIPTIONS[Math.floor(Math.random() * EXPENSE_DESCRIPTIONS.length)];
    const category = EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)];
    // More varied amounts with realistic distribution
    const amountTypes = [
        () => Math.round((Math.random() * 15 + 3) * 100) / 100, // Micro: $3-$18 (30%)
        () => Math.round((Math.random() * 35 + 10) * 100) / 100, // Small: $10-$45 (25%)
        () => Math.round((Math.random() * 80 + 20) * 100) / 100, // Medium: $20-$100 (25%)
        () => Math.round((Math.random() * 200 + 50) * 100) / 100, // Large: $50-$250 (15%)
        () => Math.round((Math.random() * 500 + 100) * 100) / 100, // XLarge: $100-$600 (5%)
    ];
    const weights = [0.3, 0.25, 0.25, 0.15, 0.05]; // Distribution weights
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedIndex = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (rand <= cumulativeWeight) {
            selectedIndex = i;
            break;
        }
    }
    const amount = amountTypes[selectedIndex]();
    return { description, amount, category };
};

async function createTestUser(userInfo: TestUser): Promise<User> {
    return await driver.createUser(userInfo);
}

async function createGroupWithInvite(name: string, description: string, createdBy: User): Promise<GroupWithInvite> {
    // Create group with just the creator initially
    const group = await driver.createGroupWithMembers(name, [createdBy], createdBy.token);

    // Generate shareable link
    const shareLink = await driver.generateShareLink(group.id, createdBy.token);

    return {
        ...group,
        inviteLink: shareLink.linkId,
    } as GroupWithInvite;
}

async function createGroups(createdBy: User, config: TestDataConfig): Promise<GroupWithInvite[]> {
    const groups: GroupWithInvite[] = [];

    // Create special "Empty Group" with NO expenses
    const emptyGroup = await createGroupWithInvite('Empty Group', 'This group has no expenses - testing empty state', createdBy);
    groups.push(emptyGroup);
    logger.info(`Created special empty group: ${emptyGroup.name} with invite link: ${emptyGroup.inviteLink}`);

    // Create special "Settled Group" with multi-currency expenses and settlements
    const settledGroup = await createGroupWithInvite('Settled Group', 'Multi-currency group with many expenses and settlements - fully settled up', createdBy);
    groups.push(settledGroup);
    logger.info(`Created special settled group: ${settledGroup.name} with invite link: ${settledGroup.inviteLink}`);

    // Create special "Large Group" with many users and expenses
    const largeGroup = await createGroupWithInvite('Large Group', 'Many users and expenses for testing pagination and performance', createdBy);
    groups.push(largeGroup);
    logger.info(`Created special large group: ${largeGroup.name} with invite link: ${largeGroup.inviteLink}`);

    // Create regular groups with various names
    const regularGroupCount = config.groupCount - 3;
    const groupNames = [
        'Weekend Trip',
        'Roommates',
        'Lunch Crew',
        'Game Night',
        'Beach House',
        'Ski Trip',
        'Birthday Party',
        'Road Trip',
        'Concert Tickets',
        'Dinner Club',
        'Movie Night',
        'Camping Trip',
    ];

    for (let i = 0; i < regularGroupCount; i++) {
        const groupName = groupNames[i % groupNames.length] + (i >= groupNames.length ? ` ${Math.floor(i / groupNames.length) + 1}` : '');
        const group = await createGroupWithInvite(groupName, 'Regular group with some expenses', createdBy);
        groups.push(group);
        logger.info(`Created group: ${group.name} with invite link: ${group.inviteLink}`);
    }

    return groups;
}

async function joinGroupsRandomly(users: User[], groups: GroupWithInvite[]): Promise<void> {
    // Each user (except test1 who created all groups) joins groups
    const otherUsers = users.slice(1); // Skip test1@test.com

    logger.info(`Having ${otherUsers.length} users join groups`);

    // Process all users in parallel for better performance
    await Promise.all(
        otherUsers.map(async (user) => {
            let joinedCount = 0;
            const joinPromises = [];

            for (const group of groups) {
                let shouldJoin = false;

                // Special handling for different group types
                if (group.name === 'Large Group') {
                    // Everyone joins the Large Group
                    shouldJoin = true;
                } else if (group.name === 'Empty Group') {
                    // Only 50% join the Empty Group
                    shouldJoin = Math.random() < 0.5;
                } else if (group.name === 'Settled Group') {
                    // Everyone joins the Settled Group for balanced expenses
                    shouldJoin = true;
                } else {
                    // 60% chance to join regular groups
                    shouldJoin = Math.random() < 0.6;
                }

                if (shouldJoin) {
                    joinPromises.push(driver.joinGroupViaShareLink(group.inviteLink, user.token).then(() => joinedCount++));
                }
            }

            await Promise.all(joinPromises);
            logger.info(`${user.email} joined ${joinedCount} out of ${groups.length} groups`);
        }),
    );
}

async function createTestExpense(groupId: string, expense: TestExpense, participants: User[], createdBy: User): Promise<any> {
    const participantIds = participants.map((p) => p.uid);

    // Randomly choose between GBP and EUR
    const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';

    const expenseData = new ExpenseBuilder()
        .withGroupId(groupId)
        .withAmount(expense.amount)
        .withCurrency(currency)
        .withDescription(expense.description)
        .withCategory(expense.category)
        .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
        .withSplitType('equal')
        .withParticipants(participantIds)
        .withPaidBy(createdBy.uid)
        .build();

    // Create expense via ApiDriver
    return await driver.createExpense(expenseData, createdBy.token);
}

async function createRandomExpensesForGroups(groups: GroupWithInvite[], users: User[], config: TestDataConfig): Promise<void> {
    // Skip the special groups - only process regular groups
    const regularGroups = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group' && g.name !== 'Large Group');

    logger.info(`Creating random expenses for ${regularGroups.length} regular groups`);

    // Process groups in batches of 3 to reduce contention
    const BATCH_SIZE = 3;

    for (let i = 0; i < regularGroups.length; i += BATCH_SIZE) {
        const groupBatch = regularGroups.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get all members of this group
                const groupMembers = users.filter((user) => user.uid in group.members);

                if (groupMembers.length === 0) return;

                const expensePromises = [];

                // Each user in the group creates expenses based on config
                for (const user of groupMembers) {
                    const { min, max } = config.regularExpensesPerUser;
                    const expenseCount = Math.floor(Math.random() * (max - min + 1)) + min;

                    for (let j = 0; j < expenseCount; j++) {
                        const expense = generateRandomExpense();

                        // Random subset of group members participate (at least 2, including payer)
                        const minParticipants = 2;
                        const maxParticipants = Math.min(groupMembers.length, 5);
                        const participantCount = Math.floor(Math.random() * (maxParticipants - minParticipants + 1)) + minParticipants;

                        const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
                        let participants = shuffled.slice(0, participantCount);

                        // Ensure payer is always included
                        if (!participants.some((p) => p.uid === user.uid)) {
                            participants[0] = user;
                        }

                        expensePromises.push(createTestExpense(group.id, expense, participants, user));
                    }
                }

                await Promise.all(expensePromises);
                logger.info(`Created ${expensePromises.length} random expenses for group: ${group.name}`);
            }),
        );
    }
}

async function createBalancedExpensesForSettledGroup(groups: GroupWithInvite[], users: User[]): Promise<void> {
    const settledGroup = groups.find((g) => g.name === 'Settled Group');
    if (!settledGroup) return;

    logger.info('Creating balanced expenses and settlements for "Settled Group" so no one owes anything');

    // Get all members of this group from the refreshed data
    const groupMembers = users.filter((user) => user.uid in settledGroup.members);

    if (groupMembers.length < 2) return;

    logger.info(`Creating balanced expenses for ${groupMembers.length} members in Settled Group`, {
        groupId: settledGroup.id,
        memberIds: groupMembers.map((m) => m.uid),
        memberNames: groupMembers.map((m) => m.displayName),
    });

    // Create various expenses in both currencies
    const expenseScenarios = [
        { description: 'Restaurant dinner', amount: 120, currency: 'GBP', category: 'food' },
        { description: 'Hotel booking', amount: 350, currency: 'EUR', category: 'accommodation' },
        { description: 'Concert tickets', amount: 180, currency: 'GBP', category: 'entertainment' },
        { description: 'Car rental', amount: 240, currency: 'EUR', category: 'transport' },
        { description: 'Grocery shopping', amount: 85, currency: 'GBP', category: 'food' },
        { description: 'Train tickets', amount: 150, currency: 'EUR', category: 'transport' },
        { description: 'Museum passes', amount: 60, currency: 'GBP', category: 'entertainment' },
        { description: 'Wine tasting tour', amount: 180, currency: 'EUR', category: 'entertainment' },
    ];

    // Create expenses with different payers and participants
    const expensePromises = [];
    for (let i = 0; i < Math.min(expenseScenarios.length, groupMembers.length * 2); i++) {
        const scenario = expenseScenarios[i % expenseScenarios.length];
        const payer = groupMembers[i % groupMembers.length];

        // Vary the participants - sometimes everyone, sometimes a subset
        let participants: User[];
        if (i % 3 === 0) {
            // Everyone participates
            participants = [...groupMembers];
        } else {
            // Random subset (at least 2 including payer)
            const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
            const participantCount = Math.min(groupMembers.length, Math.floor(Math.random() * 3) + 2);
            participants = shuffled.slice(0, participantCount);
            if (!participants.includes(payer)) {
                participants[0] = payer;
            }
        }

        const participantIds = participants.map((p) => p.uid);

        const expenseData = new ExpenseBuilder()
            .withGroupId(settledGroup.id)
            .withAmount(scenario.amount)
            .withCurrency(scenario.currency)
            .withDescription(scenario.description)
            .withCategory(scenario.category)
            .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
            .withSplitType('equal')
            .withParticipants(participantIds)
            .withPaidBy(payer.uid)
            .build();

        expensePromises.push(
            driver.createExpense(expenseData, payer.token).then(() => {
                logger.info(`Created expense: ${payer.displayName} paid ${scenario.currency} ${scenario.amount} for "${scenario.description}"`);
            }),
        );
    }

    // Wait for all expenses to be created
    await Promise.all(expensePromises);

    // Now fetch the actual balances from the API to see what needs settling
    logger.info('Fetching current balances to calculate settlements...');

    const balancesResponse = await driver.getGroupBalances(settledGroup.id, groupMembers[0].token);
    const balancesByCurrency = balancesResponse.balancesByCurrency || {};

    // Create settlements to zero out all balances
    const settlementPromises = [];

    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = balancesByCurrency[currency];
        if (!currencyBalances) continue;

        // Find who owes and who is owed
        const debtors: { user: User; amount: number }[] = [];
        const creditors: { user: User; amount: number }[] = [];

        for (const member of groupMembers) {
            const balance = currencyBalances[member.uid];
            if (balance && balance.netBalance) {
                if (balance.netBalance < -0.01) {
                    // This person owes money
                    debtors.push({ user: member, amount: Math.abs(balance.netBalance) });
                } else if (balance.netBalance > 0.01) {
                    // This person is owed money
                    creditors.push({ user: member, amount: balance.netBalance });
                }
            }
        }

        // Sort debtors and creditors by amount (largest first)
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        // Create settlements using a greedy algorithm
        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];

            // Calculate settlement amount
            const settlementAmount = Math.min(debtor.amount, creditor.amount);

            if (settlementAmount > 0.01) {
                const settlementData = {
                    groupId: settledGroup.id,
                    payerId: debtor.user.uid,
                    payeeId: creditor.user.uid,
                    amount: Math.round(settlementAmount * 100) / 100,
                    currency: currency,
                    note: `Settling up ${currency} expenses`,
                    date: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
                };

                settlementPromises.push(
                    driver
                        .createSettlement(settlementData, debtor.user.token)
                        .then(() => {
                            const symbol = currency === 'GBP' ? '£' : '€';
                            logger.info(`Created settlement: ${debtor.user.displayName} → ${creditor.user.displayName} ${symbol}${settlementData.amount}`);
                        })
                        .catch((err) => {
                            logger.error(`Failed to create settlement: ${err.message}`, {
                                from: debtor.user.displayName,
                                to: creditor.user.displayName,
                                amount: settlementData.amount,
                                currency,
                            });
                        }),
                );

                // Update remaining amounts
                debtor.amount -= settlementAmount;
                creditor.amount -= settlementAmount;
            }

            // Move to next debtor or creditor
            if (debtor.amount < 0.01) debtorIndex++;
            if (creditor.amount < 0.01) creditorIndex++;
        }
    }

    await Promise.all(settlementPromises);

    // Verify final balances
    const finalBalances = await driver.getGroupBalances(settledGroup.id, groupMembers[0].token);

    logger.info('Final balances in Settled Group (should all be ~0):');
    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = finalBalances.balancesByCurrency?.[currency];
        if (currencyBalances) {
            logger.info(`  ${currency}:`);
            for (const member of groupMembers) {
                const balance = currencyBalances[member.uid];
                if (balance) {
                    const netBalance = Math.round((balance.netBalance || 0) * 100) / 100;
                    const symbol = currency === 'GBP' ? '£' : '€';
                    logger.info(`    ${member.displayName}: ${symbol}${netBalance}`);
                }
            }
        }
    }

    logger.info(`✓ Successfully created balanced multi-currency expenses and settlements for "Settled Group"`);
}

async function createManyExpensesForLargeGroup(groups: GroupWithInvite[], users: User[], config: TestDataConfig): Promise<void> {
    const largeGroup = groups.find((g) => g.name === 'Large Group');
    if (!largeGroup) return;

    logger.info('Creating many expenses for "Large Group" to test pagination');

    // Get all members of this group from the refreshed data
    const groupMembers = users.filter((user) => user.uid in largeGroup.members);

    if (groupMembers.length === 0) return;

    // Create expenses based on config to test pagination
    const totalExpenses = config.largeGroupExpenseCount;
    const BATCH_SIZE = 5;

    for (let i = 0; i < totalExpenses; i += BATCH_SIZE) {
        const batchPromises = [];

        for (let j = 0; j < BATCH_SIZE && i + j < totalExpenses; j++) {
            const expense = generateRandomExpense();
            const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];

            // Random participants (2-5 people)
            const participantCount = Math.floor(Math.random() * 4) + 2;
            const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
            let participants = shuffled.slice(0, Math.min(participantCount, groupMembers.length));

            // Ensure payer is included
            if (!participants.some((p) => p.uid === payer.uid)) {
                participants[0] = payer;
            }

            batchPromises.push(createTestExpense(largeGroup.id, expense, participants, payer));
        }

        await Promise.all(batchPromises);

        // Small delay between batches
        if (i + BATCH_SIZE < totalExpenses) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    logger.info(`Created ${totalExpenses} expenses for "Large Group"`);
}

async function createSmallPaymentsForGroups(groups: GroupWithInvite[], users: User[]): Promise<void> {
    // Skip empty group AND settled group (to preserve its settled state)
    const groupsWithPayments = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    logger.info(`Creating small payments/settlements for ${groupsWithPayments.length} groups`);

    // Process groups in batches to reduce contention
    const BATCH_SIZE = 2;

    for (let i = 0; i < groupsWithPayments.length; i += BATCH_SIZE) {
        const groupBatch = groupsWithPayments.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get all members of this group
                const groupMembers = users.filter((user) => user.uid in group.members);

                if (groupMembers.length < 2) return;

                // Create 1-3 small settlements per group
                const settlementCount = Math.floor(Math.random() * 3) + 1;
                const settlementPromises = [];

                for (let j = 0; j < settlementCount; j++) {
                    // Pick random payer and payee
                    const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];
                    const availablePayees = groupMembers.filter((m) => m.uid !== payer.uid);

                    if (availablePayees.length === 0) continue;

                    const payee = availablePayees[Math.floor(Math.random() * availablePayees.length)];

                    // Generate small payment amounts between $5 and $50
                    const paymentAmount = Math.round((Math.random() * 45 + 5) * 100) / 100;

                    const paymentNotes = [
                        'Coffee payment',
                        'Lunch payback',
                        'Gas money',
                        'Uber split',
                        'Drinks last night',
                        'Pizza share',
                        'Movie tickets',
                        'Parking fee',
                        'Groceries split',
                        'Tip payback',
                        'Breakfast split',
                        'Snacks',
                    ];

                    // Randomly choose between GBP and EUR for settlements
                    const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';

                    const settlementData = {
                        groupId: group.id,
                        payerId: payer.uid,
                        payeeId: payee.uid,
                        amount: paymentAmount,
                        currency: currency,
                        note: paymentNotes[Math.floor(Math.random() * paymentNotes.length)],
                        date: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 15 days
                    };

                    settlementPromises.push(
                        driver.createSettlement(settlementData, payer.token).then(() => {
                            const currencySymbol = currency === 'GBP' ? '£' : '€';
                            logger.info(`Created small payment: ${payer.displayName} → ${payee.displayName} ${currencySymbol}${paymentAmount} in ${group.name}`);
                        }),
                    );
                }

                await Promise.all(settlementPromises);
                logger.info(`Created ${settlementCount} small payments for group: ${group.name}`);
            }),
        );
    }

    logger.info(`✓ Finished creating small payments for all groups`);
}

async function deleteSomeExpensesFromGroups(groups: GroupWithInvite[], users: User[]): Promise<void> {
    // Skip empty group and settled group (to preserve their states)
    const groupsWithExpenses = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    logger.info(`Deleting some expenses from ${groupsWithExpenses.length} groups to test deletion functionality`);

    let totalDeleted = 0;

    for (const group of groupsWithExpenses) {
        // Get a group member to perform the deletion (preferably the creator)
        const deleter = users.find((u) => u.uid === group.createdBy) || users.find((u) => u.uid in group.members);
        if (!deleter) {
            logger.warn(`No valid user found to delete expenses from group: ${group.name}`);
            continue;
        }

        // Get expenses for this group
        const { expenses } = await driver.getGroupExpenses(group.id, deleter.token);

        if (!expenses || expenses.length === 0) {
            logger.info(`No expenses found in group: ${group.name}`);
            continue;
        }

        // Determine how many to delete (1-2 expenses, but at least 1 per group)
        const deleteCount = Math.min(
            Math.floor(Math.random() * 2) + 1, // 1 or 2 expenses
            Math.max(1, Math.floor(expenses.length * 0.2)), // Or 20% of expenses, whichever is less
        );

        // Randomly select expenses to delete
        const shuffled = [...expenses].sort(() => 0.5 - Math.random());
        const expensesToDelete = shuffled.slice(0, deleteCount);

        // Delete the selected expenses
        for (const expense of expensesToDelete) {
            await driver.deleteExpense(expense.id, deleter.token);
            totalDeleted++;
            const currencySymbol = expense.currency === 'GBP' ? '£' : expense.currency === 'EUR' ? '€' : '$';
            logger.info(`Deleted expense: "${expense.description}" (${currencySymbol}${expense.amount}) from ${group.name}`);
        }

        logger.info(`Deleted ${deleteCount} expense(s) from group: ${group.name}`);
    }

    logger.info(`✓ Finished deleting expenses. Total deleted: ${totalDeleted} expenses across all groups`);
}

export async function generateTestData(): Promise<void> {
    const config = getTestConfig();
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const logTiming = (phase: string, startMs: number) => {
        const duration = Date.now() - startMs;
        timings[phase] = duration;
        logger.info(`⏱️  ${phase} completed in ${duration}ms`);
    };

    logger.info(`🚀 Starting test data generation in ${config.mode} mode`);

    // Generate users based on config
    const TEST_USERS = generateTestUsers(config);

    // Create all test users in parallel
    logger.info(`Creating ${config.userCount} test users...`);
    const userCreationStart = Date.now();
    const users = await Promise.all(TEST_USERS.map((userInfo) => createTestUser(userInfo)));
    logger.info(`✓ Created ${users.length} users`);
    logTiming('User creation', userCreationStart);

    // test1@test.com creates groups and collects invite links
    logger.info(`Creating ${config.groupCount} groups with test1@test.com as creator...`);
    const groupCreationStart = Date.now();
    const test1User = users[0]; // test1@test.com
    const groupsWithInvites = await createGroups(test1User, config);
    logger.info(`✓ Created ${groupsWithInvites.length} groups with invite links`);
    logTiming('Group creation', groupCreationStart);

    // Other users randomly join ~70% of groups
    logger.info('Having users randomly join groups...');
    const joinGroupsStart = Date.now();
    await joinGroupsRandomly(users, groupsWithInvites);
    logger.info('✓ Users have joined groups randomly');
    logTiming('Group joining', joinGroupsStart);

    // IMPORTANT: Refresh group data after joins to get updated member lists
    logger.info('Refreshing group data to get updated member lists...');
    const refreshStart = Date.now();
    const refreshedGroups = await Promise.all(
        groupsWithInvites.map(async (group) => {
            const groupData = await driver.getGroup(group.id, test1User.token);
            return {
                ...groupData,
                inviteLink: group.inviteLink,
            } as GroupWithInvite;
        }),
    );
    logger.info('✓ Refreshed group data with updated members');
    logTiming('Group data refresh', refreshStart);

    // Create random expenses for regular groups (excluding special ones)
    logger.info('Creating random expenses for regular groups...');
    const regularExpensesStart = Date.now();
    await createRandomExpensesForGroups(refreshedGroups, users, config);
    logger.info('✓ Created random expenses for regular groups');
    logTiming('Regular expenses creation', regularExpensesStart);

    // Create special balanced expenses for "Settled Group"
    logger.info('Creating balanced expenses for "Settled Group"...');
    const balancedExpensesStart = Date.now();
    await createBalancedExpensesForSettledGroup(refreshedGroups, users);
    logger.info('✓ Created balanced expenses');
    logTiming('Balanced expenses creation', balancedExpensesStart);

    // Create many expenses for "Large Group" for pagination testing
    logger.info('Creating many expenses for "Large Group"...');
    const largeGroupExpensesStart = Date.now();
    await createManyExpensesForLargeGroup(refreshedGroups, users, config);
    logger.info('✓ Created many expenses for pagination testing');
    logTiming('Large group expenses creation', largeGroupExpensesStart);

    // Create small payments/settlements for groups to demonstrate payment functionality
    logger.info('Creating small payments/settlements for groups...');
    const smallPaymentsStart = Date.now();
    await createSmallPaymentsForGroups(refreshedGroups, users);
    logger.info('✓ Created small payments/settlements');
    logTiming('Small payments creation', smallPaymentsStart);

    // Delete some expenses to test deletion functionality and show deleted state
    logger.info('Deleting some expenses to test deletion functionality...');
    const deletionStart = Date.now();
    await deleteSomeExpensesFromGroups(refreshedGroups, users);
    logger.info('✓ Deleted some expenses from groups');
    logTiming('Expense deletion', deletionStart);

    const totalTime = Date.now() - startTime;
    logger.info('🎉 Test data generation completed', {
        users: users.length,
        groups: refreshedGroups.length,
        totalTimeMs: totalTime,
        totalTimeSeconds: (totalTime / 1000).toFixed(2),
        mode: config.mode,
        timings,
        testCredentials: TEST_USERS.map((u) => ({ email: u.email, password: u.password })),
        inviteLinks: refreshedGroups.map((g) => ({ name: g.name, inviteLink: g.inviteLink })),
    });
}

// Run the script
if (require.main === module) {
    const config = getTestConfig();
    logger.info(`Running generate-test-data script in ${config.mode} mode`);
    logger.info('To use fast mode, run: TEST_DATA_MODE=fast npm run generate-test-data');

    generateTestData().then(() => {
        process.exit(0);
    });
}

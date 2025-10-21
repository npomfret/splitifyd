#!/usr/bin/env tsx

import type { Amount, GroupDTO, GroupId } from '@splitifyd/shared';
import { AuthenticatedFirebaseUser, compareAmounts, isZeroAmount, minAmount, normalizeAmount, PREDEFINED_EXPENSE_CATEGORIES, subtractAmounts, UserRegistration, zeroAmount } from '@splitifyd/shared';
import type { CreateSettlementRequest } from '@splitifyd/shared';
import { ApiDriver, CreateExpenseRequestBuilder } from '@splitifyd/test-support';

// Initialize ApiDriver which handles all configuration
const driver = new ApiDriver();

// Simple expense template for test data generation
interface TestExpenseTemplate {
    description: string;
    amount: Amount;
    category: string;
}

// Group with invite link for test setup
interface GroupWithInvite extends GroupDTO {
    inviteLink: string;
}

interface TestDataConfig {
    userCount: number;
    groupCount: number;
    regularExpensesPerUser: { min: number; max: number; };
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

const generateTestUserRegistrations = (config: TestDataConfig): UserRegistration[] => {
    const users: UserRegistration[] = [];

    // Keep test1@test.com as the first user for easy reference
    users.push({
        email: 'test1@test.com',
        password: 'passwordpass',
        displayName: 'Bill Splitter',
        termsAccepted: true,
        cookiePolicyAccepted: true,
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
            termsAccepted: true,
            cookiePolicyAccepted: true,
            password: 'passwordpass',
        });
    }

    return users;
};

// Extract category names from the real predefined categories
const EXPENSE_CATEGORIES = PREDEFINED_EXPENSE_CATEGORIES.map((cat) => cat.name);
// Diverse expense descriptions that work with various categories
const EXPENSE_DESCRIPTIONS = [
    'Dinner at restaurant',
    'Grocery shopping',
    'Coffee run',
    'Lunch',
    'Pizza delivery',
    'Takeout',
    'Uber ride',
    'Gas for car',
    'Train ticket',
    'Parking fee',
    'Taxi ride',
    'Bus fare',
    'Movie tickets',
    'Concert',
    'Theater show',
    'Museum visit',
    'Game night',
    'Bowling',
    'Hotel booking',
    'Airbnb stay',
    'Room service',
    'Vacation rental',
    'Camping fees',
    'Electric bill',
    'Internet bill',
    'Phone bill',
    'Water bill',
    'Gym membership',
    'Clothes shopping',
    'Electronics',
    'Books',
    'Gifts',
    'Home supplies',
    'Furniture',
    'Doctor visit',
    'Pharmacy',
    'Dental checkup',
    'Prescription',
    'Therapy session',
    'Online course',
    'Textbooks',
    'School supplies',
    'Tuition',
    'Workshop',
    'Pet food',
    'Vet visit',
    'Pet grooming',
    'Pet toys',
    'Pet supplies',
    'Bar drinks',
    'Wine',
    'Beer',
    'Cocktails',
    'Happy hour',
    'Brewery tour',
    'Coffee beans',
    'Espresso machine',
    'Coffee shop visit',
    'Latte',
    'Cold brew',
    'Laptop',
    'Phone',
    'Headphones',
    'Software',
    'App subscription',
    'Cloud storage',
    'Video games',
    'Gaming console',
    'Board games',
    'Gaming accessories',
    'Garden supplies',
    'Home decor',
    'Tools',
    'Paint',
    'Cleaning supplies',
    'Netflix',
    'Spotify',
    'Disney+',
    'YouTube Premium',
    'News subscription',
    'Birthday gift',
    'Wedding gift',
    'Holiday present',
    'Thank you gift',
    'Charity donation',
    'Fundraiser',
    'Volunteering expenses',
    'Community support',
    'Art supplies',
    'Craft materials',
    'Hobby equipment',
    'Workshop materials',
    'Personal trainer',
    'Yoga class',
    'Sports equipment',
    'Marathon entry',
    'Skincare',
    'Haircut',
    'Makeup',
    'Spa day',
    'Manicure',
    'Date night',
    'Anniversary dinner',
    'Flowers',
    'Romantic getaway',
    'Counseling',
    'Self-help book',
    'Meditation app',
    'Wellness retreat',
    'Babysitting',
    'Kids toys',
    'School lunch',
    'Playground visit',
    'Night out',
    'Club entry',
    'Late night food',
    'Dancing',
    'Lottery ticket',
    'Scratch card',
    'Casino visit',
    'Betting',
    'Late night snacks',
    'Junk food',
    'Convenience store',
    'Vending machine',
    'Hangover cure',
    'Recovery drinks',
    'Aspirin',
    'Comfort food',
    'Impulse buy',
    'Random purchase',
    'Saw it and bought it',
    'Why did I buy this',
    'Business expense',
    'Work supplies',
    'Networking event',
    'Professional development',
    'Totally legal bribe',
    'Favor payment',
    'Smooth talking fee',
    'Convenience fee',
    'Legal consultation',
    'Court fees',
    'Bail money',
    'Lawyer retainer',
    'Weird Amazon find',
    'Strange gadget',
    'Quirky item',
    'Internet rabbit hole purchase',
    'Miscellaneous',
    'Random expense',
    'Other stuff',
    'Unspecified purchase',
];

const generateRandomExpense = (): TestExpenseTemplate => {
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
    const amount = amountTypes[selectedIndex]().toFixed(2) as Amount;
    return { description, amount, category };
};

async function createTestPoolUsers(): Promise<void> {
    console.log('🏊 Initializing test pool users...');

    const POOL_SIZE = 10;

    // Check which pool users already exist
    const emails = [];
    for (let i = 1; i <= POOL_SIZE; i++) {
        // Try to create the user - if it already exists, Firebase will throw an error
        const user = await driver.borrowTestUser();
        console.log(`Created pool user:`, user.email);
        emails.push(user.email);
    }
    for (const email of emails) {
        await driver.returnTestUser(email);
    }

    console.log('✅ Test pool users ready');
}

async function createGroupWithInvite(name: string, createdBy: AuthenticatedFirebaseUser): Promise<GroupWithInvite> {
    // Create group with just the creator initially
    const group = await driver.createGroupWithMembers(name, [createdBy], createdBy.token);

    // Generate shareable link
    const shareLink = await driver.generateShareLink(group.id, createdBy.token);

    return {
        ...group,
        inviteLink: shareLink.linkId,
    } as GroupWithInvite;
}

async function createGroups(createdBy: AuthenticatedFirebaseUser, config: TestDataConfig): Promise<GroupWithInvite[]> {
    const groups: GroupWithInvite[] = [];

    // Create special "Empty Group" with NO expenses
    const emptyGroup = await createGroupWithInvite('Empty Group', createdBy);
    groups.push(emptyGroup);
    console.log(`Created special empty group: ${emptyGroup.name} with invite link: ${emptyGroup.inviteLink}`);

    // Create special "Settled Group" with multi-currency expenses and settlements
    const settledGroup = await createGroupWithInvite('Settled Group', createdBy);
    groups.push(settledGroup);
    console.log(`Created special settled group: ${settledGroup.name} with invite link: ${settledGroup.inviteLink}`);

    // Create special "Large Group" with many users and expenses
    const largeGroup = await createGroupWithInvite('Large Group', createdBy);
    groups.push(largeGroup);
    console.log(`Created special large group: ${largeGroup.name} with invite link: ${largeGroup.inviteLink}`);

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
        const group = await createGroupWithInvite(groupName, createdBy);
        groups.push(group);
        console.log(`Created group: ${group.name} with invite link: ${group.inviteLink}`);
    }

    return groups;
}

async function joinGroupsRandomly(users: AuthenticatedFirebaseUser[], groups: GroupWithInvite[]): Promise<Map<string, AuthenticatedFirebaseUser[]>> {
    // Track which users are in which groups
    const groupMemberships = new Map<string, AuthenticatedFirebaseUser[]>();

    // Initialize with the creator (test1@test.com) in all groups
    const creator = users[0];
    for (const group of groups) {
        groupMemberships.set(group.id, [creator]);
    }

    // Each user (except test1 who created all groups) joins groups
    const otherUsers = users.slice(1); // Skip test1@test.com

    console.log(`Having ${otherUsers.length} users join groups`);

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
                    joinPromises.push(
                        driver.joinGroupViaShareLink(group.inviteLink, user.token).then(() => {
                            joinedCount++;
                            // Track membership
                            const members = groupMemberships.get(group.id) || [];
                            members.push(user);
                            groupMemberships.set(group.id, members);
                        }),
                    );
                }
            }

            await Promise.all(joinPromises);
            console.log(`${user.displayName} joined ${joinedCount} out of ${groups.length} groups`);
        }),
    );

    return groupMemberships;
}

async function createTestExpenseTemplate(groupId: GroupId, expense: TestExpenseTemplate, participants: AuthenticatedFirebaseUser[], createdBy: AuthenticatedFirebaseUser): Promise<any> {
    const participantIds = participants.map((p) => p.uid);

    // Randomly choose between GBP and EUR
    const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';
    const normalizedAmount = normalizeAmount(expense.amount, currency);

    const expenseData = new CreateExpenseRequestBuilder()
        .withGroupId(groupId)
        .withAmount(normalizedAmount, currency)
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

async function createRandomExpensesForGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>, config: TestDataConfig): Promise<void> {
    // Skip the special groups - only process regular groups
    const regularGroups = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group' && g.name !== 'Large Group');

    console.log(`Creating random expenses for ${regularGroups.length} regular groups`);

    // Process groups in batches of 3 to reduce contention
    const BATCH_SIZE = 3;

    for (let i = 0; i < regularGroups.length; i += BATCH_SIZE) {
        const groupBatch = regularGroups.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get actual members of this group from tracked memberships
                const groupMembers = groupMemberships.get(group.id) || [];

                if (groupMembers.length === 0) {
                    console.log(`No members found for group ${group.name}, skipping expense creation`);
                    return;
                }

                const expensePromises = [];

                // Each user in the group creates expenses based on config
                for (const user of groupMembers) {
                    const { min, max } = config.regularExpensesPerUser;
                    const expenseCount = Math.floor(Math.random() * (max - min + 1)) + min;

                    for (let j = 0; j < expenseCount; j++) {
                        const expense = generateRandomExpense();

                        // Random subset of group members participate (at least 2, including payer)
                        const minParticipants = Math.min(2, groupMembers.length);
                        const maxParticipants = Math.min(groupMembers.length, 5);
                        const participantCount = Math.floor(Math.random() * (maxParticipants - minParticipants + 1)) + minParticipants;

                        const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
                        let participants = shuffled.slice(0, participantCount);

                        // Ensure payer is always included
                        if (!participants.some((p) => p.uid === user.uid)) {
                            participants[0] = user;
                        }

                        expensePromises.push(createTestExpenseTemplate(group.id, expense, participants, user));
                    }
                }

                await Promise.all(expensePromises);
                console.log(`Created ${expensePromises.length} random expenses for group: ${group.name}`);
            }),
        );
    }
}

async function createBalancedExpensesForSettledGroup(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    const settledGroup = groups.find((g) => g.name === 'Settled Group');
    if (!settledGroup) return;

    console.log('Creating balanced expenses and settlements for "Settled Group" so no one owes anything');

    // Get actual members of this group from tracked memberships
    const groupMembers = groupMemberships.get(settledGroup.id) || [];

    if (groupMembers.length < 2) return;

    console.log(`Creating balanced expenses for ${groupMembers.length} members in Settled Group`, {
        groupId: settledGroup.id,
        memberIds: groupMembers.map((m) => m.uid),
        memberNames: groupMembers.map((m) => m.displayName),
    });

    // Create various expenses in both currencies
    const expenseScenarios = [
        { description: 'Restaurant dinner', amount: '120', currency: 'GBP', category: 'food' },
        { description: 'Hotel booking', amount: '350', currency: 'EUR', category: 'accommodation' },
        { description: 'Concert tickets', amount: '180', currency: 'GBP', category: 'entertainment' },
        { description: 'Car rental', amount: '240', currency: 'EUR', category: 'transport' },
        { description: 'Grocery shopping', amount: '85', currency: 'GBP', category: 'food' },
        { description: 'Train tickets', amount: '150', currency: 'EUR', category: 'transport' },
        { description: 'Museum passes', amount: '60', currency: 'GBP', category: 'entertainment' },
        { description: 'Wine tasting tour', amount: '180', currency: 'EUR', category: 'entertainment' },
    ];

    // Create expenses with different payers and participants
    const expensePromises = [];
    for (let i = 0; i < Math.min(expenseScenarios.length, groupMembers.length * 2); i++) {
        const scenario = expenseScenarios[i % expenseScenarios.length];
        const payer = groupMembers[i % groupMembers.length];

        // Vary the participants - sometimes everyone, sometimes a subset
        let participants: AuthenticatedFirebaseUser[];
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
        const normalizedScenarioAmount = normalizeAmount(scenario.amount, scenario.currency);

        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(settledGroup.id)
            .withAmount(normalizedScenarioAmount, scenario.currency)
            .withDescription(scenario.description)
            .withCategory(scenario.category)
            .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
            .withSplitType('equal')
            .withParticipants(participantIds)
            .withPaidBy(payer.uid)
            .build();

        expensePromises.push(
            driver.createExpense(expenseData, payer.token).then(() => {
                console.log(`Created expense: ${payer.displayName} paid ${scenario.currency} ${scenario.amount} for "${scenario.description}"`);
            }),
        );
    }

    // Wait for all expenses to be created
    await Promise.all(expensePromises);

    // Now fetch the actual balances from the API to see what needs settling
    console.log('Fetching current balances to calculate settlements...');

    const balancesResponse = await driver.getGroupBalances(settledGroup.id, groupMembers[0].token);
    const balancesByCurrency = balancesResponse.balancesByCurrency || {};

    // Create settlements to zero out all balances
    const settlementPromises: Array<Promise<void>> = [];

    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = balancesByCurrency[currency];
        if (!currencyBalances) continue;

        const zero = zeroAmount(currency);

        const debtors: { user: AuthenticatedFirebaseUser; amount: Amount; }[] = [];
        const creditors: { user: AuthenticatedFirebaseUser; amount: Amount; }[] = [];

        for (const member of groupMembers) {
            const balance = currencyBalances[member.uid];
            if (!balance || balance.netBalance === undefined) {
                continue;
            }
            const netBalance = normalizeAmount(balance.netBalance, currency);
            const comparison = compareAmounts(netBalance, zero, currency);

            if (comparison < 0) {
                const owed = subtractAmounts(zero, netBalance, currency);
                debtors.push({ user: member, amount: owed });
            } else if (comparison > 0) {
                creditors.push({ user: member, amount: netBalance });
            }
        }

        debtors.sort((a, b) => compareAmounts(b.amount, a.amount, currency));
        creditors.sort((a, b) => compareAmounts(b.amount, a.amount, currency));

        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];

            const settlementAmount = minAmount(debtor.amount, creditor.amount, currency);

            if (!isZeroAmount(settlementAmount, currency)) {
                const settlementData: CreateSettlementRequest = {
                    groupId: settledGroup.id,
                    payerId: debtor.user.uid,
                    payeeId: creditor.user.uid,
                    amount: settlementAmount,
                    currency,
                    note: `Settling up ${currency} expenses`,
                    date: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
                };

                settlementPromises.push(
                    driver
                        .createSettlement(settlementData, debtor.user.token)
                        .then(() => {
                            const symbol = currency === 'GBP' ? '£' : '€';
                            console.log(`Created settlement: ${debtor.user.displayName} → ${creditor.user.displayName} ${symbol}${settlementAmount}`);
                        })
                        .catch((err) => {
                            throw new Error(`Failed to create settlement: ${err.message}`);
                        }),
                );

                debtor.amount = subtractAmounts(debtor.amount, settlementAmount, currency);
                creditor.amount = subtractAmounts(creditor.amount, settlementAmount, currency);
            }

            if (isZeroAmount(debtor.amount, currency)) {
                debtorIndex++;
            } else if (isZeroAmount(settlementAmount, currency)) {
                debtorIndex++;
            }

            if (isZeroAmount(creditor.amount, currency)) {
                creditorIndex++;
            } else if (isZeroAmount(settlementAmount, currency)) {
                creditorIndex++;
            }
        }
    }

    await Promise.all(settlementPromises);

    // Verify final balances
    const finalBalances = await driver.getGroupBalances(settledGroup.id, groupMembers[0].token);

    console.log('Final balances in Settled Group (should all be ~0):');
    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = finalBalances.balancesByCurrency?.[currency];
        if (currencyBalances) {
            const zero = zeroAmount(currency);
            console.log(`  ${currency}:`);
            for (const member of groupMembers) {
                const balance = currencyBalances[member.uid];
                if (balance) {
                    const symbol = currency === 'GBP' ? '£' : '€';
                    const netBalance = normalizeAmount(balance.netBalance ?? zero, currency);
                    console.log(`    ${member.displayName}: ${symbol}${netBalance}`);
                }
            }
        }
    }

    console.log(`✓ Successfully created balanced multi-currency expenses and settlements for "Settled Group"`);
}

async function createManyExpensesForLargeGroup(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>, config: TestDataConfig): Promise<void> {
    const largeGroup = groups.find((g) => g.name === 'Large Group');
    if (!largeGroup) return;

    console.log('Creating many expenses for "Large Group" to test pagination');

    // Get actual members of this group from tracked memberships
    const groupMembers = groupMemberships.get(largeGroup.id) || [];

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

            batchPromises.push(createTestExpenseTemplate(largeGroup.id, expense, participants, payer));
        }

        await Promise.all(batchPromises);

        // Small delay between batches
        if (i + BATCH_SIZE < totalExpenses) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    console.log(`Created ${totalExpenses} expenses for "Large Group"`);
}

async function createSmallPaymentsForGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    // Skip empty group AND settled group (to preserve its settled state)
    const groupsWithPayments = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    console.log(`Creating small payments/settlements for ${groupsWithPayments.length} groups`);

    // Process groups in batches to reduce contention
    const BATCH_SIZE = 2;

    for (let i = 0; i < groupsWithPayments.length; i += BATCH_SIZE) {
        const groupBatch = groupsWithPayments.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get actual members of this group from tracked memberships
                const groupMembers = groupMemberships.get(group.id) || [];

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
                    const rawPaymentAmount = Math.random() * 45 + 5;
                    const paymentAmount = normalizeAmount(rawPaymentAmount, currency);

                    const settlementData: CreateSettlementRequest = {
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
                            console.log(`Created small payment: ${payer.displayName} → ${payee.displayName} ${currencySymbol}${paymentAmount} in ${group.name}`);
                        }),
                    );
                }

                await Promise.all(settlementPromises);
                console.log(`Created ${settlementCount} small payments for group: ${group.name}`);
            }),
        );
    }

    console.log(`✓ Finished creating small payments for all groups`);
}

async function deleteSomeExpensesFromGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    // Skip empty group and settled group (to preserve their states)
    const groupsWithExpenses = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    console.log(`Deleting some expenses from ${groupsWithExpenses.length} groups to test deletion functionality`);

    let totalDeleted = 0;

    for (const group of groupsWithExpenses) {
        // Get actual members of this group from tracked memberships and pick one to perform deletion
        const groupMembers = groupMemberships.get(group.id) || [];
        const deleter = groupMembers.find((u) => u.uid === group.createdBy) || groupMembers[0];
        if (!deleter) {
            console.warn(`No valid user found to delete expenses from group: ${group.name}`);
            continue;
        }

        // Get expenses for this group
        const { expenses } = await driver.getGroupExpenses(group.id, deleter.token);

        if (!expenses || expenses.length === 0) {
            console.log(`No expenses found in group: ${group.name}`);
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
            console.log(`Deleted expense: "${expense.description}" (${currencySymbol}${expense.amount}) from ${group.name}`);
        }

        console.log(`Deleted ${deleteCount} expense(s) from group: ${group.name}`);
    }

    console.log(`✓ Finished deleting expenses. Total deleted: ${totalDeleted} expenses across all groups`);
}

export async function generateTestData(): Promise<void> {
    const testConfig = getTestConfig();
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const logTiming = (phase: string, startMs: number) => {
        const duration = Date.now() - startMs;
        timings[phase] = duration;
        console.log(`⏱️  ${phase} completed in ${duration}ms`);
    };

    console.log(`🚀 Starting test data generation in ${testConfig.mode} mode`);

    // Initialize test pool users first (before regular test data)
    console.log('Initializing test user pool...');
    const poolInitStart = Date.now();
    await createTestPoolUsers();
    logTiming('Test pool initialization', poolInitStart);

    // Generate users based on config
    const TEST_USERS = generateTestUserRegistrations(testConfig);

    // Create first 3 test users in parallel
    console.log(`Creating first 3 test users in parallel...`);
    const userCreationStart = Date.now();

    // Create first 3 users in parallel
    const firstThreeUsers = TEST_USERS.slice(0, 3);
    const remainingUsers = TEST_USERS.slice(3);

    const parallelUsers = await Promise.all(
        firstThreeUsers.map((userInfo) =>
            (async function(userInfo: UserRegistration): Promise<AuthenticatedFirebaseUser> {
                return await driver.createUser(userInfo);
            })(userInfo)
        ),
    );
    console.log(`✓ Created ${parallelUsers.length} users in parallel`);

    // Create remaining users sequentially if any
    const sequentialUsers = [];
    for (const userInfo of remainingUsers) {
        const user = await driver.createUser(userInfo);
        sequentialUsers.push(user);
    }

    const users = [...parallelUsers, ...sequentialUsers];
    console.log(`✓ Total created ${users.length} users (${parallelUsers.length} parallel, ${sequentialUsers.length} sequential)`);
    logTiming('User creation', userCreationStart);

    // test1@test.com creates groups and collects invite links
    console.log(`Creating ${testConfig.groupCount} groups with test1@test.com as creator...`);
    const groupCreationStart = Date.now();
    const test1User = users[0]; // test1@test.com
    const groupsWithInvites = await createGroups(test1User, testConfig);
    console.log(`✓ Created ${groupsWithInvites.length} groups with invite links`);
    logTiming('Group creation', groupCreationStart);

    // Other users randomly join ~70% of groups and track memberships
    console.log('Having users randomly join groups...');
    const joinGroupsStart = Date.now();
    const groupMemberships = await joinGroupsRandomly(users, groupsWithInvites);
    console.log('✓ Users have joined groups randomly');
    logTiming('Group joining', joinGroupsStart);

    // IMPORTANT: Refresh group data after joins to get updated member lists
    console.log('Refreshing group data to get updated member lists...');
    const refreshStart = Date.now();
    const refreshedGroups = await Promise.all(
        groupsWithInvites.map(async (group) => {
            const { group: groupData } = await driver.getGroupFullDetails(group.id, test1User.token);
            return {
                ...groupData,
                inviteLink: group.inviteLink,
            } as GroupWithInvite;
        }),
    );
    console.log('✓ Refreshed group data with updated members');
    logTiming('Group data refresh', refreshStart);

    // Create random expenses for regular groups (excluding special ones)
    console.log('Creating random expenses for regular groups...');
    const regularExpensesStart = Date.now();
    await createRandomExpensesForGroups(refreshedGroups, groupMemberships, testConfig);
    console.log('✓ Created random expenses for regular groups');
    logTiming('Regular expenses creation', regularExpensesStart);

    // Create special balanced expenses for "Settled Group"
    console.log('Creating balanced expenses for "Settled Group"...');
    const balancedExpensesStart = Date.now();
    await createBalancedExpensesForSettledGroup(refreshedGroups, groupMemberships);
    console.log('✓ Created balanced expenses');
    logTiming('Balanced expenses creation', balancedExpensesStart);

    // Create many expenses for "Large Group" for pagination testing
    console.log('Creating many expenses for "Large Group"...');
    const largeGroupExpensesStart = Date.now();
    await createManyExpensesForLargeGroup(refreshedGroups, groupMemberships, testConfig);
    console.log('✓ Created many expenses for pagination testing');
    logTiming('Large group expenses creation', largeGroupExpensesStart);

    // Create small payments/settlements for groups to demonstrate payment functionality
    console.log('Creating small payments/settlements for groups...');
    const smallPaymentsStart = Date.now();
    await createSmallPaymentsForGroups(refreshedGroups, groupMemberships);
    console.log('✓ Created small payments/settlements');
    logTiming('Small payments creation', smallPaymentsStart);

    // Delete some expenses to test deletion functionality and show deleted state
    console.log('Deleting some expenses to test deletion functionality...');
    const deletionStart = Date.now();
    await deleteSomeExpensesFromGroups(refreshedGroups, groupMemberships);
    console.log('✓ Deleted some expenses from groups');
    logTiming('Expense deletion', deletionStart);

    const totalTime = Date.now() - startTime;
    console.log('🎉 Test data generation completed', {
        users: users.length,
        groups: refreshedGroups.length,
        totalTimeMs: totalTime,
        totalTimeSeconds: (totalTime / 1000).toFixed(2),
        mode: testConfig.mode,
        timings,
        testCredentials: TEST_USERS.map((u) => ({ email: u.email, password: u.password })),
        inviteLinks: refreshedGroups.map((g) => ({ name: g.name, inviteLink: g.inviteLink })),
    });
}

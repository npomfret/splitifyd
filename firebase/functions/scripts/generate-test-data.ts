#!/usr/bin/env tsx

import type {User} from '../__tests__/support/ApiDriver';
import {ApiDriver} from '../__tests__/support/ApiDriver';
import {ExpenseBuilder} from '../__tests__/support/builders';
import {logger} from '../src/logger';
import type {Group} from '../src/types/webapp-shared-types';

// Initialize ApiDriver which handles all configuration
const driver = new ApiDriver();

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is a transaction lock timeout
      const errorMessage = error?.message || String(error);
      const isTransactionTimeout = errorMessage.includes('Transaction lock timeout') ||
                                  errorMessage.includes('transaction lock') ||
                                  errorMessage.includes('ABORTED');
      
      if (attempt < maxAttempts && isTransactionTimeout) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed with transaction timeout, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

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
    mode: 'fast'
  },
  full: {
    userCount: 5,
    groupCount: 10,
    regularExpensesPerUser: { min: 1, max: 2 },
    largeGroupExpenseCount: 50,
    mode: 'full'
  }
};

// Get configuration from environment or default to 'full'
const getTestConfig = (): TestDataConfig => {
  const mode = process.env.TEST_DATA_MODE as 'fast' | 'full' || 'full';
  return TEST_CONFIGS[mode];
};

const generateTestUsers = (config: TestDataConfig): TestUser[] => {
  const users: TestUser[] = [];
  
  // Keep test1@test.com as the first user for easy reference
  users.push({
    email: 'test1@test.com',
    password: 'rrRR44$$',
    displayName: 'Bill Splitter'
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
    { email: 'kevin.allen@example.com', displayName: 'Kevin Allen' }
  ];
  
  // Add users based on config count (minus 1 since we already have test1@test.com)
  const remainingCount = Math.min(config.userCount - 1, testUsers.length);
  for (let i = 0; i < remainingCount; i++) {
    users.push({
      ...testUsers[i],
      password: 'rrRR44$$'
    });
  }
  
  return users;
};

// TEST_USERS will be generated based on config in generateTestData()

const EXPENSE_CATEGORIES = ['food', 'transport', 'entertainment', 'accommodation', 'utilities', 'shopping', 'healthcare', 'other'];
const EXPENSE_DESCRIPTIONS = [
  // Food & Dining
  'Dinner at restaurant', 'Grocery shopping', 'Coffee shop', 'Lunch', 'Breakfast', 'Snacks', 'Pizza delivery',
  'Takeout dinner', 'Brunch', 'Food truck', 'Ice cream', 'Bakery treats', 'Wine tasting', 'Cooking class',
  'Bar drinks', 'Happy hour', 'Cocktails', 'Beer garden', 'Food festival', 'Farmers market',
  
  // Transport
  'Gas for car', 'Taxi ride', 'Uber ride', 'Train ticket', 'Bus fare', 'Parking fee', 'Tolls', 'Rental car',
  'Flight ticket', 'Airport shuttle', 'Metro pass', 'Car wash', 'Car maintenance', 'Bike repair',
  'Scooter rental', 'Ferry ride', 'Subway card', 'Rideshare', 'Car insurance', 'Vehicle registration',
  
  // Entertainment
  'Movie tickets', 'Concert tickets', 'Theater show', 'Sports game', 'Museum entry', 'Zoo visit',
  'Amusement park', 'Bowling', 'Mini golf', 'Arcade games', 'Escape room', 'Karaoke', 'Comedy show',
  'Art gallery', 'Music festival', 'Dance class', 'Gaming tournament', 'Board game cafe',
  
  // Accommodation
  'Hotel booking', 'Airbnb stay', 'Room service', 'Minibar', 'Resort fees', 'Camping fees',
  'Hostel bed', 'Vacation rental', 'Hotel breakfast', 'Room upgrade', 'Late checkout fee',
  
  // Utilities & Services
  'Laundry', 'Dry cleaning', 'Phone bill', 'Internet bill', 'Streaming service', 'Cloud storage',
  'Software subscription', 'App purchase', 'Online course', 'Gym membership', 'Spa treatment',
  
  // Shopping
  'Clothes shopping', 'Electronics', 'Home supplies', 'Gifts', 'Books', 'Stationery',
  'Hardware store', 'Furniture', 'Decorations', 'Kitchen supplies', 'Sporting goods', 'Toys',
  'Jewelry', 'Cosmetics', 'Garden supplies', 'Pet supplies', 'Office supplies',
  
  // Healthcare
  'Medical checkup', 'Pharmacy', 'Dental visit', 'Eye exam', 'Prescription', 'Vitamins',
  'Therapy session', 'Massage', 'Chiropractor', 'Lab tests', 'Emergency room', 'Urgent care',
  
  // Other
  'Home repair', 'Legal fees', 'Bank charges', 'Postage', 'Printing', 'Storage unit',
  'Moving costs', 'Cleaning service', 'Pet grooming', 'Childcare', 'Tuition', 'Wedding gift',
  'Baby shower gift', 'Birthday party', 'Holiday decorations', 'Charity donation'
];

const generateRandomExpense = (): TestExpense => {
  const description = EXPENSE_DESCRIPTIONS[Math.floor(Math.random() * EXPENSE_DESCRIPTIONS.length)];
  const category = EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)];
  // More varied amounts with realistic distribution
  const amountTypes = [
    () => Math.round((Math.random() * 15 + 3) * 100) / 100,    // Micro: $3-$18 (30%)
    () => Math.round((Math.random() * 35 + 10) * 100) / 100,   // Small: $10-$45 (25%)
    () => Math.round((Math.random() * 80 + 20) * 100) / 100,   // Medium: $20-$100 (25%)
    () => Math.round((Math.random() * 200 + 50) * 100) / 100,  // Large: $50-$250 (15%)
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
  try {
    return await driver.createUser(userInfo);
  } catch (error: unknown) {
    logger.error(`✗ Failed to create user ${userInfo.email}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createGroupWithInvite(name: string, description: string, createdBy: User): Promise<GroupWithInvite> {
  try {
    // Create group with just the creator initially (with retry)
    const group = await retryWithBackoff(
      () => driver.createGroupWithMembers(name, [createdBy], createdBy.token),
      3,
      500
    );
    
    // Generate shareable link (with retry)
    const shareLink = await retryWithBackoff(
      () => driver.generateShareLink(group.id, createdBy.token),
      3,
      500
    );
    
    return {
      ...group,
      inviteLink: shareLink.linkId
    } as GroupWithInvite;
  } catch (error) {
    logger.error(`✗ Failed to create group ${name}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createGroups(createdBy: User, config: TestDataConfig): Promise<GroupWithInvite[]> {
  const groups: GroupWithInvite[] = [];
  
  // Create special "Empty Group" with NO expenses
  const emptyGroup = await createGroupWithInvite(
    'Empty Group',
    'This group has no expenses - testing empty state',
    createdBy
  );
  groups.push(emptyGroup);
  logger.info(`Created special empty group: ${emptyGroup.name} with invite link: ${emptyGroup.inviteLink}`);
  
  // Create special "Settled Group" for balanced expenses where no one owes
  const settledGroup = await createGroupWithInvite(
    'Settled Group',
    'All expenses are balanced - no one owes anything',
    createdBy
  );
  groups.push(settledGroup);
  logger.info(`Created special settled group: ${settledGroup.name} with invite link: ${settledGroup.inviteLink}`);
  
  // Create special "Large Group" with many users and expenses
  const largeGroup = await createGroupWithInvite(
    'Large Group',
    'Many users and expenses for testing pagination and performance',
    createdBy
  );
  groups.push(largeGroup);
  logger.info(`Created special large group: ${largeGroup.name} with invite link: ${largeGroup.inviteLink}`);
  
  // Create regular groups with various names
  const regularGroupCount = config.groupCount - 3;
  const groupNames = [
    'Weekend Trip', 'Roommates', 'Lunch Crew', 'Game Night',
    'Beach House', 'Ski Trip', 'Birthday Party', 'Road Trip',
    'Concert Tickets', 'Dinner Club', 'Movie Night', 'Camping Trip'
  ];
  
  for (let i = 0; i < regularGroupCount; i++) {
    const groupName = groupNames[i % groupNames.length] + (i >= groupNames.length ? ` ${Math.floor(i / groupNames.length) + 1}` : '');
    const group = await createGroupWithInvite(
      groupName,
      'Regular group with some expenses',
      createdBy
    );
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
  await Promise.all(otherUsers.map(async (user) => {
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
          retryWithBackoff(
            () => driver.joinGroupViaShareLink(group.inviteLink, user.token),
            3,
            500
          )
            .then(() => joinedCount++)
            .catch((joinError) => {
              logger.warn(`Failed to add ${user.email} to group ${group.name}`, { 
                error: joinError instanceof Error ? joinError : new Error(String(joinError))
              });
            })
        );
      }
    }
    
    await Promise.all(joinPromises);
    logger.info(`${user.email} joined ${joinedCount} out of ${groups.length} groups`);
  }));
}

async function createTestExpense(
  groupId: string, 
  expense: TestExpense, 
  participants: User[], 
  createdBy: User
): Promise<any> {
  try {
    const participantIds = participants.map(p => p.uid);
    
    const expenseData = new ExpenseBuilder()
      .withGroupId(groupId)
      .withAmount(expense.amount)
      .withDescription(expense.description)
      .withCategory(expense.category)
      .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
      .withSplitType('equal')
      .withParticipants(participantIds)
      .withPaidBy(createdBy.uid)
      .build();

    // Create expense via ApiDriver with retry logic
    return await retryWithBackoff(
        () => driver.createExpense(expenseData, createdBy.token),
        3,  // max attempts
        500 // initial delay 500ms
    );
  } catch (error) {
    logger.error(`✗ Failed to create expense ${expense.description}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createRandomExpensesForGroups(groups: GroupWithInvite[], users: User[], config: TestDataConfig): Promise<void> {
  // Skip the special groups - only process regular groups
  const regularGroups = groups.filter(g => 
    g.name !== 'Empty Group' && 
    g.name !== 'Settled Group' && 
    g.name !== 'Large Group'
  );
  
  logger.info(`Creating random expenses for ${regularGroups.length} regular groups`);
  
  // Process groups in batches of 3 to reduce contention
  const BATCH_SIZE = 3;
  
  for (let i = 0; i < regularGroups.length; i += BATCH_SIZE) {
    const groupBatch = regularGroups.slice(i, i + BATCH_SIZE);
    
    await Promise.all(groupBatch.map(async (group) => {
      // Get all members of this group
      const groupMembers = users.filter(user => 
        group.memberIds?.includes(user.uid)
      );
      
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
          if (!participants.some(p => p.uid === user.uid)) {
            participants[0] = user;
          }
          
          expensePromises.push(
            createTestExpense(group.id, expense, participants, user)
              .catch(error => {
                logger.error(`Failed to create expense in group ${group.name}`, {
                  groupId: group.id,
                  error: error instanceof Error ? error : new Error(String(error))
                });
                throw error;
              })
          );
        }
      }
      
      await Promise.all(expensePromises);
      logger.info(`Created ${expensePromises.length} random expenses for group: ${group.name}`);
    }));
  }
}

async function createBalancedExpensesForSettledGroup(groups: GroupWithInvite[], users: User[]): Promise<void> {
  const settledGroup = groups.find(g => g.name === 'Settled Group');
  if (!settledGroup) return;
  
  logger.info('Creating balanced expenses for "Settled Group" so no one owes anything');
  
  // Get all members of this group from the refreshed data
  const groupMembers = users.filter(user => 
    settledGroup.memberIds?.includes(user.uid)
  );
  
  if (groupMembers.length < 2) return;
  
  // Create a perfectly balanced set of expenses where everyone pays and owes equally
  // Example with 3 users (A, B, C):
  // - A pays $60 for everyone (A owes $20, B owes $20, C owes $20)
  // - B pays $60 for everyone (A owes $20, B owes $20, C owes $20)
  // - C pays $60 for everyone (A owes $20, B owes $20, C owes $20)
  // Result: Everyone paid $60 and owes $60 total, so net = $0
  
  const amountPerPerson = 20; // Each person's share per expense
  const totalAmount = amountPerPerson * groupMembers.length;
  
  logger.info(`Creating balanced expenses for ${groupMembers.length} members in Settled Group`, {
    groupId: settledGroup.id,
    memberIds: groupMembers.map(m => m.uid),
    memberNames: groupMembers.map(m => m.displayName)
  });
  
  // Create one expense per member where they pay for everyone
  let createdCount = 0;
  const expensePromises = groupMembers.map(async (payer, index) => {
    const expense: TestExpense = {
      description: `Group dinner ${index + 1}`,
      amount: totalAmount,
      category: 'food'
    };
    
    try {
      await createTestExpense(settledGroup.id, expense, groupMembers, payer);
      createdCount++;
      logger.info(`Created balanced expense ${index + 1}/${groupMembers.length}`, {
        groupId: settledGroup.id,
        payer: payer.displayName,
        amount: totalAmount
      });
    } catch (error) {
      logger.error(`Failed to create balanced expense ${index + 1}`, {
        groupId: settledGroup.id,
        payer: payer.displayName,
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  });
  
  await Promise.all(expensePromises);
  
  logger.info(`Successfully created ${createdCount}/${groupMembers.length} balanced expenses for "Settled Group"`);
}

async function createManyExpensesForLargeGroup(groups: GroupWithInvite[], users: User[], config: TestDataConfig): Promise<void> {
  const largeGroup = groups.find(g => g.name === 'Large Group');
  if (!largeGroup) return;
  
  logger.info('Creating many expenses for "Large Group" to test pagination');
  
  // Get all members of this group from the refreshed data
  const groupMembers = users.filter(user => 
    largeGroup.memberIds?.includes(user.uid)
  );
  
  if (groupMembers.length === 0) return;
  
  // Create expenses based on config to test pagination
  const totalExpenses = config.largeGroupExpenseCount;
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < totalExpenses; i += BATCH_SIZE) {
    const batchPromises = [];
    
    for (let j = 0; j < BATCH_SIZE && (i + j) < totalExpenses; j++) {
      const expense = generateRandomExpense();
      const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];
      
      // Random participants (2-5 people)
      const participantCount = Math.floor(Math.random() * 4) + 2;
      const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
      let participants = shuffled.slice(0, Math.min(participantCount, groupMembers.length));
      
      // Ensure payer is included
      if (!participants.some(p => p.uid === payer.uid)) {
        participants[0] = payer;
      }
      
      batchPromises.push(createTestExpense(largeGroup.id, expense, participants, payer));
    }
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (i + BATCH_SIZE < totalExpenses) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  logger.info(`Created ${totalExpenses} expenses for "Large Group"`);
}

async function createSmallPaymentsForGroups(groups: GroupWithInvite[], users: User[]): Promise<void> {
  // Skip empty group but process all other groups including settled and large groups
  const groupsWithPayments = groups.filter(g => g.name !== 'Empty Group');
  
  logger.info(`Creating small payments/settlements for ${groupsWithPayments.length} groups`);
  
  // Process groups in batches to reduce contention
  const BATCH_SIZE = 2;
  
  for (let i = 0; i < groupsWithPayments.length; i += BATCH_SIZE) {
    const groupBatch = groupsWithPayments.slice(i, i + BATCH_SIZE);
    
    await Promise.all(groupBatch.map(async (group) => {
      // Get all members of this group
      const groupMembers = users.filter(user => 
        group.memberIds?.includes(user.uid)
      );
      
      if (groupMembers.length < 2) return;
      
      // Create 1-3 small settlements per group
      const settlementCount = Math.floor(Math.random() * 3) + 1;
      const settlementPromises = [];
      
      for (let j = 0; j < settlementCount; j++) {
        // Pick random payer and payee
        const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];
        const availablePayees = groupMembers.filter(m => m.uid !== payer.uid);
        
        if (availablePayees.length === 0) continue;
        
        const payee = availablePayees[Math.floor(Math.random() * availablePayees.length)];
        
        // Generate small payment amounts between $5 and $50
        const paymentAmount = Math.round((Math.random() * 45 + 5) * 100) / 100;
        
        const paymentNotes = [
          'Coffee payment', 'Lunch payback', 'Gas money', 'Uber split', 
          'Drinks last night', 'Pizza share', 'Movie tickets', 'Parking fee',
          'Groceries split', 'Tip payback', 'Breakfast split', 'Snacks'
        ];
        
        const settlementData = {
          groupId: group.id,
          payerId: payer.uid,
          payeeId: payee.uid,
          amount: paymentAmount,
          currency: 'USD',
          note: paymentNotes[Math.floor(Math.random() * paymentNotes.length)],
          date: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 15 days
        };
        
        settlementPromises.push(
          retryWithBackoff(
            () => driver.createSettlement(settlementData, payer.token),
            3,
            500
          )
            .then(() => {
              logger.info(`Created small payment: ${payer.displayName} → ${payee.displayName} $${paymentAmount} in ${group.name}`);
            })
            .catch(error => {
              logger.warn(`Failed to create settlement in group ${group.name}`, {
                groupId: group.id,
                payer: payer.displayName,
                payee: payee.displayName,
                amount: paymentAmount,
                error: error instanceof Error ? error : new Error(String(error))
              });
              // Don't throw - continue with other settlements
            })
        );
      }
      
      await Promise.all(settlementPromises);
      logger.info(`Created ${settlementCount} small payments for group: ${group.name}`);
    }));
  }
  
  logger.info(`✓ Finished creating small payments for all groups`);
}

async function deleteSomeExpensesFromGroups(groups: GroupWithInvite[], users: User[]): Promise<void> {
  // Skip empty group (it has no expenses to delete)
  const groupsWithExpenses = groups.filter(g => g.name !== 'Empty Group');
  
  logger.info(`Deleting some expenses from ${groupsWithExpenses.length} groups to test deletion functionality`);
  
  let totalDeleted = 0;
  
  for (const group of groupsWithExpenses) {
    try {
      // Get a group member to perform the deletion (preferably the creator)
      const deleter = users.find(u => u.uid === group.createdBy) || users.find(u => group.memberIds?.includes(u.uid));
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
        Math.max(1, Math.floor(expenses.length * 0.2)) // Or 20% of expenses, whichever is less
      );
      
      // Randomly select expenses to delete
      const shuffled = [...expenses].sort(() => 0.5 - Math.random());
      const expensesToDelete = shuffled.slice(0, deleteCount);
      
      // Delete the selected expenses
      for (const expense of expensesToDelete) {
        try {
          await retryWithBackoff(
            () => driver.deleteExpense(expense.id, deleter.token),
            2,
            500
          );
          totalDeleted++;
          logger.info(`Deleted expense: "${expense.description}" ($${expense.amount}) from ${group.name}`);
        } catch (error) {
          logger.warn(`Failed to delete expense ${expense.id} from group ${group.name}`, {
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }
      
      logger.info(`Deleted ${deleteCount} expense(s) from group: ${group.name}`);
      
    } catch (error) {
      logger.error(`Failed to process expense deletion for group ${group.name}`, {
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }
  
  logger.info(`✓ Finished deleting expenses. Total deleted: ${totalDeleted} expenses across all groups`);
}

async function waitForApiReady(): Promise<void> {
  // ApiDriver will handle checking if the API is ready
  // We can simply try to make a request and it will work when ready
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      // Try to list groups as a health check
      await driver.listGroups('test-token');
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        // This is expected - API is ready but we're using a fake token
        return;
      }
      
      // If functions aren't ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  throw new Error('API functions failed to become ready within timeout');
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
  
  try {
    logger.info(`🚀 Starting test data generation in ${config.mode} mode`);

    // Wait for API to be ready before proceeding
    const apiCheckStart = Date.now();
    await waitForApiReady();
    logTiming('API readiness check', apiCheckStart);

    // Generate users based on config
    const TEST_USERS = generateTestUsers(config);
    
    // Create all test users in parallel
    logger.info(`Creating ${config.userCount} test users...`);
    const userCreationStart = Date.now();
    const users = await Promise.all(
      TEST_USERS.map(userInfo => createTestUser(userInfo))
    );
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
          inviteLink: group.inviteLink
        } as GroupWithInvite;
      })
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
      testCredentials: TEST_USERS.map(u => ({ email: u.email, password: u.password })),
      inviteLinks: refreshedGroups.map(g => ({ name: g.name, inviteLink: g.inviteLink }))
    });

  } catch (error) {
    logger.error('❌ Test data generation failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  const config = getTestConfig();
  logger.info(`Running generate-test-data script in ${config.mode} mode`);
  logger.info('To use fast mode, run: TEST_DATA_MODE=fast npm run generate-test-data');
  
  generateTestData().then(() => {
    process.exit(0);
  }).catch(error => {
    logger.error('❌ Script failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  });
}
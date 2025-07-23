#!/usr/bin/env tsx

import { ApiDriver } from '../__tests__/support/ApiDriver';
import { ExpenseBuilder } from '../__tests__/support/builders/ExpenseBuilder';
import { logger } from '../src/logger';
import type { User } from '../__tests__/support/ApiDriver';
import type { Group } from '../src/types/webapp-shared-types';

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



const generateTestUsers = (): TestUser[] => {
  const users: TestUser[] = [
    // First user is always test1@test.com for consistency
    { email: 'test1@test.com', password: 'rrRR44$$', displayName: 'Test User 1' }
  ];
  
  // Add remaining 4 users for 5 total
  for (let i = 2; i <= 5; i++) {
    users.push({
      email: `user${i}@test.com`,
      password: 'rrRR44$$',
      displayName: `Test User ${i}`
    });
  }
  return users;
};

const TEST_USERS: TestUser[] = generateTestUsers();

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
    return await driver.createTestUser(userInfo);
  } catch (error: unknown) {
    logger.error(`✗ Failed to create user ${userInfo.email}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createTestGroup(name: string, members: User[], createdBy: User): Promise<Group> {
  try {
    // Create group with all members
    const group = await driver.createGroup(name, members, createdBy.token);
    return group;
  } catch (error) {
    logger.error(`✗ Failed to create group ${name}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createTestExpense(
  groupId: string, 
  expense: TestExpense, 
  participants: User[], 
  createdBy: User
): Promise<any> {
  try {
    const participantIds = participants.map(p => p.uid);
    
    // Use ExpenseBuilder to ensure proper structure
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

    // Create expense via ApiDriver
    const response = await driver.createExpense(expenseData, createdBy.token);

    return response;
  } catch (error) {
    logger.error(`✗ Failed to create expense ${expense.description}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
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
      await driver.listGroupsNew('test-token');
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

function getRandomUsers(allUsers: User[], count: number): User[] {
  const shuffled = [...allUsers].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateRandomGroupName(): string {
  const adjectives = [
    'Amazing', 'Awesome', 'Cool', 'Epic', 'Fun', 'Great', 'Happy', 'Super', 'Wild', 'Zen',
    'Bold', 'Brave', 'Bright', 'Creative', 'Dynamic', 'Electric', 'Fierce', 'Golden', 'Infinite',
    'Legendary', 'Magical', 'Noble', 'Radiant', 'Stellar', 'Thunder', 'Ultimate', 'Vibrant',
    'Wicked', 'Zesty', 'Cosmic', 'Mystic', 'Phoenix', 'Quantum', 'Rapid', 'Sonic', 'Turbo'
  ];
  const nouns = [
    'Adventures', 'Buddies', 'Crew', 'Friends', 'Gang', 'Group', 'Squad', 'Team', 'Travelers', 'Warriors',
    'Alliance', 'Champions', 'Collective', 'Dynasty', 'Empire', 'Fellowship', 'Guild', 'Heroes',
    'Legends', 'Mavericks', 'Ninjas', 'Pirates', 'Rebels', 'Rogues', 'Spartans', 'Titans',
    'Vikings', 'Wizards', 'Explorers', 'Nomads', 'Pioneers', 'Wanderers', 'Crusaders', 'Defenders',
    'Guardians', 'Knights', 'Rangers', 'Scouts', 'Hunters', 'Riders', 'Sailors', 'Pilots'
  ];
  
  // Sometimes add a theme or location
  const themes = [
    '', '', '', '', '', // 50% chance of no theme (just adjective + noun)
    'Tokyo', 'Paris', 'NYC', 'London', 'Berlin', 'Vegas', 'Beach', 'Mountain', 'City', 'Desert'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  
  return theme ? `${theme} ${adjective} ${noun}` : `${adjective} ${noun}`;
}

async function createRandomGroupsForUser(user: User, allUsers: User[], groupCount: number): Promise<Group[]> {
  const groups: Group[] = [];
  
  for (let i = 0; i < groupCount; i++) {
    const groupSize = Math.min(Math.floor(Math.random() * 3) + 2, allUsers.length); // 2-4 users per group, max available
    const otherUsers = allUsers.filter(u => u.uid !== user.uid);
    const randomMembers = getRandomUsers(otherUsers, groupSize - 1);
    const allMembers = [user, ...randomMembers];
    
    const groupName = generateRandomGroupName();
    const group = await createTestGroup(groupName, allMembers, user);
    groups.push(group);
    
  }
  
  return groups;
}

async function createRandomExpensesForGroup(group: Group, allUsers: User[], expenseCount: number): Promise<void> {
  const groupMembers = allUsers.filter(user => 
    group.members?.some((member: any) => member.uid === user.uid)
  );
  
  // Create expenses in smaller batches to avoid transaction lock timeouts
  const BATCH_SIZE = 5;
  const expenses = [];
  
  for (let i = 0; i < expenseCount; i++) {
    const expense = generateRandomExpense();
    const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];
    
    // More varied participant patterns to create uneven balances
    const participantPatterns = [
      // Sometimes just 2 people (creates more imbalance)
      () => 2,
      // Sometimes just payer + 1 other (creates debt)
      () => Math.min(2, groupMembers.length),
      // Sometimes most of the group
      () => Math.max(2, groupMembers.length - 1),
      // Sometimes everyone
      () => groupMembers.length,
      // Random subset
      () => Math.floor(Math.random() * (groupMembers.length - 1)) + 2
    ];
    
    const participantCount = participantPatterns[Math.floor(Math.random() * participantPatterns.length)]();
    const participants = getRandomUsers(groupMembers, Math.min(participantCount, groupMembers.length));
    
    // Ensure payer is always a participant
    if (!participants.some(p => p.uid === payer.uid)) {
      participants[0] = payer;
    }
    
    // Ensure we have at least one participant
    if (participants.length === 0) {
      participants.push(groupMembers[Math.floor(Math.random() * groupMembers.length)]);
    }
    
    expenses.push({
      expense,
      participants,
      payer
    });
  }
  
  // Execute expenses in batches
  for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
    const batch = expenses.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(({ expense, participants, payer }) =>
      createTestExpense(group.id, expense, participants, payer)
    );
    await Promise.all(batchPromises);
    
    // Small delay between batches to allow database to process
    if (i + BATCH_SIZE < expenses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
}

async function createCircularDebtScenario(users: User[]): Promise<void> {
  const groupName = 'simplify-test-group';
  const groupMembers = [users[0], users[1], users[2]];
  const group = await createTestGroup(groupName, groupMembers, users[0]);

  const expenseAmount = 100;

  // Create all three expenses in parallel
  await Promise.all([
    // User 1 pays for User 2
    createTestExpense(
      group.id,
      { description: 'U1 pays for U2', amount: expenseAmount, category: 'other' },
      [users[0], users[1]],
      users[0]
    ),
    // User 2 pays for User 3
    createTestExpense(
      group.id,
      { description: 'U2 pays for U3', amount: expenseAmount, category: 'other' },
      [users[1], users[2]],
      users[1]
    ),
    // User 3 pays for User 1
    createTestExpense(
      group.id,
      { description: 'U3 pays for U1', amount: expenseAmount, category: 'other' },
      [users[2], users[0]],
      users[2]
    )
  ]);

}

export async function generateTestData(): Promise<void> {
  try {
    logger.info('🚀 Starting test data generation');

    // Wait for API to be ready before proceeding
    await waitForApiReady();

    // Create all 5 test users in parallel
    const users = await Promise.all(
      TEST_USERS.map(userInfo => createTestUser(userInfo))
    );

    // Create groups for each user (5 users × 1 group each = 5 groups total)
    // Process all users in parallel - no batching needed for just 5 users
    const groupPromises = users.map(user => 
      createRandomGroupsForUser(user, users, 1)
    );
    
    const allGroupsNested = await Promise.all(groupPromises);
    const allGroups = allGroupsNested.flat();
    

    // Create expenses for all groups in sequence to avoid transaction lock timeouts
    const expenseCounts = [];
    
    for (let index = 0; index < allGroups.length; index++) {
      const group = allGroups[index];
      // First group gets many expenses for pagination testing, others get minimal
      const expenseCount = index === 0 ? 50 : 1; // 50 expenses for first group, 1 for others
      await createRandomExpensesForGroup(group, users, expenseCount);
      expenseCounts.push(expenseCount);
    }
    const totalExpenses = expenseCounts.reduce((sum, count) => sum + count, 0);
    
    await createCircularDebtScenario(users.slice(0, 3)); // Use first 3 users

    logger.info('🎉 Test data generation completed', {
      users: users.length,
      groups: allGroups.length,
      expenses: totalExpenses,
      testCredentials: TEST_USERS.map(u => ({ email: u.email, password: u.password }))
    });

  } catch (error) {
    logger.error('❌ Test data generation failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateTestData().then(() => {
    process.exit(0);
  }).catch(error => {
    logger.error('❌ Script failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  });
}
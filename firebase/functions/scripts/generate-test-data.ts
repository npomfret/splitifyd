#!/usr/bin/env ts-node

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/logger';

// Read ports from generated firebase.json
const firebaseConfigPath = path.join(__dirname, '../../firebase.json');

if (!fs.existsSync(firebaseConfigPath)) {
  logger.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port;
const FIRESTORE_PORT = firebaseConfig.emulators.firestore.port;
const AUTH_PORT = firebaseConfig.emulators.auth.port;

if (!FUNCTIONS_PORT || !FIRESTORE_PORT || !AUTH_PORT) {
  logger.error('❌ Invalid firebase.json configuration - missing emulator ports');
  process.exit(1);
}

// Read Firebase project ID from .firebaserc
const firebaseRcPath = path.join(__dirname, '../../.firebaserc');
const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
const firebaseProjectId = firebaseRc.projects.default;

// API base URL
const API_BASE_URL = `http://localhost:${FUNCTIONS_PORT}/${firebaseProjectId}/us-central1/api`;

// Set emulator environment variables before initializing
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AUTH_PORT}`;

// Initialize Firebase Admin for emulator (only for getting user info after creation)
admin.initializeApp({
  projectId: firebaseProjectId
});

const auth = admin.auth();

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

interface UserRecord extends admin.auth.UserRecord {
  token: string;
}

interface GroupMember {
  uid: string;
  name: string;
  email: string;
  initials: string;
}

interface GroupData {
  name: string;
  members: GroupMember[];
}

interface Group extends GroupData {
  id: string;
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

const EXAMPLE_EXPENSES: TestExpense[] = [
  { description: 'expense-1', amount: 75.50, category: 'food' },
  { description: 'expense-2', amount: 25.00, category: 'transport' },
  { description: 'expense-3', amount: 45.80, category: 'food' },
  { description: 'expense-4', amount: 32.00, category: 'entertainment' },
  { description: 'expense-5', amount: 15.75, category: 'food' },
  { description: 'expense-6', amount: 40.00, category: 'transport' },
  { description: 'expense-7', amount: 28.50, category: 'food' },
  { description: 'expense-8', amount: 120.00, category: 'entertainment' },
  { description: 'expense-9', amount: 18.25, category: 'transport' },
  { description: 'expense-10', amount: 35.60, category: 'food' }
];

async function apiRequest(
  endpoint: string, 
  method: string = 'POST', 
  body: unknown = null, 
  token: string | null = null
): Promise<unknown> {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    // Try to parse response as JSON, but handle non-JSON responses
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      logger.error(`Non-JSON response from ${endpoint}`, { response: text });
      
      // If it's the "Function does not exist" error, it means Firebase isn't ready yet
      if (text.includes('Function us-central1-api does not exist')) {
        throw new Error('Firebase Functions not ready yet. Please wait for emulator to fully initialize.');
      }
      
      throw new Error(`API returned non-JSON response: ${text.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      const errorMessage = (data && typeof data === 'object' && 'error' in data && 
                           data.error && typeof data.error === 'object' && 'message' in data.error && 
                           typeof data.error.message === 'string') 
                           ? data.error.message 
                           : `API request failed: ${response.status}`;
      throw new Error(errorMessage);
    }
    
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`✗ API request to ${endpoint} failed`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg'; // Default API key for emulator
  const url = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to exchange custom token');
    }
    
    return data.idToken;
  } catch (error) {
    logger.error('Failed to exchange custom token', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createTestUser(userInfo: TestUser): Promise<UserRecord> {
  try {
    
    // Register user via API
    const registerResponse = await apiRequest('/register', 'POST', {
      email: userInfo.email,
      password: userInfo.password,
      displayName: userInfo.displayName
    });

    // Use Firebase Auth REST API to sign in
    const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';
    const signInResponse = await fetch(
      `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userInfo.email,
          password: userInfo.password,
          returnSecureToken: true
        })
      }
    );

    if (!signInResponse.ok) {
      const error = await signInResponse.json();
      throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = await signInResponse.json();
    const idToken = authData.idToken;
    
    // Get user record from Firebase Auth to get the UID
    const userRecord = await auth.getUserByEmail(userInfo.email);

    return { ...userRecord, token: idToken } as UserRecord;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists')) {
      
      // Use Firebase Auth REST API to sign in
      const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';
      const signInResponse = await fetch(
        `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userInfo.email,
            password: userInfo.password,
            returnSecureToken: true
          })
        }
      );

      if (!signInResponse.ok) {
        const error = await signInResponse.json();
        throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
      }

      const authData = await signInResponse.json();
      const idToken = authData.idToken;
      
      const userRecord = await auth.getUserByEmail(userInfo.email);
      return { ...userRecord, token: idToken } as UserRecord;
    }
    throw error;
  }
}

async function createTestGroup(name: string, members: UserRecord[], createdBy: UserRecord): Promise<Group> {
  try {
    
    const groupData: GroupData = {
      name,
      members: members.map(member => ({
        uid: member.uid,
        name: member.displayName || '',
        email: member.email || '',
        initials: (member.displayName || '').split(' ').map(n => n[0]).join('').toUpperCase()
      }))
    };

    // Create group via API
    const response = await apiRequest('/createDocument', 'POST', { 
      data: groupData 
    }, createdBy.token);

    return { id: (response as any).id, ...groupData };
  } catch (error) {
    logger.error(`✗ Failed to create group ${name}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function createTestExpense(
  groupId: string, 
  expense: TestExpense, 
  participants: UserRecord[], 
  createdBy: UserRecord
): Promise<any> {
  try {
    const expenseData = {
      groupId,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      splitType: 'equal',
      participants: participants.map(p => p.uid),
      paidBy: createdBy.uid // Just the user ID, not an object
    };

    // Create expense via API
    const response = await apiRequest('/expenses', 'POST', expenseData, createdBy.token);

    return response;
  } catch (error) {
    logger.error(`✗ Failed to create expense ${expense.description}`, { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

async function waitForApiReady(): Promise<void> {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      await apiRequest('/health', 'GET');
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Firebase Functions not ready yet')) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      
      // For other errors (like 404 on /health), the API is ready but endpoint doesn't exist
      // This means functions are loaded
      if (!errorMessage.includes('Function us-central1-api does not exist')) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  throw new Error('API functions failed to become ready within timeout');
}

function getRandomUsers(allUsers: UserRecord[], count: number): UserRecord[] {
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

async function createRandomGroupsForUser(user: UserRecord, allUsers: UserRecord[], groupCount: number): Promise<Group[]> {
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

async function createRandomExpensesForGroup(group: Group, allUsers: UserRecord[], expenseCount: number): Promise<void> {
  const groupMembers = allUsers.filter(user => 
    group.members.some(member => member.uid === user.uid)
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

async function createCircularDebtScenario(users: UserRecord[]): Promise<void> {
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
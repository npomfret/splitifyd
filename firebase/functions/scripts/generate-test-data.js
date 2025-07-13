#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { loadAppConfig } = require('./load-app-config');

// Read ports from generated firebase.json
const firebaseConfigPath = path.join(__dirname, '../../firebase.json');

if (!fs.existsSync(firebaseConfigPath)) {
  console.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port;
const FIRESTORE_PORT = firebaseConfig.emulators.firestore.port;
const AUTH_PORT = firebaseConfig.emulators.auth.port;

if (!FUNCTIONS_PORT || !FIRESTORE_PORT || !AUTH_PORT) {
  console.error('❌ Invalid firebase.json configuration - missing emulator ports');
  process.exit(1);
}

// Load app configuration
const appConfig = loadAppConfig();

// API base URL
const API_BASE_URL = `http://localhost:${FUNCTIONS_PORT}/${appConfig.firebaseProjectId}/us-central1/api`;

// Set emulator environment variables before initializing
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AUTH_PORT}`;

// Initialize Firebase Admin for emulator (only for getting user info after creation)
admin.initializeApp({
  projectId: appConfig.firebaseProjectId
});

const auth = admin.auth();

const TEST_USERS = [
  { email: 'test1@test.com', password: 'rrRR44$$', displayName: 'Test User 1' },
  { email: 'test2@test.com', password: 'rrRR44$$', displayName: 'Test User 2' },
  { email: 'test3@test.com', password: 'rrRR44$$', displayName: 'Test User 3' }
];

const EXAMPLE_EXPENSES = [
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

async function apiRequest(endpoint, method = 'POST', body = null, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  };

  try {
    const response = await fetch(url, options);
    
    // Try to parse response as JSON, but handle non-JSON responses
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`Non-JSON response from ${endpoint}:`, text);
      
      // If it's the "Function does not exist" error, it means Firebase isn't ready yet
      if (text.includes('Function us-central1-api does not exist')) {
        throw new Error('Firebase Functions not ready yet. Please wait for emulator to fully initialize.');
      }
      
      throw new Error(`API returned non-JSON response: ${text.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      throw new Error(data.error?.message || `API request failed: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`✗ API request to ${endpoint} failed:`, error.message);
    throw error;
  }
}

async function exchangeCustomTokenForIdToken(customToken) {
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
    console.error('Failed to exchange custom token:', error);
    throw error;
  }
}

async function createTestUser(userInfo) {
  try {
    console.log(`Creating user: ${userInfo.email}`);
    
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

    console.log(`✓ Created user: ${userInfo.email} (${userRecord.uid})`);
    return { ...userRecord, token: idToken };
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`→ User already exists: ${userInfo.email}, logging in...`);
      
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
      return { ...userRecord, token: idToken };
    }
    throw error;
  }
}

async function createTestGroup(name, members, createdBy) {
  try {
    console.log(`Creating group: ${name}`);
    
    const groupData = {
      name,
      members: members.map(member => ({
        uid: member.uid,
        name: member.displayName,
        email: member.email,
        initials: member.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
      }))
    };

    // Create group via API
    const response = await apiRequest('/createDocument', 'POST', { 
      data: groupData 
    }, createdBy.token);

    console.log(`✓ Created group: ${name} (${response.id})`);
    return { id: response.id, ...groupData };
  } catch (error) {
    console.error(`✗ Failed to create group ${name}:`, error);
    throw error;
  }
}

async function createTestExpense(groupId, expense, participants, createdBy) {
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

    console.log(`✓ Created expense: ${expense.description} - $${expense.amount} (${response.id})`);
    return response;
  } catch (error) {
    console.error(`✗ Failed to create expense ${expense.description}:`, error);
    throw error;
  }
}

async function waitForApiReady() {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`⏳ Checking API readiness... (${attempts}/${maxAttempts})`);
      await apiRequest('/health', 'GET');
      return;
    } catch (error) {
      if (error.message.includes('Firebase Functions not ready yet')) {
        console.log('⏳ Functions not ready yet, waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      
      // For other errors (like 404 on /health), the API is ready but endpoint doesn't exist
      // This means functions are loaded
      if (!error.message.includes('Function us-central1-api does not exist')) {
        return;
      }
      
      console.log('⏳ Functions not ready yet, waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  throw new Error('API functions failed to become ready within timeout');
}

async function generateTestData() {
  try {
    console.log('🚀 Starting test data generation...\n');

    // Wait for API to be ready before proceeding
    console.log('⏳ Verifying API endpoints are ready...');
    await waitForApiReady();
    console.log('✓ API endpoints are ready\n');

    // Create test users
    console.log('📝 Creating test users...');
    const users = [];
    for (const userInfo of TEST_USERS) {
      const user = await createTestUser(userInfo);
      users.push(user);
    }
    console.log(`✓ Created ${users.length} users\n`);

    // Create test groups
    console.log('👥 Creating test groups...');
    
    // Group 1: All three users
    const group1 = await createTestGroup('group-1', users, users[0]);
    
    // Group 2: Test1 and Test2
    const group2 = await createTestGroup('group-2', [users[0], users[1]], users[0]);
    
    // Group 3: Test2 and Test3
    const group3 = await createTestGroup('group-3', [users[1], users[2]], users[1]);
    
    console.log(`✓ Created 3 groups\n`);

    // Create test expenses
    console.log('💰 Creating test expenses...');
    
    // Expenses for group 1 (all users)
    const group1Expenses = EXAMPLE_EXPENSES.slice(0, 4);
    for (const expense of group1Expenses) {
      const randomPayer = users[Math.floor(Math.random() * users.length)];
      await createTestExpense(group1.id, expense, users, randomPayer);
    }
    
    // Expenses for group 2 (test1 and test2)
    const group2Expenses = EXAMPLE_EXPENSES.slice(4, 7);
    for (const expense of group2Expenses) {
      const randomPayer = [users[0], users[1]][Math.floor(Math.random() * 2)];
      await createTestExpense(group2.id, expense, [users[0], users[1]], randomPayer);
    }
    
    // Expenses for group 3 (test2 and test3)
    const group3Expenses = EXAMPLE_EXPENSES.slice(7, 10);
    for (const expense of group3Expenses) {
      const randomPayer = [users[1], users[2]][Math.floor(Math.random() * 2)];
      await createTestExpense(group3.id, expense, [users[1], users[2]], randomPayer);
    }
    
    console.log(`✓ Created ${group1Expenses.length + group2Expenses.length + group3Expenses.length} expenses\n`);

    console.log('🎉 Test data generation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`• Users: ${users.length}`);
    console.log(`• Groups: 3`);
    console.log(`• Expenses: ${group1Expenses.length + group2Expenses.length + group3Expenses.length}`);
    
    console.log('\n🔑 Test Users:');
    TEST_USERS.forEach(user => {
      console.log(`• ${user.email} (${user.displayName}) - Password: ${user.password}`);
    });

    console.log('\n🔬 Creating circular debt scenario for debugging...');
    await createCircularDebtScenario(users);


  } catch (error) {
    console.error('❌ Test data generation failed:', error);
    process.exit(1);
  }
}

async function createCircularDebtScenario(users) {
  const groupName = 'simplify-test-group';
  const groupMembers = [users[0], users[1], users[2]];
  const group = await createTestGroup(groupName, groupMembers, users[0]);

  const expenseAmount = 100;

  // User 1 pays for User 2
  await createTestExpense(
    group.id,
    { description: 'U1 pays for U2', amount: expenseAmount, category: 'other' },
    [users[0], users[1]],
    users[0]
  );

  // User 2 pays for User 3
  await createTestExpense(
    group.id,
    { description: 'U2 pays for U3', amount: expenseAmount, category: 'other' },
    [users[1], users[2]],
    users[1]
  );

  // User 3 pays for User 1
  await createTestExpense(
    group.id,
    { description: 'U3 pays for U1', amount: expenseAmount, category: 'other' },
    [users[2], users[0]],
    users[2]
  );

  console.log(`✓ Created circular debt scenario in group: ${groupName}`);
}

// Run the script
if (require.main === module) {
  generateTestData().then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { generateTestData };
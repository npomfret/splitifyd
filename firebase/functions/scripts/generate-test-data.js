#!/usr/bin/env node

const admin = require('firebase-admin');

// Set emulator environment variables before initializing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize Firebase Admin for emulator
const app = admin.initializeApp({
  projectId: 'splitifyd'
});

// Connect to Firebase emulator
const auth = admin.auth();
const db = admin.firestore();

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

async function createTestUser(userInfo) {
  try {
    console.log(`Creating user: ${userInfo.email}`);
    
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: userInfo.email,
      password: userInfo.password,
      displayName: userInfo.displayName
    });

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: userInfo.email,
      displayName: userInfo.displayName,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`✓ Created user: ${userInfo.email} (${userRecord.uid})`);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log(`→ User already exists: ${userInfo.email}`);
      return await auth.getUserByEmail(userInfo.email);
    }
    throw error;
  }
}

async function createTestGroup(name, members, createdBy) {
  try {
    console.log(`Creating group: ${name}`);
    
    const now = new Date();
    const groupData = {
      name,
      members: members.map(member => ({
        uid: member.uid,
        name: member.displayName,
        email: member.email,
        initials: member.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
      })),
      createdBy: createdBy.uid,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
      yourBalance: 0,
      expenseCount: 0,
      lastExpenseTime: admin.firestore.Timestamp.fromDate(now),
      lastExpense: null
    };

    // Create group document in the documents collection
    const groupRef = await db.collection('documents').add({
      userId: createdBy.uid,
      data: groupData,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log(`✓ Created group: ${name} (${groupRef.id})`);
    return { id: groupRef.id, ...groupData };
  } catch (error) {
    console.error(`✗ Failed to create group ${name}:`, error);
    throw error;
  }
}

async function createTestExpense(groupId, expense, participants, createdBy) {
  try {
    const expenseData = {
      id: '', // Will be set by Firestore
      groupId,
      createdBy: createdBy.uid,
      paidBy: createdBy.uid,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      date: admin.firestore.Timestamp.fromDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date within last 30 days
      splitType: 'equal',
      participants: participants.map(p => p.uid),
      splits: participants.reduce((acc, participant) => {
        acc[participant.uid] = expense.amount / participants.length;
        return acc;
      }, {}),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const expenseRef = await db.collection('expenses').add(expenseData);
    
    // Update the expense with its ID
    await expenseRef.update({ id: expenseRef.id });

    console.log(`✓ Created expense: ${expense.description} - $${expense.amount} (${expenseRef.id})`);
    return { id: expenseRef.id, ...expenseData };
  } catch (error) {
    console.error(`✗ Failed to create expense ${expense.description}:`, error);
    throw error;
  }
}

async function generateTestData() {
  try {
    console.log('🚀 Starting test data generation...\n');

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

  } catch (error) {
    console.error('❌ Test data generation failed:', error);
    process.exit(1);
  }
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
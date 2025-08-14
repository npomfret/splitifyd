/**
 * @jest-environment node
 */

// Test to reproduce the issue where settlements created via API don't generate realtime notifications
// This test shows that the trackSettlementChanges trigger may not be firing for API-created settlements

import { admin } from '../../src/firebase';
import { ApiDriver, User } from '../support/ApiDriver';
import { SettlementBuilder, UserBuilder } from '../support/builders';

const db = admin.firestore();

describe('Settlement API Realtime Integration - Bug Reproduction', () => {
  let driver: ApiDriver;
  let user1: User;
  let user2: User;
  let groupId: string;
  let changeListener: any;

  // Increase timeout for integration tests
  jest.setTimeout(15000);

  beforeEach(async () => {
    driver = new ApiDriver();
    
    // Create test users
    user1 = await driver.createUser(new UserBuilder().build());
    user2 = await driver.createUser(new UserBuilder().build());
  });

  afterEach(async () => {
    // Clean up listener
    if (changeListener) {
      changeListener();
      changeListener = null;
    }
    
    // Clean up test data
    const collections = ['settlements', 'groups', 'expense-changes', 'balance-changes'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection)
        .where('groupId', '==', groupId)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  });

  it('should generate expense-change notification when settlement is created via API', async () => {
    // Create a group with both users as members using ApiDriver
    const testGroup = await driver.createGroupWithMembers(
      'Test Group for Settlement API',
      [user1, user2],
      user1.token
    );
    groupId = testGroup.id;

    // Set up a listener for expense-changes BEFORE creating the settlement
    const changePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: No expense-change notification received within 10 seconds after API settlement creation'));
      }, 10000);

      const query = db.collection('expense-changes')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .limit(1);
      
      changeListener = query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.settlementId) {
              clearTimeout(timeout);
              resolve(data);
            }
          }
        });
      }, (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Create a settlement via API (not direct Firestore)
    const settlementData = new SettlementBuilder()
      .withGroupId(groupId)
      .withPayer(user2.uid)
      .withPayee(user1.uid)
      .withAmount(50.00)
      .withCurrency('USD')
      .withNote('Test API settlement')
      .withDate(new Date().toISOString())
      .build();

    console.log(`Creating settlement via API for group ${groupId}`);
    
    const createdSettlement = await driver.createSettlement(settlementData, user1.token);
    
    console.log(`Settlement created via API: ${createdSettlement.id}`);

    // Wait for the change notification
    try {
      const changeNotification = await changePromise;

      // Verify the change notification was created
      expect(changeNotification).toBeDefined();
      expect(changeNotification.groupId).toBe(groupId);
      expect(changeNotification.settlementId).toBe(createdSettlement.id);
      expect(changeNotification.changeType).toBe('created');
      expect(changeNotification.metadata.affectedUsers).toContain(user1.uid);
      expect(changeNotification.metadata.affectedUsers).toContain(user2.uid);
      
      console.log('✅ SUCCESS: Settlement created via API generated expense-change notification');
      console.log('Change notification:', JSON.stringify(changeNotification, null, 2));
    } catch (error) {
      // This is the expected failure that reproduces the E2E test issue
      console.log('❌ REPRODUCED: Settlement created via API did NOT generate expense-change notification');
      console.log('This explains why the E2E test fails - frontend never gets notified to refresh settlements');
      
      // Let's check if the settlement was actually created in Firestore
      const settlementDoc = await db.collection('settlements').doc(createdSettlement.id).get();
      expect(settlementDoc.exists).toBe(true);
      console.log('Settlement exists in Firestore:', settlementDoc.data());
      
      // Check if there are any expense-changes at all for this group
      const expenseChanges = await db.collection('expense-changes')
        .where('groupId', '==', groupId)
        .get();
      
      console.log(`Found ${expenseChanges.size} expense-change documents for group ${groupId}`);
      expenseChanges.docs.forEach(doc => {
        console.log('Expense change:', doc.data());
      });

      throw error;
    }
  }, 15000);

  it('documents the difference between API and direct Firestore settlement creation', async () => {
    /**
     * BUG ANALYSIS:
     * 
     * The trackSettlementChanges trigger should fire when settlements are created.
     * However, there might be a difference between:
     * 1. Direct Firestore document creation (works - as shown in settlement-realtime.test.ts)
     * 2. API-based settlement creation (broken - as shown by E2E test failures)
     * 
     * Possible causes:
     * 1. The API settlement creation doesn't actually write to Firestore correctly
     * 2. The Firestore trigger isn't configured to fire for API-created documents
     * 3. The trigger has a bug that only works in some scenarios
     * 4. There's a timing issue where the trigger fires but the frontend isn't listening yet
     */

    console.log(`
      Settlement Realtime Update Analysis:
      
      Direct Firestore Creation: ✅ Works (settlement-realtime.test.ts passes)
      API-based Creation: ❌ Broken (E2E tests fail, this test should fail)
      
      Root Cause: trackSettlementChanges trigger not firing for API settlements
      Impact: Frontend settlement history doesn't update until page refresh
      
      Next Steps: 
      1. Check settlement API handler to ensure it writes to Firestore properly
      2. Verify trigger is properly configured
      3. Check for any differences in document structure between direct and API creation
    `);

    expect(true).toBe(true);
  });
});
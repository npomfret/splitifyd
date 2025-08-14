/**
 * @jest-environment node
 */

// Test to verify that settlements generate realtime update notifications
// This test documents a bug where the frontend doesn't refresh settlements

import { admin } from '../../src/firebase';

const db = admin.firestore();

describe('Settlement Realtime Updates - Bug Documentation', () => {
  let groupId: string;
  let userId1: string;
  let userId2: string;
  let changeListener: any;

  beforeEach(() => {
    // Generate test IDs
    groupId = 'test-group-' + Date.now();
    userId1 = 'test-user-1-' + Date.now();
    userId2 = 'test-user-2-' + Date.now();
  });

  afterEach(async () => {
    // Clean up listener
    if (changeListener) {
      changeListener();
      changeListener = null;
    }
    
    // Clean up test data
    const collections = ['settlements', 'expense-changes', 'balance-changes'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection)
        .where('groupId', '==', groupId)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  });

  it('should generate expense-change notification when settlement is created directly in Firestore', async () => {
    // Set up a listener for expense-changes BEFORE creating the settlement
    const changePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: No expense-change notification received within 5 seconds'));
      }, 5000);

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

    // Create a settlement directly in Firestore (simulating what the API does)
    const settlementData = {
      groupId: groupId,
      from: userId2,
      to: userId1,
      amount: 50.00,
      currency: 'USD',
      note: 'Test settlement for realtime',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: userId2
    };

    const settlementRef = await db.collection('settlements').add(settlementData);

    // Wait for the change notification
    try {
      const changeNotification = await changePromise;

      // Verify the change notification was created
      expect(changeNotification).toBeDefined();
      expect(changeNotification.groupId).toBe(groupId);
      expect(changeNotification.settlementId).toBe(settlementRef.id);
      expect(changeNotification.changeType).toBe('created');
      expect(changeNotification.metadata.affectedUsers).toContain(userId1);
      expect(changeNotification.metadata.affectedUsers).toContain(userId2);
    } catch (error) {
      // If this fails, it means the trackSettlementChanges trigger isn't working
      throw new Error(`Settlement change tracking failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 10000);

  it('should generate balance-change notification when settlement is created', async () => {
    // Set up a listener for balance-changes
    const changePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: No balance-change notification received within 5 seconds'));
      }, 5000);

      const query = db.collection('balance-changes')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .limit(1);
      
      changeListener = query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.metadata?.triggeredBy === 'settlement') {
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

    // Create a settlement
    const settlementData = {
      groupId: groupId,
      from: userId2,
      to: userId1,
      amount: 75.00,
      currency: 'USD',
      note: 'Test settlement for balance update',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: userId2
    };

    const settlementRef = await db.collection('settlements').add(settlementData);

    // Wait for the change notification
    try {
      const changeNotification = await changePromise;

      // Verify the balance change notification was created
      expect(changeNotification).toBeDefined();
      expect(changeNotification.groupId).toBe(groupId);
      expect(changeNotification.changeType).toBe('recalculated');
      expect(changeNotification.metadata.triggeredBy).toBe('settlement');
      expect(changeNotification.metadata.triggerId).toBe(settlementRef.id);
      expect(changeNotification.metadata.affectedUsers).toContain(userId1);
      expect(changeNotification.metadata.affectedUsers).toContain(userId2);
    } catch (error) {
      throw new Error(`Balance change tracking failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 10000);

  it('documents the frontend bug: refreshAll() does not fetch settlements', async () => {
    /**
     * BUG DOCUMENTATION:
     * 
     * The backend correctly creates change notifications when settlements are added.
     * However, the frontend has a bug:
     * 
     * 1. webapp-v2/src/app/stores/group-detail-store-enhanced.ts
     *    - Listens to expense-changes (line 104)
     *    - Calls refreshAll() when changes detected (line 117)
     * 
     * 2. refreshAll() method (around line 280)
     *    - Fetches expenses
     *    - Fetches balances
     *    - Fetches members
     *    - BUT DOES NOT FETCH SETTLEMENTS
     * 
     * 3. webapp-v2/src/components/settlements/SettlementHistory.tsx
     *    - Only loads settlements on mount (line 52)
     *    - Does not reload when expense-changes are detected
     * 
     * RESULT: New settlements don't appear in the UI until page is refreshed
     * 
     * FIX NEEDED:
     * - Add fetchSettlements() to refreshAll() in group-detail-store-enhanced.ts
     * - OR make SettlementHistory component reactive to changes
     */

    // This test just documents the issue
    expect(true).toBe(true);
    
    console.log(`
      Frontend Bug Identified:
      - Settlements generate realtime notifications correctly
      - Frontend receives the notifications
      - But refreshAll() doesn't fetch settlements
      - So SettlementHistory doesn't update
      
      This causes E2E test failures when checking for settlements in history
    `);
  });
});
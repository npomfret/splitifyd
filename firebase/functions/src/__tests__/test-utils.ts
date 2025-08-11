import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export const testUtils = {
  /**
   * Create a test user and return auth token and user ID
   */
  async createTestUser(): Promise<{ token: string; userId: string }> {
    const userId = `test-user-${uuidv4()}`;
    const email = `${userId}@test.com`;
    
    try {
      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        uid: userId,
        email: email,
        password: 'testPassword123!',
        displayName: 'Test User'
      });

      // Create custom token for testing
      const token = await admin.auth().createCustomToken(userId);
      
      // Create user document in Firestore
      await admin.firestore().collection('users').doc(userId).set({
        email: email,
        displayName: 'Test User',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      return { token, userId: userRecord.uid };
    } catch (error) {
      console.error('Error creating test user:', error);
      throw error;
    }
  },

  /**
   * Clean up test data after tests
   */
  async cleanupTestData(userId?: string, groupId?: string): Promise<void> {
    const db = admin.firestore();
    const batch = db.batch();

    try {
      // Delete test expenses
      if (groupId) {
        const expenses = await db.collection('expenses')
          .where('groupId', '==', groupId)
          .get();
        
        expenses.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Delete test settlements
        const settlements = await db.collection('settlements')
          .where('groupId', '==', groupId)
          .get();
        
        settlements.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Delete test group
        batch.delete(db.collection('groups').doc(groupId));
      }

      // Delete test user
      if (userId) {
        batch.delete(db.collection('users').doc(userId));
        
        // Delete from Firebase Auth
        try {
          await admin.auth().deleteUser(userId);
        } catch (error) {
          // User might not exist in Auth
          console.log('User not found in Auth, skipping deletion');
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      // Don't throw - cleanup should not fail tests
    }
  },

  /**
   * Create a test group
   */
  async createTestGroup(userId: string, name?: string): Promise<string> {
    const groupId = `test-group-${uuidv4()}`;
    const groupData = {
      id: groupId,
      name: name || 'Test Group',
      description: 'Test group for integration tests',
      createdBy: userId,
      memberIds: [userId],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await admin.firestore().collection('groups').doc(groupId).set({
      data: groupData,
      createdAt: groupData.createdAt,
      updatedAt: groupData.updatedAt
    });

    return groupId;
  },

  /**
   * Wait for async operations to complete
   */
  async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate test date within valid range
   */
  generateValidTestDate(daysAgo: number = 0): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  },

  /**
   * Verify Firestore timestamp
   */
  isFirestoreTimestamp(value: any): boolean {
    return value instanceof admin.firestore.Timestamp;
  }
};
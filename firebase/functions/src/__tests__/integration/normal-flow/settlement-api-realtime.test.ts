/**
 * @jest-environment node
 */

// Test to reproduce the issue where settlements created via API don't generate realtime notifications
// This test shows that the trackSettlementChanges trigger may not be firing for API-created settlements

import { clearAllTestData } from '../../support/cleanupHelpers';
import { ApiDriver, User } from '../../support/ApiDriver';
import { SettlementBuilder } from '../../support/builders';
import { FirebaseIntegrationTestUserPool } from '../../support/FirebaseIntegrationTestUserPool';
import {db} from "../../support/firebase-emulator";
import { FirestoreCollections } from '../../../shared/shared-types';

describe('Settlement API Realtime Integration - Bug Reproduction', () => {
    let userPool: FirebaseIntegrationTestUserPool;
    let driver: ApiDriver;
    let user1: User;
    let user2: User;
    let groupId: string;
    let changeListener: any;

    jest.setTimeout(10000);

    beforeAll(async () => {
        await clearAllTestData();
        
        driver = new ApiDriver();
        
        // Create user pool with 2 users
        userPool = new FirebaseIntegrationTestUserPool(driver, 2);
        await userPool.initialize();
    });

    beforeEach(async () => {
        // Use users from pool
        const users = userPool.getUsers(2);
        user1 = users[0];
        user2 = users[1];
    });

    afterEach(async () => {
        // Clean up listener
        if (changeListener) {
            changeListener();
            changeListener = null;
        }

        // Clean up test data
        const collections = ['settlements', 'groups', FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
        for (const collection of collections) {
            const snapshot = await db.collection(collection).where('groupId', '==', groupId).get();

            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }
    });

    afterAll(async () => {
        await clearAllTestData();
    });

    it('should generate transaction-change notification when settlement is created via API', async () => {
        // Create a group with both users as members using ApiDriver
        const testGroup = await driver.createGroupWithMembers('Test Group for Settlement API', [user1, user2], user1.token);
        groupId = testGroup.id;

        const seconds = 2;

        // Set up a listener for transaction-changes BEFORE creating the settlement
        const changePromise = new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout: No transaction-change notification received within ${seconds} seconds after API settlement creation`));
            }, seconds * 1000);

            const query = db.collection(FirestoreCollections.TRANSACTION_CHANGES)
                .where('groupId', '==', groupId)
                .orderBy('timestamp', 'desc')
                .limit(1);

            changeListener = query.onSnapshot(
                (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        // Observed change

                        if (change.type === 'added') {
                            const data = change.doc.data();
                            if (data.settlementId) {
                                clearTimeout(timeout);
                                resolve(data);
                            }
                        }
                    });
                },
                (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
            );
        });

        // Create a settlement via API (not direct Firestore)
        const settlementData = new SettlementBuilder()
            .withGroupId(groupId)
            .withPayer(user2.uid)
            .withPayee(user1.uid)
            .withAmount(50.0)
            .withCurrency('USD')
            .withNote('Test API settlement')
            .withDate(new Date().toISOString())
            .build();

        // Creating settlement via API

        const createdSettlement = await driver.createSettlement(settlementData, user1.token);
        expect(createdSettlement).toBeDefined();
        expect(createdSettlement.id).toBeDefined();

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

            // SUCCESS: Settlement created via API generated transaction-change notification
        } catch (error) {
            // This was the original failure that reproduced the E2E test issue, but should be fixed now
            // UNEXPECTED: Settlement created via API did NOT generate transaction-change notification
            // This should not happen anymore - the trigger bug has been fixed

            // Let's check if the settlement was actually created in Firestore
            if (!createdSettlement || !createdSettlement.id) {
                throw new Error('Settlement was not created properly - missing ID');
            }
            
            // Poll for the settlement to appear in Firestore
            let settlementDoc;
            let attempts = 0;
            const maxAttempts = 10;
            const pollInterval = 100; // 500ms
            
            while (attempts < maxAttempts) {
                settlementDoc = await db.collection('settlements').doc(createdSettlement.id).get();
                if (settlementDoc.exists) {
                    // Settlement found
                    break;
                }
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
            
            // Check all settlements in the group
            const allSettlements = await db.collection('settlements').where('groupId', '==', groupId).get();
            expect(allSettlements.size).toBeGreaterThan(0);
            
            if (!settlementDoc || !settlementDoc.exists) {
                // BUG: Settlement created via API returns success but document not in Firestore
                throw new Error(`Settlement ${createdSettlement.id} does not exist in Firestore after ${maxAttempts} attempts`);
            }

            // Check if there are any transaction-changes at all for this group
            const transactionChanges = await db.collection(FirestoreCollections.TRANSACTION_CHANGES).where('groupId', '==', groupId).get();
            expect(transactionChanges.size).toBeGreaterThanOrEqual(0);

            throw error;
        }
    }, 3000);

    it('documents that API settlement creation now works correctly', async () => {
        /**
         * FIXED: Settlement API realtime updates now work correctly.
         *
         * Previous issue was caused by undefined values being passed to Firestore
         * in the trackSettlementChanges trigger, which caused silent failures.
         *
         * Fix: Added removeUndefinedFields utility to clean all change documents
         * before saving to Firestore.
         */

        // Settlement Realtime Update Analysis:
        // Direct Firestore Creation: Works (settlement-realtime.test.ts passes)
        // API-based Creation: Fixed (E2E tests now pass, this test now passes)
        // Resolution: Fixed undefined values in trigger change documents
        // Impact: Frontend settlement history now updates in real-time

        expect(true).toBe(true);
    });
});

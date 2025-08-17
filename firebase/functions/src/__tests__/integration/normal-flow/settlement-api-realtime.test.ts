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
        const collections = ['settlements', 'groups', 'transaction-changes', 'balance-changes'];
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

            const query = db.collection('transaction-changes')
                .where('groupId', '==', groupId)
                .orderBy('timestamp', 'desc')
                .limit(1);

            changeListener = query.onSnapshot(
                (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        console.log(`observed change:`, JSON.stringify(change));

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

        console.log(`Creating settlement via API for group ${groupId}`);

        const createdSettlement = await driver.createSettlement(settlementData, user1.token);
        expect(createdSettlement).toBeDefined();
        expect(createdSettlement.id).toBeDefined();
        console.log('API response:', JSON.stringify(createdSettlement, null, 2));
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

            console.log('✅ SUCCESS: Settlement created via API generated transaction-change notification');
            console.log('Change notification:', JSON.stringify(changeNotification, null, 2));
        } catch (error) {
            // This is the expected failure that reproduces the E2E test issue
            console.log('❌ REPRODUCED: Settlement created via API did NOT generate transaction-change notification');
            console.log('This explains why the E2E test fails - frontend never gets notified to refresh settlements');

            // Let's check if the settlement was actually created in Firestore
            if (!createdSettlement || !createdSettlement.id) {
                console.log('Settlement response is invalid:', createdSettlement);
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
                    console.log(`Settlement found after ${attempts + 1} attempts`);
                    break;
                }
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
            
            // Check all settlements in the group
            const allSettlements = await db.collection('settlements').where('groupId', '==', groupId).get();
            console.log(`Found ${allSettlements.size} settlements in group ${groupId}`);
            allSettlements.docs.forEach(doc => {
                console.log(`Settlement ${doc.id}:`, doc.data());
            });
            
            if (!settlementDoc || !settlementDoc.exists) {
                console.log(`Settlement ${createdSettlement.id} does not exist in Firestore after ${maxAttempts} attempts!`);
                console.log('API returned settlement:', createdSettlement);
                
                // This is the actual bug - the API says it created the settlement but it's not in Firestore
                console.log('⚠️ BUG FOUND: Settlement created via API returns success but document not in Firestore');
            } else {
                console.log('Settlement exists in Firestore:', settlementDoc.data());
            }

            // Check if there are any transaction-changes at all for this group
            const transactionChanges = await db.collection('transaction-changes').where('groupId', '==', groupId).get();

            console.log(`Found ${transactionChanges.size} transaction-change documents for group ${groupId}`);
            transactionChanges.docs.forEach((doc) => {
                console.log('Transaction change:', doc.data());
            });

            throw error;
        }
    }, 4000);

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

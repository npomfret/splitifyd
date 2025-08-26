/**
 * @jest-environment node
 */

// Test to verify that settlements generate realtime update notifications
// This test documents a bug where the frontend doesn't refresh settlements

import * as admin from 'firebase-admin';
import { FirestoreCollections } from '@splitifyd/shared';
import { ApiDriver } from '@splitifyd/test-support';
import { SettlementBuilder } from '@splitifyd/test-support';
import { randomUUID } from 'crypto';
import {firestoreDb} from "../../../firebase";

describe('Settlement Realtime Updates - Bug Documentation', () => {
    let driver: ApiDriver;
    
    beforeAll(async () => {
        driver = new ApiDriver();
    });
    let groupId: string;
    let userId1: string;
    let userId2: string;

    beforeEach(() => {
        // Generate test IDs using UUID for better uniqueness
        const testId = randomUUID().substring(0, 8); // Use short UUID for readability
        groupId = `test-group-${testId}`;
        userId1 = `test-user-1-${testId}`;
        userId2 = `test-user-2-${testId}`;
    });

    afterEach(async () => {
        // Clean up test data
        if (groupId) {
            const collections = ['settlements', FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
            for (const collection of collections) {
                const snapshot = await firestoreDb.collection(collection).where('groupId', '==', groupId).get();

                const batch = firestoreDb.batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
            }
        }
    });


    it('should generate transaction-change notification when settlement is created directly in Firestore', async () => {
        // Create a settlement directly in Firestore (simulating what the API does)
        const settlementData = {
            ...new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(userId2)
                .withPayee(userId1)
                .build(),
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: userId2,
        };

        const settlementRef = await firestoreDb.collection('settlements').add(settlementData);

        // Wait for settlement change notification using ApiDriver
        await driver.waitForSettlementChanges(groupId, (changes) => {
            return changes.some(change => 
                change.id === settlementRef.id &&
                change.action === 'created' &&
                change.type === 'settlement' &&
                change.users.includes(userId1) &&
                change.users.includes(userId2)
            );
        }, 5000);
        
        // Get the change notification for verification
        const allChanges = await driver.getSettlementChanges(groupId);
        const changeNotification = allChanges.find(change => change.id === settlementRef.id);

        // Verify the change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification!.groupId).toBe(groupId);
        expect(changeNotification!.id).toBe(settlementRef.id);
        expect(changeNotification!.type).toBe('settlement');
        expect(changeNotification!.action).toBe('created');
        expect(changeNotification!.users).toContain(userId1);
        expect(changeNotification!.users).toContain(userId2);
    }, 10000);  // Test timeout

    it('should generate balance-change notification when settlement is created', async () => {
        // Create a settlement
        const settlementData = {
            ...new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(userId2)
                .withPayee(userId1)
                .build(),
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: userId2,
        };

        await firestoreDb.collection('settlements').add(settlementData);

        // Wait for balance change notification using ApiDriver
        await driver.waitForBalanceChanges(groupId, (changes) => {
            return changes.some(change => 
                change.groupId === groupId &&
                change.action === 'recalculated' &&
                change.type === 'balance' &&
                change.users.includes(userId1) &&
                change.users.includes(userId2)
            );
        }, 5000);
        
        // Get the change notification for verification
        const allChanges = await driver.getBalanceChanges(groupId);
        const changeNotification = allChanges.find(change => 
            change.users.includes(userId1) && change.users.includes(userId2)
        );

        // Verify the balance change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification!.groupId).toBe(groupId);
        expect(changeNotification!.type).toBe('balance');
        expect(changeNotification!.action).toBe('recalculated');
        expect(changeNotification!.users).toContain(userId1);
        expect(changeNotification!.users).toContain(userId2);
    }, 10000);  // Test timeout

    it('documents the frontend bug: refreshAll() does not fetch settlements', async () => {
        /**
         * BUG DOCUMENTATION:
         *
         * The backend correctly creates change notifications when settlements are added.
         * However, the frontend has a bug:
         *
         * 1. webapp-v2/src/app/stores/group-detail-store-enhanced.ts
         *    - Listens to transaction-changes (line 104)
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
         *    - Does not reload when transaction-changes are detected
         *
         * RESULT: New settlements don't appear in the UI until page is refreshed
         *
         * FIX NEEDED:
         * - Add fetchSettlements() to refreshAll() in group-detail-store-enhanced.ts
         * - OR make SettlementHistory component reactive to changes
         */

        // This test just documents the issue
        expect(true).toBe(true);

        // Frontend Bug Identified:
        // - Settlements generate realtime notifications correctly
        // - Frontend receives the notifications
        // - But refreshAll() doesn't fetch settlements
        // - So SettlementHistory doesn't update
        // This causes E2E test failures when checking for settlements in history
    });
});

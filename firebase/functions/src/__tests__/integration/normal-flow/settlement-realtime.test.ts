/**
 * @jest-environment node
 */

// Test to verify that settlements generate realtime update notifications
// This test documents a bug where the frontend doesn't refresh settlements

import * as admin from 'firebase-admin';
import { clearAllTestData } from '../../support/cleanupHelpers';
import {db} from "../../support/firebase-emulator";
import { FirestoreCollections } from '../../../shared/shared-types';
import { pollForChange } from '../../support/changeCollectionHelpers';

describe('Settlement Realtime Updates - Bug Documentation', () => {
    beforeAll(async () => {
        await clearAllTestData();
    });
    let groupId: string;
    let userId1: string;
    let userId2: string;

    beforeEach(() => {
        // Generate test IDs
        groupId = 'test-group-' + Date.now();
        userId1 = 'test-user-1-' + Date.now();
        userId2 = 'test-user-2-' + Date.now();
    });

    afterEach(async () => {
        // Clean up test data
        if (groupId) {
            const collections = ['settlements', FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
            for (const collection of collections) {
                const snapshot = await db.collection(collection).where('groupId', '==', groupId).get();

                const batch = db.batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
            }
        }
    });

    afterAll(async () => {
        await clearAllTestData();
    });

    it('should generate transaction-change notification when settlement is created directly in Firestore', async () => {
        // Create a settlement directly in Firestore (simulating what the API does)
        const settlementData = {
            groupId: groupId,
            from: userId2,
            to: userId1,
            amount: 50.0,
            currency: 'USD',
            note: 'Test settlement for realtime',
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: userId2,
        };

        const settlementRef = await db.collection('settlements').add(settlementData);

        // Poll for the change notification
        const changeNotification = await pollForChange(
            FirestoreCollections.TRANSACTION_CHANGES,
            (doc: any) => doc.groupId === groupId && 
                         doc.id === settlementRef.id && 
                         doc.type === 'settlement' &&
                         doc.action === 'created',
            { timeout: 5000, groupId }
        );

        // Verify the change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification.groupId).toBe(groupId);
        expect(changeNotification.id).toBe(settlementRef.id);
        expect(changeNotification.type).toBe('settlement');
        expect(changeNotification.action).toBe('created');
        expect(changeNotification.users).toContain(userId1);
        expect(changeNotification.users).toContain(userId2);
    }, 10000);

    it('should generate balance-change notification when settlement is created', async () => {
        // Create a settlement
        const settlementData = {
            groupId: groupId,
            from: userId2,
            to: userId1,
            amount: 75.0,
            currency: 'USD',
            note: 'Test settlement for balance update',
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: userId2,
        };

        await db.collection('settlements').add(settlementData);

        // Poll for the balance change notification
        const changeNotification = await pollForChange(
            FirestoreCollections.BALANCE_CHANGES,
            (doc: any) => doc.groupId === groupId && 
                         doc.type === 'balance' &&
                         doc.action === 'recalculated',
            { timeout: 5000, groupId }
        );

        // Verify the balance change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification.groupId).toBe(groupId);
        expect(changeNotification.type).toBe('balance');
        expect(changeNotification.action).toBe('recalculated');
        expect(changeNotification.users).toContain(userId1);
        expect(changeNotification.users).toContain(userId2);
    }, 10000);

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

// Test to verify that settlements generate realtime update notifications
// This test documents a bug where the frontend doesn't refresh settlements

import { afterEach, beforeEach, describe, expect, it } from 'vitest';


import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections } from '@splitifyd/shared';
import {ApiDriver, AppDriver} from '@splitifyd/test-support';
import { SettlementBuilder } from '@splitifyd/test-support';
import { randomUUID } from 'crypto';
import {getFirestore} from '../../../firebase';

describe('Settlement Realtime Updates - Bug Documentation', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

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
                const snapshot = await getFirestore().collection(collection).where('groupId', '==', groupId).get();

                const batch = getFirestore().batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
            }
        }
    });

    it('should generate transaction-change notification when settlement is created directly in Firestore', async () => {
        // Create a settlement directly in Firestore (simulating what the API does)
        const settlementData = {
            ...new SettlementBuilder().withGroupId(groupId).withPayer(userId2).withPayee(userId1).build(),
            createdAt: Timestamp.now(),
            createdBy: userId2,
        };

        const settlementRef = await getFirestore().collection('settlements').add(settlementData);

        // Wait for settlement change notification using ApiDriver
        await appDriver.waitForSettlementChanges(
            groupId,
            (changes) => {
                return changes.some(
                    (change) => change.id === settlementRef.id && change.action === 'created' && change.type === 'settlement' && change.users.includes(userId1) && change.users.includes(userId2),
                );
            },
            5000,
        );

        // Get the change notification for verification
        const allChanges = await appDriver.getSettlementChanges(groupId);
        const changeNotification = allChanges.find((change) => change.id === settlementRef.id);

        // Verify the change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification!.groupId).toBe(groupId);
        expect(changeNotification!.id).toBe(settlementRef.id);
        expect(changeNotification!.type).toBe('settlement');
        expect(changeNotification!.action).toBe('created');
        expect(changeNotification!.users).toContain(userId1);
        expect(changeNotification!.users).toContain(userId2);
    }, 10000); // Test timeout

    it('should generate balance-change notification when settlement is created', async () => {
        // Create a settlement
        const settlementData = {
            ...new SettlementBuilder().withGroupId(groupId).withPayer(userId2).withPayee(userId1).build(),
            createdAt: Timestamp.now(),
            createdBy: userId2,
        };

        await getFirestore().collection('settlements').add(settlementData);

        // Wait for balance change notification using ApiDriver
        await appDriver.waitForBalanceChanges(
            groupId,
            (changes) => {
                return changes.some(
                    (change) => change.groupId === groupId && change.action === 'recalculated' && change.type === 'balance' && change.users.includes(userId1) && change.users.includes(userId2),
                );
            },
            5000,
        );

        // Get the change notification for verification
        const allChanges = await appDriver.getBalanceChanges(groupId);
        const changeNotification = allChanges.find((change) => change.users.includes(userId1) && change.users.includes(userId2));

        // Verify the balance change notification was created
        expect(changeNotification).toBeTruthy();
        expect(changeNotification!.groupId).toBe(groupId);
        expect(changeNotification!.type).toBe('balance');
        expect(changeNotification!.action).toBe('recalculated');
        expect(changeNotification!.users).toContain(userId1);
        expect(changeNotification!.users).toContain(userId2);
    }, 10000); // Test timeout

});

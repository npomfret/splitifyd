// Test to reproduce the issue where settlements created via API don't generate realtime notifications
// This test shows that the trackSettlementChanges trigger may not be firing for API-created settlements

import {beforeEach, describe, expect, it} from 'vitest';
import {ApiDriver, AppDriver, SettlementBuilder, borrowTestUsers, TestGroupManager} from '@splitifyd/test-support';
import {firestoreDb} from '../../../firebase';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Settlement API Realtime Integration - Bug Reproduction', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, firestoreDb);

    let user1: AuthenticatedFirebaseUser;
    let user2: AuthenticatedFirebaseUser;
    let groupId: string;

    beforeEach(async () => {
        [user1, user2] = await borrowTestUsers(2); // Automatic cleanup after each test!
    });

    it('should generate transaction-change notification when settlement is created via API', async () => {
        // Use shared group for realtime testing
        const testGroup = await TestGroupManager.getOrCreateGroup([user1, user2], { memberCount: 2 });
        groupId = testGroup.id;

        // Create a settlement via API (not direct Firestore)
        const uniqueNote = `Realtime test settlement ${Date.now()}`;
        const settlementData = new SettlementBuilder().withGroupId(groupId).withPayer(user2.uid).withPayee(user1.uid).withNote(uniqueNote).build();

        const createdSettlement = await apiDriver.createSettlement(settlementData, user1.token);
        expect(createdSettlement).toBeDefined();
        expect(createdSettlement.id).toBeDefined();

        // Wait for settlement creation event
        await appDriver.waitForSettlementCreationEvent(groupId, createdSettlement.id, [user1, user2]);

        // Verify the change by getting the most recent settlement change event
        const changeNotification = await appDriver.mostRecentSettlementChangeEvent(groupId);
        expect(changeNotification).toBeTruthy();
        expect(changeNotification!.groupId).toBe(groupId);
        expect(changeNotification!.id).toBe(createdSettlement.id);
        expect(changeNotification!.type).toBe('settlement');
        expect(changeNotification!.action).toBe('created');
        expect(changeNotification!.users).toContain(user1.uid);
        expect(changeNotification!.users).toContain(user2.uid);
    }, 20000); // Increased test timeout

});

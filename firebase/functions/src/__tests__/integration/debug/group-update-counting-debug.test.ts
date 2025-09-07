// Debug test to understand group update counting behavior

import { beforeEach, describe, expect, test } from 'vitest';
import { borrowTestUsers } from '@splitifyd/test-support/test-pool-helpers';
import { ApiDriver, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { AuthenticatedFirebaseUser } from "@splitifyd/shared";
import { getFirestore } from '../../../firebase';

describe('Group Update Counting Debug', () => {
    const apiDriver = new ApiDriver();
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(1);
    });

    test('debug group creation and updates', async () => {
        console.log('🔍 DEBUGGING GROUP UPDATE COUNTING');

        // Create group
        console.log('📝 Creating group...');
        const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
        
        // Wait a bit for triggers to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check notification document after creation
        let notificationDoc = await getFirestore()
            .doc(`user-notifications/${users[0].uid}`)
            .get();
        
        if (!notificationDoc.exists) {
            console.log('❌ No notification document found after group creation');
            return;
        }
        
        const afterCreation = notificationDoc.data()!.groups[group.id];
        console.log('📊 After group creation:', {
            groupDetailsChangeCount: afterCreation?.groupDetailsChangeCount || 0,
            changeVersion: notificationDoc.data()!.changeVersion,
            groupExists: !!afterCreation
        });

        // Make first update
        console.log('🔄 Making first update...');
        await apiDriver.updateGroup(group.id, { name: 'Update 1' }, users[0].token);
        
        // Wait for triggers
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        notificationDoc = await getFirestore()
            .doc(`user-notifications/${users[0].uid}`)
            .get();
        
        const afterFirstUpdate = notificationDoc.data()!.groups[group.id];
        console.log('📊 After first update:', {
            groupDetailsChangeCount: afterFirstUpdate?.groupDetailsChangeCount || 0,
            changeVersion: notificationDoc.data()!.changeVersion
        });

        // Make second update  
        console.log('🔄 Making second update...');
        await apiDriver.updateGroup(group.id, { name: 'Update 2' }, users[0].token);
        
        // Wait for triggers
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        notificationDoc = await getFirestore()
            .doc(`user-notifications/${users[0].uid}`)
            .get();
        
        const afterSecondUpdate = notificationDoc.data()!.groups[group.id];
        console.log('📊 After second update:', {
            groupDetailsChangeCount: afterSecondUpdate?.groupDetailsChangeCount || 0,
            changeVersion: notificationDoc.data()!.changeVersion
        });

        // Make third update
        console.log('🔄 Making third update...');
        await apiDriver.updateGroup(group.id, { name: 'Update 3' }, users[0].token);
        
        // Wait for triggers
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        notificationDoc = await getFirestore()
            .doc(`user-notifications/${users[0].uid}`)
            .get();
        
        const afterThirdUpdate = notificationDoc.data()!.groups[group.id];
        console.log('📊 After third update:', {
            groupDetailsChangeCount: afterThirdUpdate?.groupDetailsChangeCount || 0,
            changeVersion: notificationDoc.data()!.changeVersion
        });

        console.log('🎯 SUMMARY:');
        console.log(`  Initial: ${afterCreation?.groupDetailsChangeCount || 0}`);
        console.log(`  After update 1: ${afterFirstUpdate?.groupDetailsChangeCount || 0}`);
        console.log(`  After update 2: ${afterSecondUpdate?.groupDetailsChangeCount || 0}`);
        console.log(`  After update 3: ${afterThirdUpdate?.groupDetailsChangeCount || 0}`);

        // This test is for debugging only - don't assert anything
        expect(true).toBe(true);
    }, 20000);
});
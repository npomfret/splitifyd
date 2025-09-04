// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { borrowTestUsers } from '@splitifyd/test-support/test-pool-helpers';
import { ApiDriver, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { AuthenticatedFirebaseUser, FirestoreCollections } from "@splitifyd/shared";
import { firestoreDb } from '../../../../firebase';
import { Timestamp } from 'firebase-admin/firestore';

describe('Group Deletion Real-Time Updates', () => {
    const apiDriver = new ApiDriver();
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
    });

    test('should create change document for group deletion with proper member IDs', async () => {
        // Create a group with 2 members
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Realtime Test ${uuidv4()}`)
            .withDescription('Testing real-time group deletion')
            .build();
        
        const group = await apiDriver.createGroup(groupData, users[0].token);
        
        // Add second user to the group
        const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

        // Verify 2 members before deletion
        const { members } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
        expect(members.members.length).toBe(2);

        // Subscribe to group changes to monitor real-time updates
        const changeDocumentsBefore = await firestoreDb
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', group.id)
            .get();
        
        console.log('Change documents before deletion:', changeDocumentsBefore.size);

        // Delete the group
        await apiDriver.deleteGroup(group.id, users[0].token);

        // Check for change document creation
        const changeDocumentsAfter = await firestoreDb
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', group.id)
            .get();
        
        console.log('Change documents after deletion:', changeDocumentsAfter.size);
        
        // The bug: Since we delete ALL group changes and then create a new one,
        // there should be exactly 1 change document (the deletion one)
        // But if bulk deletion happens after change doc creation, we might have 0
        if (changeDocumentsAfter.size === 0) {
            console.log('BUG REPRODUCED: No change documents found after deletion');
            console.log('This means the change document was deleted by bulk deletion');
        }

        // Look for the deletion change document specifically
        const deletionChangeDoc = changeDocumentsAfter.docs.find((doc: any) => {
            const data = doc.data();
            return data.action === 'deleted' && data.type === 'group';
        });

        if (deletionChangeDoc) {
            const changeData = deletionChangeDoc.data();
            console.log('Found deletion change document:', changeData);
            
            // Verify it has proper member IDs
            expect(changeData.users).toContain(users[0].uid);
            expect(changeData.users).toContain(users[1].uid);
            expect(changeData.users).toHaveLength(2);
            expect(changeData.action).toBe('deleted');
            expect(changeData.type).toBe('group');
            expect(changeData.id).toBe(group.id);
        } else {
            console.log('BUG CONFIRMED: No deletion change document found');
            console.log('This explains why dashboard real-time updates are not working');
            
            // This is the bug - we should have a deletion change document
            expect(deletionChangeDoc).toBeDefined();
        }

        // Verify the group is actually deleted
        await expect(apiDriver.getGroupFullDetails(group.id, users[0].token))
            .rejects.toThrow(/404|not found/i);
    });

    test('should create change document BEFORE bulk deletion to avoid race condition', async () => {
        // Create a simple group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Race Condition Test ${uuidv4()}`)
            .build();
        
        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Monitor the timing of change document creation vs deletion
        const startTime = Date.now();
        
        // Delete the group
        await apiDriver.deleteGroup(group.id, users[0].token);
        
        const endTime = Date.now();
        console.log(`Group deletion took ${endTime - startTime}ms`);

        // Check if any change documents exist for this group
        const changeDocuments = await firestoreDb
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', group.id)
            .get();
        
        console.log(`Found ${changeDocuments.size} change documents after deletion`);
        
        // The fix should ensure at least one change document exists for deletion
        expect(changeDocuments.size).toBeGreaterThan(0);
        
        const deletionDoc = changeDocuments.docs.find((doc: any) => 
            doc.data().action === 'deleted'
        );
        
        expect(deletionDoc).toBeDefined();
        expect(deletionDoc!.data().type).toBe('group');
        expect(deletionDoc!.data().id).toBe(group.id);
    });

    test('should preserve deletion change document even when all other group changes are deleted', async () => {
        // Create a group - change documents are only created by Firestore triggers in production
        // but our emulator setup might not have these triggers, so we'll manually create a change doc
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Change Preservation Test ${uuidv4()}`)
            .build();
        
        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Manually create a change document to simulate existing changes
        await firestoreDb.collection(FirestoreCollections.GROUP_CHANGES).add({
            id: group.id,
            type: 'group',
            action: 'updated',
            timestamp: Timestamp.now(),
            users: [users[0].uid]
        });

        // Verify we have change documents before deletion
        const changesBefore = await firestoreDb
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', group.id)
            .get();
        
        console.log(`Found ${changesBefore.size} change documents before deletion`);
        expect(changesBefore.size).toBeGreaterThan(0);

        // Delete the group - this should delete old changes but create a new deletion change
        await apiDriver.deleteGroup(group.id, users[0].token);

        // Check remaining change documents
        const changesAfter = await firestoreDb
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', group.id)
            .get();
        
        console.log(`Found ${changesAfter.size} change documents after deletion`);
        
        // We should have exactly 1 change document: the deletion one
        expect(changesAfter.size).toBe(1);
        
        const deletionDoc = changesAfter.docs[0];
        expect(deletionDoc.data().action).toBe('deleted');
        expect(deletionDoc.data().type).toBe('group');
    });
});
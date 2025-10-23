/**
 * Archive Groups Feature Unit Tests
 *
 * Tests for:
 * - FirestoreReader status filtering (getGroupsForUserV2)
 * - GroupMemberService archive/unarchive methods
 */

import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { MemberStatuses } from '@splitifyd/shared';
import { beforeEach, describe, expect, test } from 'vitest';
import { FirestoreReader } from '../../services/firestore/FirestoreReader';
import { FirestoreWriter } from '../../services/firestore/FirestoreWriter';
import { GroupMemberService } from '../../services/GroupMemberService';

describe('Archive Groups - FirestoreReader Status Filtering', () => {
    let db: StubFirestoreDatabase;
    let reader: FirestoreReader;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        reader = new FirestoreReader(db);
    });

    test('should filter by ACTIVE status by default', async () => {
        const userId = 'user123';
        const groupId1 = 'group1';
        const groupId2 = 'group2';
        const groupId3 = 'group3';

        // Create groups
        db.seedGroup(groupId1, { name: 'Active Group', createdBy: userId });
        db.seedGroup(groupId2, { name: 'Archived Group', createdBy: userId });
        db.seedGroup(groupId3, { name: 'Pending Group', createdBy: userId });

        // Create memberships with different statuses
        const activeMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId1)
            .withUserId(userId)
            .withStatus('active')
            .buildDocument();
        db.seedGroupMember(groupId1, userId, activeMember);

        const archivedMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId2)
            .withUserId(userId)
            .withStatus('archived')
            .buildDocument();
        db.seedGroupMember(groupId2, userId, archivedMember);

        const pendingMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId3)
            .withUserId(userId)
            .withStatus('pending')
            .buildDocument();
        db.seedGroupMember(groupId3, userId, pendingMember);

        // Default: should only return ACTIVE groups
        const result = await reader.getGroupsForUserV2(userId);

        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(groupId1);
    });

    test('should filter by ARCHIVED status when specified', async () => {
        const userId = 'user123';
        const groupId1 = 'group1';
        const groupId2 = 'group2';

        // Create groups
        db.seedGroup(groupId1, { name: 'Active Group', createdBy: userId });
        db.seedGroup(groupId2, { name: 'Archived Group', createdBy: userId });

        // Create memberships
        const activeMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId1)
            .withUserId(userId)
            .withStatus('active')
            .buildDocument();
        db.seedGroupMember(groupId1, userId, activeMember);

        const archivedMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId2)
            .withUserId(userId)
            .withStatus('archived')
            .buildDocument();
        db.seedGroupMember(groupId2, userId, archivedMember);

        // Filter by ARCHIVED
        const result = await reader.getGroupsForUserV2(userId, {
            statusFilter: MemberStatuses.ARCHIVED,
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(groupId2);
    });

    test('should filter by array of statuses', async () => {
        const userId = 'user123';
        const groupId1 = 'group1';
        const groupId2 = 'group2';
        const groupId3 = 'group3';

        // Create groups
        db.seedGroup(groupId1, { name: 'Active Group', createdBy: userId });
        db.seedGroup(groupId2, { name: 'Archived Group', createdBy: userId });
        db.seedGroup(groupId3, { name: 'Pending Group', createdBy: userId });

        // Create memberships with different statuses
        const activeMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId1)
            .withUserId(userId)
            .withStatus('active')
            .buildDocument();
        db.seedGroupMember(groupId1, userId, activeMember);

        const archivedMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId2)
            .withUserId(userId)
            .withStatus('archived')
            .buildDocument();
        db.seedGroupMember(groupId2, userId, archivedMember);

        const pendingMember = new GroupMemberDocumentBuilder()
            .withGroupId(groupId3)
            .withUserId(userId)
            .withStatus('pending')
            .buildDocument();
        db.seedGroupMember(groupId3, userId, pendingMember);

        // Filter by multiple statuses
        const result = await reader.getGroupsForUserV2(userId, {
            statusFilter: [MemberStatuses.ACTIVE, MemberStatuses.PENDING],
        });

        expect(result.data).toHaveLength(2);
        const groupIds = result.data.map((g) => g.id);
        expect(groupIds).toContain(groupId1);
        expect(groupIds).toContain(groupId3);
        expect(groupIds).not.toContain(groupId2);
    });
});

describe('Archive Groups - GroupMemberService', () => {
    let db: StubFirestoreDatabase;
    let reader: FirestoreReader;
    let writer: FirestoreWriter;
    let service: GroupMemberService;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        reader = new FirestoreReader(db);
        writer = new FirestoreWriter(db);
        service = new GroupMemberService(reader, writer);
    });

    describe('archiveGroupForUser', () => {
        test('should archive an active group membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group and active membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const activeMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, activeMember);

            // Archive the membership
            const result = await service.archiveGroupForUser(groupId, userId);

            expect(result.message).toBe('Group archived successfully');

            // Verify via reader that the status changed
            const member = await reader.getGroupMember(groupId, userId);
            expect(member?.memberStatus).toBe(MemberStatuses.ARCHIVED);
        });

        test('should reject archiving non-existent membership', async () => {
            const userId = 'user123';
            const groupId = 'nonexistent' as any;

            await expect(service.archiveGroupForUser(groupId, userId)).rejects.toThrow('Group membership');
        });

        test('should reject archiving non-active membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with pending membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const pendingMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('pending')
                .buildDocument();
            db.seedGroupMember(groupId, userId, pendingMember);

            await expect(service.archiveGroupForUser(groupId, userId)).rejects.toThrow();
        });

        test('should reject archiving already archived membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with archived membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const archivedMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('archived')
                .buildDocument();
            db.seedGroupMember(groupId, userId, archivedMember);

            await expect(service.archiveGroupForUser(groupId, userId)).rejects.toThrow();
        });
    });

    describe('unarchiveGroupForUser', () => {
        test('should unarchive an archived group membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with archived membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const archivedMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('archived')
                .buildDocument();
            db.seedGroupMember(groupId, userId, archivedMember);

            // Unarchive the membership
            const result = await service.unarchiveGroupForUser(groupId, userId);

            expect(result.message).toBe('Group unarchived successfully');

            // Verify via reader that the status changed
            const member = await reader.getGroupMember(groupId, userId);
            expect(member?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });

        test('should reject unarchiving non-existent membership', async () => {
            const userId = 'user123';
            const groupId = 'nonexistent' as any;

            await expect(service.unarchiveGroupForUser(groupId, userId)).rejects.toThrow('Group membership');
        });

        test('should reject unarchiving non-archived membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with active membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const activeMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, activeMember);

            await expect(service.unarchiveGroupForUser(groupId, userId)).rejects.toThrow();
        });

        test('should reject unarchiving pending membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with pending membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const pendingMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('pending')
                .buildDocument();
            db.seedGroupMember(groupId, userId, pendingMember);

            await expect(service.unarchiveGroupForUser(groupId, userId)).rejects.toThrow();
        });
    });

    describe('archive/unarchive round-trip', () => {
        test('should support archiving and unarchiving the same membership', async () => {
            const userId = 'user123';
            const groupId = 'group123' as any;

            // Create group with active membership
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            const activeMember = new GroupMemberDocumentBuilder()
                .withGroupId(groupId)
                .withUserId(userId)
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, activeMember);

            // Archive
            await service.archiveGroupForUser(groupId, userId);
            let member = await reader.getGroupMember(groupId, userId);
            expect(member?.memberStatus).toBe(MemberStatuses.ARCHIVED);

            // Unarchive
            await service.unarchiveGroupForUser(groupId, userId);
            member = await reader.getGroupMember(groupId, userId);
            expect(member?.memberStatus).toBe(MemberStatuses.ACTIVE);

            // Archive again
            await service.archiveGroupForUser(groupId, userId);
            member = await reader.getGroupMember(groupId, userId);
            expect(member?.memberStatus).toBe(MemberStatuses.ARCHIVED);
        });
    });
});

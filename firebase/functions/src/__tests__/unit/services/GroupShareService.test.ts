import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { MAX_GROUP_MEMBERS, MemberStatuses, PermissionLevels } from '@splitifyd/shared';
import { GroupDTOBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { GroupShareService } from '../../../services/GroupShareService';
import { ApiError } from '../../../utils/errors';

describe('GroupShareService', () => {
    let groupShareService: GroupShareService;
    let db: StubFirestoreDatabase;
    let firestoreReader: FirestoreReader;
    let firestoreWriter: FirestoreWriter;
    let groupMemberService: GroupMemberService;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        firestoreWriter = new FirestoreWriter(db);
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter);

        // Create service with real services
        groupShareService = new GroupShareService(firestoreReader, firestoreWriter, groupMemberService);
    });

    describe('previewGroupByLink', () => {
        it('should throw BAD_REQUEST when linkId is missing', async () => {
            await expect(groupShareService.previewGroupByLink('user-id', '')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.previewGroupByLink('user-id', '');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.message).toContain('Link ID is required');
        });
    });

    describe('generateShareableLink', () => {
        it('should throw NOT_FOUND when group does not exist', async () => {
            await expect(groupShareService.generateShareableLink('user-id', 'nonexistent-group')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink('user-id', 'nonexistent-group');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.message).toContain('Group not found');
        });

        it('should generate shareable link for group owner', async () => {
            const groupId = 'test-group';
            const userId = 'owner-id';

            // Set up test group using builder
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(userId)
                .build();

            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .asAdmin()
                .buildDocument();
            db.seedGroupMember(groupId, userId, membershipDoc);

            const result = await groupShareService.generateShareableLink(userId, groupId);

            expect(result.shareablePath).toMatch(/^\/join\?linkId=.+$/);
            expect(result.linkId).toBeDefined();
            expect(result.linkId.length).toBeGreaterThan(0);
        });
    });

    describe('service initialization', () => {
        it('should initialize service successfully', () => {
            expect(groupShareService).toBeDefined();
            expect(typeof groupShareService.generateShareableLink).toBe('function');
            expect(typeof groupShareService.previewGroupByLink).toBe('function');
        });
    });

    describe('group member cap enforcement', () => {
        const groupId = 'test-group';
        const linkId = 'test-link-123';
        const newUserId = 'new-user-id';

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: 'owner-id',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, shareLink);
        });

        it(`should succeed when group has ${MAX_GROUP_MEMBERS - 1} members`, async () => {
            // Create MAX_GROUP_MEMBERS - 1 existing members
            const existingMembers = Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .buildDocument());

            // Seed each member individually
            existingMembers.forEach((member) => {
                db.seedGroupMember(groupId, member.uid, member);
            });

            // Set up the new user's profile so joinGroupByLink can read their displayName
            db.seedUser(newUserId, {
                displayName: 'New User',
            });

            // Should succeed - we're at 49 members, adding 1 more = 50 (at cap, but still allowed)
            const result = await groupShareService.joinGroupByLink(newUserId, linkId);
            expect(result).toBeDefined();
            expect(result.displayNameConflict).toBe(false);
        });

        it(`should fail when group already has ${MAX_GROUP_MEMBERS} members`, async () => {
            // Create exactly MAX_GROUP_MEMBERS existing members
            const existingMembers = Array.from({ length: MAX_GROUP_MEMBERS }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .buildDocument());

            // Seed each member individually
            existingMembers.forEach((member) => {
                db.seedGroupMember(groupId, member.uid, member);
            });

            // Should fail with GROUP_AT_CAPACITY
            let caughtError: ApiError | undefined;
            try {
                await groupShareService.joinGroupByLink(newUserId, linkId);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('GROUP_AT_CAPACITY');
            expect(caughtError?.message).toContain(`${MAX_GROUP_MEMBERS} members`);
        });

        it(`should detect overflow in getAllGroupMembers when group has > ${MAX_GROUP_MEMBERS}`, async () => {
            // Create MAX_GROUP_MEMBERS + 1 members (edge case - should never happen in practice)
            // This tests the overflow detection in FirestoreReader.getAllGroupMembers directly
            const tooManyMembers = Array.from({ length: MAX_GROUP_MEMBERS + 1 }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .buildDocument());

            // Seed each member individually
            tooManyMembers.forEach((member) => {
                db.seedGroupMember(groupId, member.uid, member);
            });

            // Calling getAllGroupMembers directly should detect overflow
            let caughtError: ApiError | undefined;
            try {
                await firestoreReader.getAllGroupMembers(groupId);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('GROUP_TOO_LARGE');
            expect(caughtError?.message).toContain('exceeds maximum size');
        });
    });

    describe('display name conflict detection', () => {
        const groupId = 'test-group';
        const linkId = 'test-link-123';
        const newUserId = 'new-user-id';

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId);

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: 'owner-id',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, shareLink);
        });

        it('should return displayNameConflict: false when display name is unique', async () => {
            // Create existing member with different display name
            const existingMember = new GroupMemberDocumentBuilder()
                .withUserId('existing-user')
                .withGroupId(groupId)
                .withGroupDisplayName('Existing User')
                .buildDocument();
            db.seedGroupMember(groupId, existingMember.uid, existingMember);

            // Set up new user with unique display name
            db.seedUser(newUserId, {
                displayName: 'New User',
            });

            const result = await groupShareService.joinGroupByLink(newUserId, linkId);

            expect(result.displayNameConflict).toBe(false);
            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });

        it('should return displayNameConflict: true when display name matches existing member', async () => {
            // Create existing member with display name "Test User"
            const existingMember = new GroupMemberDocumentBuilder()
                .withUserId('existing-user')
                .withGroupId(groupId)
                .withGroupDisplayName('Test User')
                .buildDocument();
            db.seedGroupMember(groupId, existingMember.uid, existingMember);

            // Set up new user with same display name
            db.seedUser(newUserId, {
                displayName: 'Test User', // Same as existing member
            });

            const result = await groupShareService.joinGroupByLink(newUserId, linkId);

            expect(result.displayNameConflict).toBe(true);
            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });

        it('should detect case-insensitive display name conflicts', async () => {
            // Create existing member with display name "test user" (lowercase)
            const existingMember = new GroupMemberDocumentBuilder()
                .withUserId('existing-user')
                .withGroupId(groupId)
                .withGroupDisplayName('test user')
                .buildDocument();
            db.seedGroupMember(groupId, existingMember.uid, existingMember);

            // Set up new user with "Test User" (different case)
            db.seedUser(newUserId, {
                displayName: 'Test User',
            });

            const result = await groupShareService.joinGroupByLink(newUserId, linkId);

            // Should detect conflict (case-insensitive comparison)
            expect(result.displayNameConflict).toBe(true);
            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });
    });

    describe('member approval workflow - admin required', () => {
        const groupId = 'managed-group';
        const linkId = 'managed-link';
        const ownerId = 'owner-id';
        const pendingUserId = 'pending-user-id';

        beforeEach(() => {
            const managedGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .withPermissions({
                    expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                    expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                    memberInvitation: PermissionLevels.ADMIN_ONLY,
                    memberApproval: 'admin-required',
                    settingsManagement: PermissionLevels.ADMIN_ONLY,
                })
                .build();
            db.seedGroup(groupId, managedGroup);
            db.initializeGroupBalance(groupId);

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, shareLink);

            const ownerMember = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMember);

            db.seedUser(pendingUserId, { displayName: 'Pending User' });
        });

        it('should mark joins as pending when admin approval is required', async () => {
            const result = await groupShareService.joinGroupByLink(pendingUserId, linkId);
            expect(result.success).toBe(false);
            expect(result.memberStatus).toBe(MemberStatuses.PENDING);

            const storedMembership = await firestoreReader.getGroupMember(groupId, pendingUserId);
            expect(storedMembership).not.toBeNull();
            expect(storedMembership?.memberStatus).toBe(MemberStatuses.PENDING);
        });
    });

    describe('member approval workflow - automatic', () => {
        const groupId = 'open-group';
        const linkId = 'open-link';
        const ownerId = 'open-owner';
        const joiningUserId = 'joining-user';

        beforeEach(() => {
            const openGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .build();
            db.seedGroup(groupId, openGroup);
            db.initializeGroupBalance(groupId);

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, shareLink);

            const ownerMember = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMember);

            db.seedUser(joiningUserId, { displayName: 'Joining User' });
        });

        it('should activate members immediately when approval is automatic', async () => {
            const result = await groupShareService.joinGroupByLink(joiningUserId, linkId);
            expect(result.success).toBe(true);
            expect(result.memberStatus).toBe(MemberStatuses.ACTIVE);

            const storedMembership = await firestoreReader.getGroupMember(groupId, joiningUserId);
            expect(storedMembership?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });
    });
});

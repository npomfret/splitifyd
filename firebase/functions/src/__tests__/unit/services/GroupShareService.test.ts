import type {GroupId} from '@billsplit-wl/shared';
import {ActivityFeedActions, ActivityFeedEventTypes, COLOR_PATTERNS, MAX_GROUP_MEMBERS, MemberStatuses, PermissionLevels, toDisplayName, toGroupId, toISOString, toShareLinkToken, toUserId, USER_COLORS,} from '@billsplit-wl/shared';
import {CreateGroupRequestBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder, ShareLinkBuilder, TenantFirestoreTestDatabase, ThemeBuilder, UserRegistrationBuilder} from '@billsplit-wl/test-support';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {FirestoreCollections, HTTP_STATUS} from '../../../constants';
import {ActivityFeedService} from '../../../services/ActivityFeedService';
import {FirestoreReader, FirestoreWriter} from '../../../services/firestore';
import {GroupMemberService} from '../../../services/GroupMemberService';
import {GroupShareService} from '../../../services/GroupShareService';
import {GroupTransactionManager} from '../../../services/transactions/GroupTransactionManager';
import {UserService} from '../../../services/UserService2';
import {ApiError} from '../../../utils/errors';
import {AppDriver} from '../AppDriver';
import {StubAuthService} from '../mocks/StubAuthService';

let ownerId1: string;
let joiningUserId1: string;
let userId1: string;

describe('GroupShareService', () => {
    let app: AppDriver;
    let groupShareService: GroupShareService;
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;
    let groupMemberService: GroupMemberService;
    let activityFeedService: ActivityFeedService;
    let userService: UserService;
    let authService: StubAuthService;
    let groupTransactionManager: GroupTransactionManager;

    beforeEach(async () => {
        // Create AppDriver for API-level operations
        app = new AppDriver();
        db = app.database;

        // Create real services using the database from AppDriver
        firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);
        groupTransactionManager = new GroupTransactionManager(firestoreReader, firestoreWriter);
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService, groupTransactionManager);
        authService = new StubAuthService();
        userService = new UserService(firestoreReader, firestoreWriter, authService, 0);

        // Create service with real services
        groupShareService = new GroupShareService(
            firestoreReader,
            firestoreWriter,
            groupMemberService,
            activityFeedService,
            userService,
            groupTransactionManager,
        );

        // Register common test users via API
        const owner1Reg = new UserRegistrationBuilder()
            .withEmail('owner1@test.com')
            .withPassword('password123456')
            .withDisplayName('Owner User')
            .build();
        const owner1Result = await app.registerUser(owner1Reg);
        ownerId1 = owner1Result.user.uid;

        const joiningReg = new UserRegistrationBuilder()
            .withEmail('joining@test.com')
            .withPassword('password123456')
            .withDisplayName('Joining User')
            .build();
        const joiningResult = await app.registerUser(joiningReg);
        joiningUserId1 = joiningResult.user.uid;

        const user1Reg = new UserRegistrationBuilder()
            .withEmail('user1@test.com')
            .withPassword('password123456')
            .withDisplayName('User 1')
            .build();
        const user1Result = await app.registerUser(user1Reg);
        userId1 = user1Result.user.uid;
    });

    // Helper to register additional users via API
    const registerUser = async (email: string, displayName: string): Promise<string> => {
        const reg = new UserRegistrationBuilder()
            .withEmail(email)
            .withPassword('password123456')
            .withDisplayName(displayName)
            .build();
        const result = await app.registerUser(reg);
        return result.user.uid;
    };

    describe('generateUniqueThemeColor', () => {
        const groupId = toGroupId('theme-group');

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('returns a theme not present in existing combinations', () => {
            const assignedAt = toISOString(new Date().toISOString());
            const existingTheme = new ThemeBuilder()
                .withLight(USER_COLORS[0].light)
                .withDark(USER_COLORS[0].dark)
                .withName(USER_COLORS[0].name)
                .withPattern(COLOR_PATTERNS[0])
                .withAssignedAt(assignedAt)
                .withColorIndex(0)
                .build();

            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = groupShareService.generateUniqueThemeColor(groupId, [existingTheme], assignedAt, toUserId(joiningUserId1));

            expect(result.assignedAt).toBe(assignedAt);
            const usedKey = `${existingTheme.colorIndex}:${existingTheme.pattern}`;
            const resultKey = `${result.colorIndex}:${result.pattern}`;
            expect(resultKey).not.toBe(usedKey);
        });

        it('reuses the palette gracefully when all combinations are exhausted', () => {
            const assignedAt = toISOString(new Date().toISOString());
            const allThemes = USER_COLORS.flatMap((color, colorIndex) =>
                COLOR_PATTERNS.map(pattern =>
                    new ThemeBuilder()
                        .withLight(color.light)
                        .withDark(color.dark)
                        .withName(color.name)
                        .withPattern(pattern)
                        .withAssignedAt(assignedAt)
                        .withColorIndex(colorIndex)
                        .build()
                )
            );

            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = groupShareService.generateUniqueThemeColor(groupId, allThemes, assignedAt, toUserId(joiningUserId1));

            expect(result.assignedAt).toBe(assignedAt);
            expect(result.colorIndex).toBeGreaterThanOrEqual(0);
            expect(result.colorIndex).toBeLessThan(USER_COLORS.length);
            expect(COLOR_PATTERNS.includes(result.pattern)).toBe(true);
        });
    });

    // Helper to create a group with owner via API
    const createGroupWithOwner = async (userId: string, groupName?: string): Promise<GroupId> => {
        const groupRequest = new CreateGroupRequestBuilder()
            .withName(groupName || 'Test Group')
            .build();
        const group = await app.createGroup(groupRequest, userId);
        return toGroupId(group.id);
    };

    const seedShareLink = (groupId: GroupId, shareLink: {
        id: string;
        token: string;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
        expiresAt: string;
    }) => {
        db.seed(`groups/${groupId}/shareLinks/${shareLink.id}`, shareLink);
        db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${shareLink.token}`, {
            groupId,
            shareLinkId: shareLink.id,
            expiresAt: shareLink.expiresAt,
            createdBy: shareLink.createdBy,
            createdAt: shareLink.createdAt,
        });
    };

    describe('previewGroupByLink', () => {
        it('should throw BAD_REQUEST when linkId is missing', async () => {
            await expect(groupShareService.previewGroupByLink(toUserId(userId1), toShareLinkToken(''))).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.previewGroupByLink(toUserId(userId1), toShareLinkToken(''));
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
            await expect(groupShareService.generateShareableLink(toUserId(userId1), toGroupId('nonexistent-group'))).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink(toUserId(userId1), toGroupId('nonexistent-group'));
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.message).toContain('Group not found');
        });

        it('should generate shareable link for group owner', async () => {
            const userId = ownerId1;

            // Create group via API
            const groupId = await createGroupWithOwner(userId);

            const result = await groupShareService.generateShareableLink(toUserId(userId), groupId);

            expect(result.shareablePath).toMatch(/^\/join\?shareToken=.+$/);
            expect(result.shareToken).toBeDefined();
            expect(result.shareToken.length).toBeGreaterThan(0);
            expect(result.expiresAt).toBeDefined();
            const now = Date.now();
            const expiryMs = new Date(result.expiresAt).getTime();
            expect(expiryMs).toBeGreaterThan(now);
            expect(expiryMs - now).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
            expect(expiryMs - now).toBeLessThanOrEqual((24 * 60 * 60 * 1000) + (5 * 60 * 1000));
        });

        it('uses the provided future expiration timestamp', async () => {
            const userId = await registerUser('custom-exp@test.com', 'Custom Owner');
            const groupId = await createGroupWithOwner(userId);

            const customExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

            const result = await groupShareService.generateShareableLink(toUserId(userId), groupId, customExpiry);

            expect(result.expiresAt).toBe(customExpiry);
        });

        it('rejects expiration timestamps in the past', async () => {
            const userId = await registerUser('past-exp@test.com', 'Past Owner');
            const groupId = await createGroupWithOwner(userId);

            const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();

            await expect(groupShareService.generateShareableLink(toUserId(userId), groupId, pastExpiry)).rejects.toMatchObject({
                code: 'INVALID_EXPIRATION',
            });
        });

        it('rejects expiration timestamps beyond the maximum window', async () => {
            const userId = await registerUser('far-exp@test.com', 'Far Owner');
            const groupId = await createGroupWithOwner(userId);

            const farExpiry = new Date(Date.now() + (6 * 24 * 60 * 60 * 1000)).toISOString();

            await expect(groupShareService.generateShareableLink(toUserId(userId), groupId, farExpiry)).rejects.toMatchObject({
                code: 'INVALID_EXPIRATION',
            });
        });

        it('removes expired share links when creating a new one', async () => {
            const userId = await registerUser('cleanup@test.com', 'Cleanup Owner');
            const groupId = await createGroupWithOwner(userId);

            const expiredShareLink = new ShareLinkBuilder()
                .withCreatedBy(toUserId(userId))
                .withExpiresAt(new Date(Date.now() - 5 * 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/expired-cleanup-doc`, { ...expiredShareLink, id: 'expired-cleanup-doc', token: 'expired-cleanup-token' });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/expired-cleanup-token`, {
                groupId,
                shareLinkId: 'expired-cleanup-doc',
                expiresAt: expiredShareLink.expiresAt,
                createdBy: expiredShareLink.createdBy,
                createdAt: expiredShareLink.createdAt,
            });

            await groupShareService.generateShareableLink(toUserId(userId), groupId);

            const shareLinksSnapshot = await db.collection('groups').doc(groupId).collection('shareLinks').get();
            const shareLinkIds = shareLinksSnapshot.docs.map((doc) => doc.id);
            expect(shareLinkIds).not.toContain(expiredShareLink.id);
        });
    });

    describe('share link expiration enforcement', () => {
        let groupId: GroupId;
        let ownerId: string;
        const expiredToken = toShareLinkToken(`expired-token-1234567890`);
        const previewToken = toShareLinkToken('preview-expired-token');

        beforeEach(async () => {
            ownerId = await registerUser('expiration-owner@test.com', 'Expiration Owner');
            groupId = await createGroupWithOwner(ownerId);
        });

        it('rejects joins when the share link is expired', async () => {
            const expiredShareLink = new ShareLinkBuilder()
                .withCreatedBy(toUserId(ownerId))
                .withExpiresAt(new Date(Date.now() - 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/expired-doc-id`, { ...expiredShareLink, id: 'expired-doc-id', token: expiredToken });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${expiredToken}`, {
                groupId,
                shareLinkId: 'expired-doc-id',
                expiresAt: expiredShareLink.expiresAt,
                createdBy: expiredShareLink.createdBy,
                createdAt: expiredShareLink.createdAt,
            });

            await expect(groupShareService.joinGroupByLink(toUserId(joiningUserId1), expiredToken, toDisplayName('Joining User'))).rejects.toMatchObject({
                code: 'LINK_EXPIRED',
            });
        });

        it('blocks previews for expired share links', async () => {
            const expiredShareLink = new ShareLinkBuilder()
                .withCreatedBy(toUserId(ownerId))
                .withExpiresAt(new Date(Date.now() - 2 * 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/preview-expired-doc-id`, { ...expiredShareLink, id: 'preview-expired-doc-id', token: previewToken });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${previewToken}`, {
                groupId,
                shareLinkId: 'preview-expired-doc-id',
                expiresAt: expiredShareLink.expiresAt,
                createdBy: expiredShareLink.createdBy,
                createdAt: expiredShareLink.createdAt,
            });

            const differentUser = await registerUser('different@test.com', 'Different User');
            await expect(groupShareService.previewGroupByLink(toUserId(differentUser), previewToken)).rejects.toMatchObject({
                code: 'LINK_EXPIRED',
            });
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
        const groupId = toGroupId('test-group');
        const linkId = toShareLinkToken('test-link-1234567890');
        const newUserId = toUserId('new-user-id');

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(toUserId(ownerId1))
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up share link
            const shareLink = new ShareLinkBuilder()
                .withCreatedBy(toUserId(ownerId1))
                .withExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, { ...shareLink, id: linkId, token: linkId });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${linkId}`, {
                groupId,
                shareLinkId: linkId,
                expiresAt: shareLink.expiresAt,
                createdBy: shareLink.createdBy,
                createdAt: shareLink.createdAt,
            });
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

            // Should succeed - we're at 49 members, adding 1 more = 50 (at cap, but still allowed)
            const result = await groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('New User'));
            expect(result).toBeDefined();
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
                await groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('New User'));
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
        const groupId = toGroupId('test-group');
        const linkId = toShareLinkToken('test-link-1234567890');
        const newUserId = toUserId('new-user-id');

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(toUserId(ownerId1))
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId);

            // Set up share link
            const shareLink = new ShareLinkBuilder()
                .withCreatedBy(toUserId(ownerId1))
                .withExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, { ...shareLink, id: linkId, token: linkId });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${linkId}`, {
                groupId,
                shareLinkId: linkId,
                expiresAt: shareLink.expiresAt,
                createdBy: shareLink.createdBy,
                createdAt: shareLink.createdAt,
            });
        });

        it('should return displayNameConflict: false when display name is unique', async () => {
            // Add existing member with different display name via API
            const existingUserId = await registerUser('existing@test.com', 'Existing User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), linkId, toDisplayName('Existing User'));

            // Set up new user with unique display name
            const result = await groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('New User'));

            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });

        it('should throw DISPLAY_NAME_CONFLICT error when display name matches existing member', async () => {
            // Add existing member with display name "Test User" via API
            const existingUserId = await registerUser('existing@test.com', 'Test User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), linkId, toDisplayName('Test User'));

            // Attempt to join with same display name should throw error
            await expect(groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('Test User'))).rejects.toMatchObject({
                code: 'DISPLAY_NAME_CONFLICT',
                message: expect.stringContaining('Test User'),
            });
        });

        it('should detect case-insensitive display name conflicts', async () => {
            // Add existing member with display name "test user" (lowercase) via API
            const existingUserId = await registerUser('existing@test.com', 'Existing User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), linkId, toDisplayName('test user'));

            // Attempt to join with "Test User" (different case) should throw error
            await expect(groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('Test User'))).rejects.toMatchObject({
                code: 'DISPLAY_NAME_CONFLICT',
                message: expect.stringContaining('Test User'),
            });
        });
    });

    describe('member approval workflow - admin required', () => {
        const groupId = toGroupId('managed-group');
        const linkId = toShareLinkToken('managed-link-1234567890');
        const pendingUserId = toUserId('pending-user-id');

        beforeEach(async () => {
            const managedGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(toUserId(ownerId1))
                .withPermissions({
                    expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                    expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                    memberInvitation: PermissionLevels.ADMIN_ONLY,
                    memberApproval: 'admin-required',
                    settingsManagement: PermissionLevels.ADMIN_ONLY,
                })
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, managedGroup);
            db.initializeGroupBalance(groupId);

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);

            // Add owner as admin member via API using share link
            // Note: We need to seed the owner member directly since the group already exists
            // and we need them to be admin with specific permissions
            const ownerMember = new GroupMemberDocumentBuilder()
                .withUserId(ownerId1)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId1, ownerMember);

        });

        it('should mark joins as pending when admin approval is required', async () => {
            const result = await groupShareService.joinGroupByLink(pendingUserId, linkId, toDisplayName('Pending User'));
            expect(result.success).toBe(false);
            expect(result.memberStatus).toBe(MemberStatuses.PENDING);

            const storedMembership = await firestoreReader.getGroupMember(groupId, pendingUserId);
            expect(storedMembership).not.toBeNull();
            expect(storedMembership?.memberStatus).toBe(MemberStatuses.PENDING);
        });
    });

    describe('member approval workflow - automatic', () => {
        let groupId: GroupId;
        let ownerId: string;
        let shareToken: string;

        beforeEach(async () => {
            // Create owner and group
            ownerId = await registerUser('auto-owner@test.com', 'Auto Owner');
            groupId = await createGroupWithOwner(ownerId);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(toUserId(ownerId), groupId);
            shareToken = shareLink.shareToken;
        });

        it('should activate members immediately when approval is automatic', async () => {
            const result = await groupShareService.joinGroupByLink(toUserId(joiningUserId1), toShareLinkToken(shareToken), toDisplayName('Joining User'));
            expect(result.success).toBe(true);
            expect(result.memberStatus).toBe(MemberStatuses.ACTIVE);

            const storedMembership = await firestoreReader.getGroupMember(groupId, toUserId(joiningUserId1));
            expect(storedMembership?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });
    });

    describe('activity feed integration', () => {
        it('emits MEMBER_JOINED activity for auto-approved joins', async () => {
            const groupId = toGroupId('activity-group');
            const linkId = toShareLinkToken('activity-link-1234567890');
            const ownerUserId = await registerUser('owner-activity@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const joiningUserId = joiningUserId1;

            const group = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .withPermissions({ memberApproval: 'automatic' })
                .withoutBalance()
                .withoutLastActivity()
                .build();

            db.seedGroup(groupId, group);
            db.initializeGroupBalance(groupId);

            const ownerMembership = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMembership);

            const shareLink = new ShareLinkBuilder()
                .withCreatedBy(ownerId)
                .withExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
                .build();
            db.seed(`groups/${groupId}/shareLinks/${linkId}`, { ...shareLink, id: linkId, token: linkId });
            db.seed(`${FirestoreCollections.SHARE_LINK_TOKENS}/${linkId}`, {
                groupId,
                shareLinkId: linkId,
                expiresAt: shareLink.expiresAt,
                createdBy: shareLink.createdBy,
                createdAt: shareLink.createdAt,
            });


            await groupShareService.joinGroupByLink(toUserId(joiningUserId), linkId, toDisplayName('Joining User'));

            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                action: ActivityFeedActions.JOIN,
                actorId: joiningUserId,
                details: expect.objectContaining({
                    targetUserId: joiningUserId,
                    targetUserName: 'Joining User',
                }),
            });

            const joiningFeed = await firestoreReader.getActivityFeedForUser(toUserId(joiningUserId));
            expect(joiningFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                action: ActivityFeedActions.JOIN,
                actorId: joiningUserId,
                details: expect.objectContaining({
                    targetUserId: joiningUserId,
                }),
            });
        });

        it('notifies all existing active members when a new member joins (transaction-based recipient fetch)', async () => {
            const groupId = toGroupId('multi-member-group');
            const linkId = toShareLinkToken('multi-member-link-1234567890');
            const ownerUserId = await registerUser('owner-multi@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const existingMemberUserId = await registerUser('existing-multi@test.com', 'Existing Member');
            const existingMemberId = toUserId(existingMemberUserId);

            // Create group with automatic approval
            const group = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .withPermissions({ memberApproval: 'automatic' })
                .withoutBalance()
                .withoutLastActivity()
                .build();

            db.seedGroup(groupId, group);
            db.initializeGroupBalance(groupId);

            // Seed owner (active)
            const ownerMembership = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMembership);

            // Seed existing active member
            const existingMembership = new GroupMemberDocumentBuilder()
                .withUserId(existingMemberId)
                .withGroupId(groupId)
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, existingMemberId, existingMembership);

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);


            // Third user joins the group
            await groupShareService.joinGroupByLink(toUserId(joiningUserId1), linkId, toDisplayName('Joining User'));

            // CRITICAL: All three users should receive the activity feed event
            // This verifies that the transaction-based recipient fetching includes
            // all existing active members PLUS the newly joined member

            // Owner should receive notification
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items).toHaveLength(1);
            expect(ownerFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });

            // Existing member should receive notification
            const existingMemberFeed = await firestoreReader.getActivityFeedForUser(existingMemberId);
            expect(existingMemberFeed.items).toHaveLength(1);
            expect(existingMemberFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });

            // Joining user should also receive their own join notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(toUserId(joiningUserId1));
            expect(joiningFeed.items).toHaveLength(1);
            expect(joiningFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });
        });

        it('excludes pending members from activity notifications when a new member joins', async () => {
            const groupId = toGroupId('pending-exclusion-group');
            const linkId = toShareLinkToken('pending-link-1234567890');
            const ownerUserId = await registerUser('owner-pending@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const pendingMemberUserId = await registerUser('pending@test.com', 'Pending Member');
            const pendingMemberId = toUserId(pendingMemberUserId);
            const joiningUserId = joiningUserId1;

            // Create group with automatic approval
            const group = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .withPermissions({ memberApproval: 'automatic' })
                .withoutBalance()
                .withoutLastActivity()
                .build();

            db.seedGroup(groupId, group);
            db.initializeGroupBalance(groupId);

            // Seed owner (active)
            const ownerMembership = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMembership);

            // Seed pending member (should NOT receive notifications)
            const pendingMembership = new GroupMemberDocumentBuilder()
                .withUserId(pendingMemberId)
                .withGroupId(groupId)
                .asPending()
                .buildDocument();
            db.seedGroupMember(groupId, pendingMemberId, pendingMembership);

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);


            // New user joins the group
            await groupShareService.joinGroupByLink(toUserId(joiningUserId), linkId, toDisplayName('Joining User'));

            // Owner should receive notification (active member)
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items).toHaveLength(1);

            // Pending member should NOT receive notification
            const pendingFeed = await firestoreReader.getActivityFeedForUser(pendingMemberId);
            expect(pendingFeed.items).toHaveLength(0);

            // Joining user should receive their own notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(toUserId(joiningUserId));
            expect(joiningFeed.items).toHaveLength(1);
        });
    });
});

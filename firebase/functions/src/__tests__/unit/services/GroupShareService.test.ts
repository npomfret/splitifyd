import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    COLOR_PATTERNS,
    MAX_GROUP_MEMBERS,
    MemberStatuses,
    PermissionLevels,
    toDisplayName,
    toGroupId,
    toISOString,
    toShareLinkToken,
    USER_COLORS,
} from '@billsplit-wl/shared';
import type { GroupId } from '@billsplit-wl/shared';
import { TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { GroupDTOBuilder, GroupMemberDocumentBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirestoreCollections, HTTP_STATUS } from '../../../constants';
import { ActivityFeedService } from '../../../services/ActivityFeedService';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { GroupShareService } from '../../../services/GroupShareService';
import { GroupTransactionManager } from '../../../services/transactions/GroupTransactionManager';
import { UserService } from '../../../services/UserService2';
import { ApiError } from '../../../utils/errors';
import { StubAuthService } from '../mocks/StubAuthService';

describe('GroupShareService', () => {
    let groupShareService: GroupShareService;
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;
    let groupMemberService: GroupMemberService;
    let activityFeedService: ActivityFeedService;
    let userService: UserService;
    let authService: StubAuthService;
    let groupTransactionManager: GroupTransactionManager;

    beforeEach(() => {
        // Create stub database
        db = new TenantFirestoreTestDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);
        groupTransactionManager = new GroupTransactionManager(firestoreReader, firestoreWriter);
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService, groupTransactionManager);
        authService = new StubAuthService();
        userService = new UserService(firestoreReader, firestoreWriter, authService);

        // Create service with real services
        groupShareService = new GroupShareService(
            firestoreReader,
            firestoreWriter,
            groupMemberService,
            activityFeedService,
            userService,
            groupTransactionManager,
        );
    });

    const seedUserProfile = (userId: string, overrides: Record<string, any> = {}) => {
        const user = db.seedUser(userId, overrides);

        authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: overrides.displayName ?? user.displayName,
        });

        return user;
    };

    describe('generateUniqueThemeColor', () => {
        const groupId = toGroupId('theme-group');

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('returns a theme not present in existing combinations', () => {
            const assignedAt = toISOString(new Date().toISOString());
            const existingTheme = {
                light: USER_COLORS[0].light,
                dark: USER_COLORS[0].dark,
                name: USER_COLORS[0].name,
                pattern: COLOR_PATTERNS[0],
                assignedAt,
                colorIndex: 0,
            };

            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = groupShareService.generateUniqueThemeColor(groupId, [existingTheme], assignedAt, 'joining-user');

            expect(result.assignedAt).toBe(assignedAt);
            const usedKey = `${existingTheme.colorIndex}:${existingTheme.pattern}`;
            const resultKey = `${result.colorIndex}:${result.pattern}`;
            expect(resultKey).not.toBe(usedKey);
        });

        it('reuses the palette gracefully when all combinations are exhausted', () => {
            const assignedAt = toISOString(new Date().toISOString());
            const allThemes = USER_COLORS.flatMap((color, colorIndex) =>
                COLOR_PATTERNS.map(pattern => ({
                    light: color.light,
                    dark: color.dark,
                    name: color.name,
                    pattern,
                    assignedAt,
                    colorIndex,
                }))
            );

            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = groupShareService.generateUniqueThemeColor(groupId, allThemes, assignedAt, 'joining-user');

            expect(result.assignedAt).toBe(assignedAt);
            expect(result.colorIndex).toBeGreaterThanOrEqual(0);
            expect(result.colorIndex).toBeLessThan(USER_COLORS.length);
            expect(COLOR_PATTERNS.includes(result.pattern)).toBe(true);
        });
    });

    const seedGroupWithOwner = (groupId: GroupId, ownerId: string) => {
        const testGroup = new GroupDTOBuilder()
            .withId(groupId)
            .withCreatedBy(ownerId)
            .withoutBalance()
            .withoutLastActivity()
            .build();

        seedUserProfile(ownerId, { displayName: 'Owner User' });
        db.seedGroup(groupId, testGroup);
        db.initializeGroupBalance(groupId);

        const membershipDoc = new GroupMemberDocumentBuilder()
            .withUserId(ownerId)
            .withGroupId(groupId)
            .asAdmin()
            .buildDocument();

        db.seedGroupMember(groupId, ownerId, membershipDoc);
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
            await expect(groupShareService.previewGroupByLink('user-id', toShareLinkToken(''))).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.previewGroupByLink('user-id', toShareLinkToken(''));
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
            await expect(groupShareService.generateShareableLink('user-id', toGroupId('nonexistent-group'))).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink('user-id', toGroupId('nonexistent-group'));
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.message).toContain('Group not found');
        });

        it('should generate shareable link for group owner', async () => {
            const groupId = toGroupId('test-group');
            const userId = 'owner-id';

            // Set up test group using builder
            seedGroupWithOwner(groupId, userId);

            const result = await groupShareService.generateShareableLink(userId, groupId);

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
            const groupId = toGroupId('custom-expiration-group');
            const userId = 'owner-with-custom-expiration';
            seedGroupWithOwner(groupId, userId);

            const customExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

            const result = await groupShareService.generateShareableLink(userId, groupId, customExpiry);

            expect(result.expiresAt).toBe(customExpiry);
        });

        it('rejects expiration timestamps in the past', async () => {
            const groupId = toGroupId('past-expiration-group');
            const userId = 'owner-past-expiration';
            seedGroupWithOwner(groupId, userId);

            const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();

            await expect(groupShareService.generateShareableLink(userId, groupId, pastExpiry)).rejects.toMatchObject({
                code: 'INVALID_EXPIRATION',
            });
        });

        it('rejects expiration timestamps beyond the maximum window', async () => {
            const groupId = toGroupId('far-expiration-group');
            const userId = 'owner-far-expiration';
            seedGroupWithOwner(groupId, userId);

            const farExpiry = new Date(Date.now() + (6 * 24 * 60 * 60 * 1000)).toISOString();

            await expect(groupShareService.generateShareableLink(userId, groupId, farExpiry)).rejects.toMatchObject({
                code: 'INVALID_EXPIRATION',
            });
        });

        it('removes expired share links when creating a new one', async () => {
            const groupId = toGroupId('cleanup-group');
            const userId = 'owner-cleanup';
            seedGroupWithOwner(groupId, userId);

            const expiredShareLink = {
                id: 'expired-cleanup-doc',
                token: 'expired-cleanup-token',
                createdBy: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, expiredShareLink);

            await groupShareService.generateShareableLink(userId, groupId);

            const shareLinksSnapshot = await db.collection('groups').doc(groupId).collection('shareLinks').get();
            const shareLinkIds = shareLinksSnapshot.docs.map((doc) => doc.id);
            expect(shareLinkIds).not.toContain(expiredShareLink.id);
        });
    });

    describe('share link expiration enforcement', () => {
        const groupId = toGroupId('expired-group');
        const ownerId = 'owner-expiration';
        const expiredToken = toShareLinkToken(`expired-token-1234567890`);
        const previewToken = toShareLinkToken('preview-expired-token');

        beforeEach(() => {
            seedGroupWithOwner(groupId, ownerId);
        });

        it('rejects joins when the share link is expired', async () => {
            const expiredShareLink = {
                id: 'expired-doc-id',
                token: expiredToken,
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, expiredShareLink);

            seedUserProfile('joining-user', { displayName: 'Joining User' });

            await expect(groupShareService.joinGroupByLink('joining-user', expiredToken, toDisplayName('Joining User'))).rejects.toMatchObject({
                code: 'LINK_EXPIRED',
            });
        });

        it('blocks previews for expired share links', async () => {
            const expiredShareLink = {
                id: 'preview-expired-doc-id',
                token: previewToken,
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, expiredShareLink);

            await expect(groupShareService.previewGroupByLink('different-user', previewToken)).rejects.toMatchObject({
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
        const newUserId = 'new-user-id';

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: 'owner-id',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);
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
        const newUserId = 'new-user-id';

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, testGroup);
            db.initializeGroupBalance(groupId);

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: 'owner-id',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);
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
            const result = await groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('New User'));

            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });

        it('should throw DISPLAY_NAME_CONFLICT error when display name matches existing member', async () => {
            // Create existing member with display name "Test User"
            const existingMember = new GroupMemberDocumentBuilder()
                .withUserId('existing-user')
                .withGroupId(groupId)
                .withGroupDisplayName('Test User')
                .buildDocument();
            db.seedGroupMember(groupId, existingMember.uid, existingMember);

            // Attempt to join with same display name should throw error
            await expect(groupShareService.joinGroupByLink(newUserId, linkId, toDisplayName('Test User'))).rejects.toMatchObject({
                code: 'DISPLAY_NAME_CONFLICT',
                message: expect.stringContaining('Test User'),
            });
        });

        it('should detect case-insensitive display name conflicts', async () => {
            // Create existing member with display name "test user" (lowercase)
            const existingMember = new GroupMemberDocumentBuilder()
                .withUserId('existing-user')
                .withGroupId(groupId)
                .withGroupDisplayName('test user')
                .buildDocument();
            db.seedGroupMember(groupId, existingMember.uid, existingMember);

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
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, managedGroup);
            db.initializeGroupBalance(groupId);

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);

            const ownerMember = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMember);

            seedUserProfile(pendingUserId, { displayName: 'Pending User' });
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
        const groupId = toGroupId('open-group');
        const linkId = toShareLinkToken('open-link-1234567890');
        const ownerId = 'open-owner';
        const joiningUserId = 'joining-user';

        beforeEach(() => {
            const openGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy(ownerId)
                .withoutBalance()
                .withoutLastActivity()
                .build();
            db.seedGroup(groupId, openGroup);
            db.initializeGroupBalance(groupId);

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);

            const ownerMember = new GroupMemberDocumentBuilder()
                .withUserId(ownerId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, ownerId, ownerMember);

            seedUserProfile(joiningUserId, { displayName: 'Joining User' });
        });

        it('should activate members immediately when approval is automatic', async () => {
            const result = await groupShareService.joinGroupByLink(joiningUserId, linkId, toDisplayName('Joining User'));
            expect(result.success).toBe(true);
            expect(result.memberStatus).toBe(MemberStatuses.ACTIVE);

            const storedMembership = await firestoreReader.getGroupMember(groupId, joiningUserId);
            expect(storedMembership?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });
    });

    describe('activity feed integration', () => {
        it('emits MEMBER_JOINED activity for auto-approved joins', async () => {
            const groupId = toGroupId('activity-group');
            const linkId = toShareLinkToken('activity-link-1234567890');
            const ownerId = 'owner-user';
            const joiningUserId = 'joining-user';

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

            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            };
            seedShareLink(groupId, shareLink);

            seedUserProfile(joiningUserId, { displayName: 'Joining User' });

            await groupShareService.joinGroupByLink(joiningUserId, linkId, toDisplayName('Joining User'));

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

            const joiningFeed = await firestoreReader.getActivityFeedForUser(joiningUserId);
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
            const ownerId = 'owner-user';
            const existingMemberId = 'existing-member';
            const joiningUserId = 'joining-user';

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
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);

            seedUserProfile(joiningUserId, { displayName: 'New Joiner' });

            // Third user joins the group
            await groupShareService.joinGroupByLink(joiningUserId, linkId, toDisplayName('Joining User'));

            // CRITICAL: All three users should receive the activity feed event
            // This verifies that the transaction-based recipient fetching includes
            // all existing active members PLUS the newly joined member

            // Owner should receive notification
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items).toHaveLength(1);
            expect(ownerFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId,
            });

            // Existing member should receive notification
            const existingMemberFeed = await firestoreReader.getActivityFeedForUser(existingMemberId);
            expect(existingMemberFeed.items).toHaveLength(1);
            expect(existingMemberFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId,
            });

            // Joining user should also receive their own join notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(joiningUserId);
            expect(joiningFeed.items).toHaveLength(1);
            expect(joiningFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId,
            });
        });

        it('excludes pending members from activity notifications when a new member joins', async () => {
            const groupId = toGroupId('pending-exclusion-group');
            const linkId = toShareLinkToken('pending-link-1234567890');
            const ownerId = 'owner-user';
            const pendingMemberId = 'pending-member';
            const joiningUserId = 'joining-user';

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
                createdBy: ownerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };
            seedShareLink(groupId, shareLink);

            seedUserProfile(joiningUserId, { displayName: 'New Joiner' });

            // New user joins the group
            await groupShareService.joinGroupByLink(joiningUserId, linkId, toDisplayName('Joining User'));

            // Owner should receive notification (active member)
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items).toHaveLength(1);

            // Pending member should NOT receive notification
            const pendingFeed = await firestoreReader.getActivityFeedForUser(pendingMemberId);
            expect(pendingFeed.items).toHaveLength(0);

            // Joining user should receive their own notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(joiningUserId);
            expect(joiningFeed.items).toHaveLength(1);
        });
    });
});

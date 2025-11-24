import type { ActivityFeedItem, GroupId } from '@billsplit-wl/shared';
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
    toUserId,
    USER_COLORS,
} from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, ThemeBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import type { IFirestoreReader } from '../../../services/firestore';
import { GroupShareService } from '../../../services/GroupShareService';
import { ApiError } from '../../../utils/errors';
import { AppDriver } from '../AppDriver';

let ownerId1: string;
let joiningUserId1: string;
let userId1: string;

describe('GroupShareService', () => {
    let app: AppDriver;
    let groupShareService: GroupShareService;
    let firestoreReader: IFirestoreReader;

    beforeEach(async () => {
        // Create AppDriver for API-level operations
        app = new AppDriver();

        firestoreReader = app.componentBuilder.buildFirestoreReader();
        groupShareService = app.componentBuilder.buildGroupShareService();

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

        // Test removed: Cannot create expired share links through API - this tests implementation details
    });

    // Tests removed: Cannot create expired share links through API - expired link enforcement tests implementation details

    describe('service initialization', () => {
        it('should initialize service successfully', () => {
            expect(groupShareService).toBeDefined();
            expect(typeof groupShareService.generateShareableLink).toBe('function');
            expect(typeof groupShareService.previewGroupByLink).toBe('function');
        });
    });

    describe('group member cap enforcement', () => {
        let groupId: GroupId;
        let shareToken: string;
        const newUserId = toUserId('new-user-id');

        beforeEach(async () => {
            // Create group via API
            groupId = await createGroupWithOwner(ownerId1);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(toUserId(ownerId1), groupId);
            shareToken = shareLink.shareToken;
        });

        it(`should succeed when group has ${MAX_GROUP_MEMBERS - 1} members`, async () => {
            // Create MAX_GROUP_MEMBERS - 1 existing members via API
            // Note: We need to create 48 more members (owner is already 1, so 48 + 1 owner = 49 total)
            for (let i = 0; i < MAX_GROUP_MEMBERS - 2; i++) {
                const memberUserId = await registerUser(`member${i}@test.com`, `Member ${i}`);
                await groupShareService.joinGroupByLink(toUserId(memberUserId), toShareLinkToken(shareToken), toDisplayName(`Member ${i}`));
            }

            // Should succeed - we're at 49 members, adding 1 more = 50 (at cap, but still allowed)
            const result = await groupShareService.joinGroupByLink(newUserId, toShareLinkToken(shareToken), toDisplayName('New User'));
            expect(result).toBeDefined();
        });

        it(`should fail when group already has ${MAX_GROUP_MEMBERS} members`, async () => {
            // Create exactly MAX_GROUP_MEMBERS - 1 via API (owner is already 1)
            for (let i = 0; i < MAX_GROUP_MEMBERS - 1; i++) {
                const memberUserId = await registerUser(`member${i}@test.com`, `Member ${i}`);
                await groupShareService.joinGroupByLink(toUserId(memberUserId), toShareLinkToken(shareToken), toDisplayName(`Member ${i}`));
            }

            // Should fail with GROUP_AT_CAPACITY - group now has 50 members
            let caughtError: ApiError | undefined;
            try {
                await groupShareService.joinGroupByLink(newUserId, toShareLinkToken(shareToken), toDisplayName('New User'));
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('GROUP_AT_CAPACITY');
            expect(caughtError?.message).toContain(`${MAX_GROUP_MEMBERS} members`);
        });
    });

    describe('display name conflict detection', () => {
        let groupId: GroupId;
        let shareToken: string;
        const newUserId = toUserId('new-user-id');

        beforeEach(async () => {
            // Create group via API
            groupId = await createGroupWithOwner(ownerId1);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(toUserId(ownerId1), groupId);
            shareToken = shareLink.shareToken;
        });

        it('should return displayNameConflict: false when display name is unique', async () => {
            // Add existing member with different display name via API
            const existingUserId = await registerUser('existing@test.com', 'Existing User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), toShareLinkToken(shareToken), toDisplayName('Existing User'));

            // Set up new user with unique display name
            const result = await groupShareService.joinGroupByLink(newUserId, toShareLinkToken(shareToken), toDisplayName('New User'));

            expect(result.groupId).toBe(groupId);
            expect(result.success).toBe(true);
        });

        it('should throw DISPLAY_NAME_CONFLICT error when display name matches existing member', async () => {
            // Add existing member with display name "Test User" via API
            const existingUserId = await registerUser('existing@test.com', 'Test User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), toShareLinkToken(shareToken), toDisplayName('Test User'));

            // Attempt to join with same display name should throw error
            await expect(groupShareService.joinGroupByLink(newUserId, toShareLinkToken(shareToken), toDisplayName('Test User'))).rejects.toMatchObject({
                code: 'DISPLAY_NAME_CONFLICT',
                message: expect.stringContaining('Test User'),
            });
        });

        it('should detect case-insensitive display name conflicts', async () => {
            // Add existing member with display name "test user" (lowercase) via API
            const existingUserId = await registerUser('existing@test.com', 'Existing User');
            await groupShareService.joinGroupByLink(toUserId(existingUserId), toShareLinkToken(shareToken), toDisplayName('test user'));

            // Attempt to join with "Test User" (different case) should throw error
            await expect(groupShareService.joinGroupByLink(newUserId, toShareLinkToken(shareToken), toDisplayName('Test User'))).rejects.toMatchObject({
                code: 'DISPLAY_NAME_CONFLICT',
                message: expect.stringContaining('Test User'),
            });
        });
    });

    describe('member approval workflow - admin required', () => {
        let groupId: GroupId;
        let shareToken: string;
        const pendingUserId = toUserId('pending-user-id');

        beforeEach(async () => {
            // Create group via API
            groupId = await createGroupWithOwner(ownerId1);

            // Update group permissions to require admin approval via API
            await app.updateGroupPermissions(groupId, {
                expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'admin-required',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            }, ownerId1);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(toUserId(ownerId1), groupId);
            shareToken = shareLink.shareToken;
        });

        it('should mark joins as pending when admin approval is required', async () => {
            const result = await groupShareService.joinGroupByLink(pendingUserId, toShareLinkToken(shareToken), toDisplayName('Pending User'));
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
            const ownerUserId = await registerUser('owner-activity@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const joiningUserId = joiningUserId1;

            // Create group via API
            const groupId = await createGroupWithOwner(ownerUserId);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(ownerId, groupId);

            // Join via share link
            await groupShareService.joinGroupByLink(toUserId(joiningUserId), toShareLinkToken(shareLink.shareToken), toDisplayName('Joining User'));

            // Verify activity feed for owner
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

            // Verify activity feed for joining user
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
            const ownerUserId = await registerUser('owner-multi@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const existingMemberUserId = await registerUser('existing-multi@test.com', 'Existing Member');
            const existingMemberId = toUserId(existingMemberUserId);

            // Create group via API
            const groupId = await createGroupWithOwner(ownerUserId);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(ownerId, groupId);

            // Existing member joins the group first
            await groupShareService.joinGroupByLink(existingMemberId, toShareLinkToken(shareLink.shareToken), toDisplayName('Existing Member'));

            // Third user joins the group
            await groupShareService.joinGroupByLink(toUserId(joiningUserId1), toShareLinkToken(shareLink.shareToken), toDisplayName('Joining User'));

            // CRITICAL: All three users should receive the activity feed event
            // This verifies that the transaction-based recipient fetching includes
            // all existing active members PLUS the newly joined member

            // Owner should receive notification (will have 2 events: existing member + joining user)
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            expect(ownerFeed.items.length).toBeGreaterThanOrEqual(1);
            const ownerJoiningEvent = ownerFeed.items.find((item: ActivityFeedItem) => item.actorId === joiningUserId1);
            expect(ownerJoiningEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });

            // Existing member should receive notification about joining user
            const existingMemberFeed = await firestoreReader.getActivityFeedForUser(existingMemberId);
            expect(existingMemberFeed.items.length).toBeGreaterThanOrEqual(1);
            const existingJoiningEvent = existingMemberFeed.items.find((item: ActivityFeedItem) => item.actorId === joiningUserId1);
            expect(existingJoiningEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });

            // Joining user should also receive their own join notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(toUserId(joiningUserId1));
            expect(joiningFeed.items.length).toBeGreaterThanOrEqual(1);
            expect(joiningFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                actorId: joiningUserId1,
            });
        });

        it('excludes pending members from activity notifications when a new member joins', async () => {
            const ownerUserId = await registerUser('owner-pending@test.com', 'Owner User');
            const ownerId = toUserId(ownerUserId);
            const pendingMemberUserId = await registerUser('pending@test.com', 'Pending Member');
            const pendingMemberId = toUserId(pendingMemberUserId);
            const joiningUserId = joiningUserId1;

            // Create group via API
            const groupId = await createGroupWithOwner(ownerUserId);

            // Update group to require admin approval
            await app.updateGroupPermissions(groupId, {
                memberApproval: 'admin-required',
            }, ownerUserId);

            // Generate share link via API
            const shareLink = await groupShareService.generateShareableLink(ownerId, groupId);

            // Pending member joins (will be marked as pending due to admin-required)
            await groupShareService.joinGroupByLink(pendingMemberId, toShareLinkToken(shareLink.shareToken), toDisplayName('Pending Member'));

            // Change back to automatic approval for the next join
            await app.updateGroupPermissions(groupId, {
                memberApproval: 'automatic',
            }, ownerUserId);

            // New user joins the group (will be active)
            await groupShareService.joinGroupByLink(toUserId(joiningUserId), toShareLinkToken(shareLink.shareToken), toDisplayName('Joining User'));

            // Owner should receive notification (active member)
            const ownerFeed = await firestoreReader.getActivityFeedForUser(ownerId);
            const joiningEvents = ownerFeed.items.filter((item: ActivityFeedItem) => item.actorId === joiningUserId);
            expect(joiningEvents.length).toBeGreaterThanOrEqual(1);

            // Pending member should NOT receive notification about the new active join
            const pendingFeed = await firestoreReader.getActivityFeedForUser(pendingMemberId);
            const pendingJoiningEvents = pendingFeed.items.filter((item: ActivityFeedItem) => item.actorId === joiningUserId);
            expect(pendingJoiningEvents).toHaveLength(0);

            // Joining user should receive their own notification
            const joiningFeed = await firestoreReader.getActivityFeedForUser(toUserId(joiningUserId));
            expect(joiningFeed.items.length).toBeGreaterThanOrEqual(1);
            expect(joiningFeed.items[0].actorId).toBe(joiningUserId);
        });
    });
});

import type { DisplayName, GroupMembershipDTO, GroupName, ISOString, JoinGroupResponse, UserId } from '@splitifyd/shared';
import { ActivityFeedActions, ActivityFeedEventTypes, COLOR_PATTERNS, GroupId, MAX_GROUP_MEMBERS, MemberRoles, MemberStatuses, ShareLinkDTO, ShareLinkId, ShareLinkToken, toShareLinkToken, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import { toISOString } from '@splitifyd/shared';
import { z } from 'zod';
import { FirestoreCollections, HTTP_STATUS } from '../constants';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ShareLinkDataSchema } from '../schemas';
import { ApiError } from '../utils/errors';
import { createTopLevelMembershipDocument } from '../utils/groupMembershipHelpers';
import { generateShareToken, newTopLevelMembershipDocId } from '../utils/idGenerator';
import { ActivityFeedService } from './ActivityFeedService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import type { GroupMemberService } from './GroupMemberService';
import { GroupTransactionManager } from './transactions/GroupTransactionManager';
import { UserService } from './UserService2';

const SHARE_LINK_DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 1 day
const SHARE_LINK_MAX_EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const SHARE_LINK_EXPIRATION_DRIFT_MS = 5 * 60 * 1000; // Allow slight client/server drift (5 minutes)

export class GroupShareService {
    private readonly groupTransactionManager: GroupTransactionManager;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
        private readonly activityFeedService: ActivityFeedService,
        private readonly userService: UserService,
        groupTransactionManager?: GroupTransactionManager,
    ) {
        this.groupTransactionManager = groupTransactionManager ?? new GroupTransactionManager(this.firestoreReader, this.firestoreWriter);
    }

    private resolveExpirationTimestamp(requestedExpiresAt?: string): ISOString {
        const nowMs = Date.now();

        if (requestedExpiresAt) {
            const parsed = new Date(requestedExpiresAt);
            if (Number.isNaN(parsed.getTime())) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPIRATION', 'Invalid share link expiration timestamp');
            }

            const expiresAtMs = parsed.getTime();
            if (expiresAtMs <= nowMs) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPIRATION', 'Share link expiration must be in the future');
            }

            const maxAllowed = nowMs + SHARE_LINK_MAX_EXPIRATION_MS + SHARE_LINK_EXPIRATION_DRIFT_MS;
            if (expiresAtMs > maxAllowed) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPIRATION', 'Share link expiration exceeds the maximum allowed duration');
            }

            return toISOString(new Date(expiresAtMs).toISOString());
        }

        return toISOString(new Date(nowMs + SHARE_LINK_DEFAULT_EXPIRATION_MS).toISOString());
    }

    generateUniqueThemeColor(
        groupId: GroupId,
        existingThemes: Iterable<UserThemeColor | null | undefined>,
        assignedAt: ISOString,
        joiningUserId?: UserId,
    ): UserThemeColor {
        const usedKeys = new Set<string>();
        for (const theme of existingThemes) {
            const key = this.toThemeKey(theme);
            if (key) {
                usedKeys.add(key);
            }
        }

        const availableCombinations: Array<{ colorIndex: number; pattern: (typeof COLOR_PATTERNS)[number]; }> = [];

        for (let colorIndex = 0; colorIndex < USER_COLORS.length; colorIndex++) {
            for (const pattern of COLOR_PATTERNS) {
                const combinationKey = this.themeKeyFromIndexes(colorIndex, pattern);
                if (!usedKeys.has(combinationKey)) {
                    availableCombinations.push({ colorIndex, pattern });
                }
            }
        }

        if (availableCombinations.length > 0) {
            const selection = availableCombinations[Math.floor(Math.random() * availableCombinations.length)];
            return this.buildTheme(selection.colorIndex, selection.pattern, assignedAt);
        }

        logger.warn('Unique theme combinations exhausted for group; reusing existing combination', {
            groupId,
            joiningUserId,
            usedCombinationCount: usedKeys.size,
            totalCombinationCount: USER_COLORS.length * COLOR_PATTERNS.length,
        });

        const fallbackColorIndex = Math.floor(Math.random() * USER_COLORS.length);
        const fallbackPattern = COLOR_PATTERNS[Math.floor(Math.random() * COLOR_PATTERNS.length)];
        return this.buildTheme(fallbackColorIndex, fallbackPattern, assignedAt);
    }

    private toThemeKey(theme: UserThemeColor | null | undefined): string | null {
        if (!theme) {
            return null;
        }

        if (typeof theme.colorIndex === 'number' && theme.colorIndex >= 0) {
            return this.themeKeyFromIndexes(theme.colorIndex, theme.pattern);
        }

        if (theme.light && theme.pattern) {
            return `${theme.light}:${theme.pattern}`;
        }

        return null;
    }

    private themeKeyFromIndexes(colorIndex: number, pattern: (typeof COLOR_PATTERNS)[number]): string {
        return `${colorIndex}:${pattern}`;
    }

    private buildTheme(colorIndex: number, pattern: (typeof COLOR_PATTERNS)[number], assignedAt: ISOString): UserThemeColor {
        const color = USER_COLORS[colorIndex];
        return {
            light: color.light,
            dark: color.dark,
            name: color.name,
            pattern,
            assignedAt,
            colorIndex,
        };
    }

    private async findShareLinkByToken(shareToken: ShareLinkToken): Promise<
        | { status: 'valid'; groupId: GroupId; shareLink: ShareLinkDTO; }
        | { status: 'expired'; }
        | { status: 'missing'; }
    > {
        const lookup = await this.firestoreReader.findShareLinkByToken(shareToken);

        if (!lookup) {
            return { status: 'missing' };
        }

        if (!lookup.shareLink) {
            await this.deleteShareLinkAndIndex(lookup.groupId, lookup.shareLinkId, shareToken);
            return { status: 'missing' };
        }

        const shareLink: ShareLinkDTO = {
            id: lookup.shareLink.id,
            token: lookup.shareLink.token,
            createdBy: lookup.shareLink.createdBy,
            createdAt: lookup.shareLink.createdAt,
            updatedAt: lookup.shareLink.updatedAt,
            expiresAt: lookup.shareLink.expiresAt,
        };

        if (new Date(shareLink.expiresAt).getTime() <= Date.now()) {
            await this.deleteShareLinkAndIndex(lookup.groupId, shareLink.id, shareLink.token);
            return { status: 'expired' };
        }

        return {
            status: 'valid',
            groupId: lookup.groupId,
            shareLink,
        };
    }

    private async deleteShareLinkAndIndex(groupId: GroupId, shareLinkId: ShareLinkId, shareToken: ShareLinkToken): Promise<void> {
        await this.firestoreWriter.deleteShareLink(groupId, shareLinkId, shareToken).catch((error) => {
            logger.error('Failed to delete expired share link', error, {
                groupId,
                shareLinkId,
                shareToken,
            });
        });
    }

    async generateShareableLink(
        userId: UserId,
        groupId: GroupId,
        expiresAt?: string,
    ): Promise<{
        shareablePath: string;
        shareToken: ShareLinkToken;
        expiresAt: string;
    }> {
        return measure.measureDb('GroupShareService.generateShareableLink', async () => this._generateShareableLink(userId, groupId, expiresAt));
    }

    private async _generateShareableLink(
        userId: UserId,
        groupId: GroupId,
        expiresAt?: string,
    ): Promise<{
        shareablePath: string;
        shareToken: ShareLinkToken;
        expiresAt: string;
    }> {
        const timer = new PerformanceTimer();
        const resolvedExpiresAt = this.resolveExpirationTimestamp(expiresAt);
        let expiredLinksRemoved = 0;

        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        timer.startPhase('query');
        const [group, isMember] = await Promise.all([
            this.firestoreReader.getGroup(groupId),
            this.groupMemberService.isGroupMemberAsync(groupId, userId),
        ]);

        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        if (!isMember) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'UNAUTHORIZED', 'Only group members can generate share links');
        }

        const shareTokenString = generateShareToken();
        const shareToken = toShareLinkToken(shareTokenString);
        timer.endPhase();

        timer.startPhase('transaction');
        await this.groupTransactionManager.run(groupId, { preloadBalance: false }, async (context) => {
            const transaction = context.transaction;
            // CRITICAL: All reads must happen before all writes in Firestore transactions

            // Read 1: Check group exists
            const freshGroupDoc = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
            if (!freshGroupDoc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const now = toISOString(new Date().toISOString());

            // Read 2: Find expired link document references (must happen before any writes)
            const expiredLinkRefs = await this.firestoreReader.getExpiredShareLinkRefsInTransaction(transaction, groupId, now);

            // All reads complete - now perform writes

            const shareLinkData: Omit<ShareLinkDTO, 'id'> = {
                token: shareToken,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
                expiresAt: resolvedExpiresAt,
            };

            // Write 1: Create new share link
            try {
                const validatedShareLinkData = ShareLinkDataSchema.parse(shareLinkData);
                this.firestoreWriter.createShareLinkInTransaction(transaction, groupId, validatedShareLinkData);
            } catch (error) {
                logger.error('ShareLink data validation failed before write', error as Error, {
                    groupId,
                    createdBy: userId,
                    validationErrors: error instanceof z.ZodError ? error.issues : undefined,
                });
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_SHARELINK_DATA', 'Failed to create share link due to invalid data structure');
            }

            // Write 2: Delete expired links
            try {
                for (const ref of expiredLinkRefs) {
                    transaction.delete(ref);
                    expiredLinksRemoved += 1;
                }
            } catch (cleanupError) {
                logger.error('Failed to delete expired share links during creation', cleanupError as Error, {
                    groupId,
                });
            }
        });
        timer.endPhase();

        const shareablePath = `/join?shareToken=${shareToken}`;

        LoggerContext.setBusinessContext({ groupId });
        logger.info('share-link-created', {
            id: shareToken,
            groupId,
            createdBy: userId,
            expiresAt: resolvedExpiresAt,
            expiredLinksRemoved,
            timings: timer.getTimings(),
        });

        return {
            shareablePath,
            shareToken,
            expiresAt: resolvedExpiresAt,
        };
    }

    async previewGroupByLink(
        userId: UserId,
        shareToken: ShareLinkToken,
    ): Promise<{
        groupId: GroupId;
        groupName: GroupName;
        groupDescription: string;
        memberCount: number;
        isAlreadyMember: boolean;
    }> {
        if (!shareToken) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const shareLinkLookup = await this.findShareLinkByToken(shareToken);

        if (shareLinkLookup.status === 'missing') {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        if (shareLinkLookup.status === 'expired') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'LINK_EXPIRED', 'This invitation link has expired. Please request a new one from the group admin.');
        }

        const { groupId } = shareLinkLookup;

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }
        const isAlreadyMember = await this.groupMemberService.isGroupMemberAsync(group.id, userId);

        // Get member count from subcollection
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(group.id);

        return {
            groupId: group.id,
            groupName: group.name,
            groupDescription: group.description || '',
            memberCount: memberIds.length,
            isAlreadyMember,
        };
    }

    async joinGroupByLink(userId: UserId, shareToken: ShareLinkToken, groupDisplayName: DisplayName): Promise<JoinGroupResponse> {
        return measure.measureDb('GroupShareService.joinGroupByLink', async () => this._joinGroupByLink(userId, shareToken, groupDisplayName));
    }

    private async _joinGroupByLink(userId: UserId, shareToken: ShareLinkToken, groupDisplayName: DisplayName): Promise<JoinGroupResponse> {
        const timer = new PerformanceTimer();

        if (!shareToken) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        // Performance optimization: Find shareLink outside transaction
        timer.startPhase('query');
        const shareLinkLookup = await this.findShareLinkByToken(shareToken);

        if (shareLinkLookup.status === 'missing') {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        if (shareLinkLookup.status === 'expired') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'LINK_EXPIRED', 'This invitation link has expired. Please request a new one from the group admin.');
        }

        const { groupId, shareLink } = shareLinkLookup;

        // Pre-validate group exists outside transaction to fail fast
        const preCheckGroup = await this.firestoreReader.getGroup(groupId);
        if (!preCheckGroup) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }
        const requiresApproval = preCheckGroup.permissions?.memberApproval === 'admin-required';

        // Early membership check to avoid transaction if user is already a member
        const existingMember = await this.firestoreReader.getGroupMember(groupId, userId);
        if (existingMember) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already a member of this group');
        }
        if (await this.groupMemberService.isGroupOwnerAsync(preCheckGroup.id, userId)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already the owner of this group');
        }

        // Pre-compute member data outside transaction for speed
        const joinedAt = toISOString(new Date().toISOString());

        // Check for display name conflicts
        const {
            existingMembers,
            displayNameConflict,
        } = await this.userService.checkDisplayNameConflict(groupId, groupDisplayName);

        if (displayNameConflict) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                'DISPLAY_NAME_CONFLICT',
                `The name "${groupDisplayName}" is already in use by another member. Please choose a different name.`,
            );
        }

        const existingMemberIds = existingMembers.map((member) => member.uid);

        // Enforce hard cap on group size
        if (existingMemberIds.length >= MAX_GROUP_MEMBERS) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'GROUP_AT_CAPACITY', `Cannot add member. Group has reached maximum size of ${MAX_GROUP_MEMBERS} members`);
        }

        const themeColor = this.generateUniqueThemeColor(
            groupId,
            existingMembers.map((member) => member.theme),
            joinedAt,
            userId,
        );
        const memberDoc: GroupMembershipDTO = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.MEMBER,
            theme: themeColor,
            joinedAt: joinedAt,
            memberStatus: requiresApproval ? MemberStatuses.PENDING : MemberStatuses.ACTIVE,
            invitedBy: shareLink.createdBy,
            groupDisplayName: groupDisplayName,
        };

        const now = toISOString(new Date().toISOString());
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: any = null;
        let activityRecipients: UserId[] = [];

        // Atomic transaction: check group exists and create member subcollection
        timer.startPhase('transaction');
        const result = await this.groupTransactionManager.run(groupId, { preloadBalance: false }, async (context) => {
            const transaction = context.transaction;
            const groupInTransaction = context.group;
            if (!groupInTransaction) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            timer.startPhase('transaction:getMemberships');
            const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
            timer.endPhase();

            timer.startPhase('transaction:touchGroup');
            // Update group timestamp to reflect membership change
            await context.touchGroup();
            timer.endPhase();

            timer.startPhase('transaction:createMembership');
            // Write to top-level collection for improved querying (using ISO strings - DTOs)
            const topLevelMemberDoc = {
                ...createTopLevelMembershipDocument(memberDoc, now),
                createdAt: now,
                updatedAt: now,
            };

            // FirestoreWriter.createInTransaction handles conversion and validation
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, newTopLevelMembershipDocId(userId, groupId), topLevelMemberDoc);
            timer.endPhase();

            // Note: Group notifications are handled by the trackGroupChanges trigger
            // which fires when the group's updatedAt timestamp is modified above

            if (!requiresApproval) {
                timer.startPhase('transaction:buildActivityRecipients');
                const activityRecipientsSet = new Set<string>();
                for (const doc of membershipsSnapshot.docs) {
                    const data = doc.data() as { uid?: string; memberStatus?: string; };
                    const uid = typeof data?.uid === 'string' ? data.uid : undefined;
                    if (!uid) {
                        continue;
                    }
                    if (data?.memberStatus && data.memberStatus !== MemberStatuses.ACTIVE) {
                        continue;
                    }
                    activityRecipientsSet.add(uid);
                }

                activityRecipientsSet.add(userId);
                timer.endPhase();

                // Build activity item - will be recorded AFTER transaction commits
                if (activityRecipientsSet.size > 0) {
                    timer.startPhase('transaction:buildActivityItem');
                    const groupName = groupInTransaction.name;

                    activityItem = this.activityFeedService.buildGroupActivityItem({
                        groupId,
                        groupName,
                        eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                        action: ActivityFeedActions.JOIN,
                        actorId: userId,
                        actorName: memberDoc.groupDisplayName,
                        timestamp: now,
                        details: this.activityFeedService.buildDetails({
                            targetUser: {
                                id: userId,
                                name: memberDoc.groupDisplayName,
                            },
                        }),
                    });
                    activityRecipients = Array.from(activityRecipientsSet);
                    timer.endPhase();
                }
            }

            return {
                groupName: preCheckGroup.name,
                invitedBy: shareLink.createdBy,
            };
        });

        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        logger.info('User joined group via share link', {
            groupId,
            userId,
            linkId: shareToken.substring(0, 4) + '...',
            invitedBy: result.invitedBy,
            memberStatus: memberDoc.memberStatus,
            timings: timer.getTimings(),
        });

        return {
            groupId,
            groupName: result.groupName,
            success: !requiresApproval,
            memberStatus: memberDoc.memberStatus,
        };
    }
}

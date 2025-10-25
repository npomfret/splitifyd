import { ActivityFeedActions, ActivityFeedEventTypes, COLOR_PATTERNS, MAX_GROUP_MEMBERS, MemberRoles, MemberStatuses, ShareLinkDTO, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import type { GroupMembershipDTO, JoinGroupResponse, UserId } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import type { GroupName } from '@splitifyd/shared';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../constants';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ShareLinkDataSchema } from '../schemas';
import { ApiError } from '../utils/errors';
import { createTopLevelMembershipDocument, getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';
import { ActivityFeedService } from './ActivityFeedService';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import type { GroupMemberService } from './GroupMemberService';

const SHARE_LINK_DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 1 day
const SHARE_LINK_MAX_EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const SHARE_LINK_EXPIRATION_DRIFT_MS = 5 * 60 * 1000; // Allow slight client/server drift (5 minutes)

export class GroupShareService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
        private readonly activityFeedService: ActivityFeedService,
    ) {}

    private resolveExpirationTimestamp(requestedExpiresAt?: string): string {
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

            return new Date(expiresAtMs).toISOString();
        }

        return new Date(nowMs + SHARE_LINK_DEFAULT_EXPIRATION_MS).toISOString();
    }

    private generateShareToken(): string {
        const bytes = randomBytes(12);
        const base64url = bytes.toString('base64url');
        return base64url.substring(0, 16);
    }

    getThemeColorForMember(memberIndex: number): UserThemeColor {
        const colorIndex = memberIndex % USER_COLORS.length;
        const patternIndex = Math.floor(memberIndex / USER_COLORS.length) % COLOR_PATTERNS.length;
        const color = USER_COLORS[colorIndex];
        const pattern = COLOR_PATTERNS[patternIndex];

        return {
            light: color.light,
            dark: color.dark,
            name: color.name,
            pattern,
            assignedAt: new Date().toISOString(),
            colorIndex,
        };
    }

    private async findShareLinkByToken(token: string): Promise<
        | { status: 'valid'; groupId: GroupId; shareLink: ShareLinkDTO; }
        | { status: 'expired'; }
        | { status: 'missing'; }
    > {
        const lookup = await this.firestoreReader.findShareLinkByToken(token);

        if (!lookup) {
            return { status: 'missing' };
        }

        if (!lookup.shareLink) {
            await this.deleteShareLinkAndIndex(lookup.groupId, lookup.shareLinkId, token);
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
            await this.deleteShareLinkAndIndex(lookup.groupId, shareLink.id, token);
            return { status: 'expired' };
        }

        return {
            status: 'valid',
            groupId: lookup.groupId,
            shareLink,
        };
    }

    private async deleteShareLinkAndIndex(groupId: GroupId, shareLinkId: string, token: string): Promise<void> {
        await this.firestoreWriter.deleteShareLink(groupId, shareLinkId, token).catch((error) => {
            logger.error('Failed to delete expired share link', error, {
                groupId,
                shareLinkId,
                token,
            });
        });
    }

    async generateShareableLink(
        userId: UserId,
        groupId: GroupId,
        expiresAt?: string,
    ): Promise<{
        shareablePath: string;
        linkId: string;
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
        linkId: string;
        expiresAt: string;
    }> {
        const timer = new PerformanceTimer();
        const resolvedExpiresAt = this.resolveExpirationTimestamp(expiresAt);
        let expiredLinksRemoved = 0;

        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        timer.startPhase('query');
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        if (!(await this.groupMemberService.isGroupOwnerAsync(group.id, userId)) && !(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'UNAUTHORIZED', 'Only group members can generate share links');
        }

        const shareToken = this.generateShareToken();
        timer.endPhase();

        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // CRITICAL: All reads must happen before all writes in Firestore transactions

            // Read 1: Check group exists
            const freshGroupDoc = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
            if (!freshGroupDoc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const now = new Date().toISOString();

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

        const shareablePath = `/join?linkId=${shareToken}`;

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
            linkId: shareToken,
            expiresAt: resolvedExpiresAt,
        };
    }

    async previewGroupByLink(
        userId: UserId,
        linkId: string,
    ): Promise<{
        groupId: GroupId;
        groupName: GroupName;
        groupDescription: string;
        memberCount: number;
        isAlreadyMember: boolean;
    }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const shareLinkLookup = await this.findShareLinkByToken(linkId);

        if (shareLinkLookup.status === 'missing') {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        if (shareLinkLookup.status === 'expired') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'LINK_EXPIRED', 'This invitation link has expired. Please request a new one from the group admin.');
        }

        const { groupId, shareLink } = shareLinkLookup;

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

    async joinGroupByLink(userId: UserId, linkId: string): Promise<JoinGroupResponse> {
        return measure.measureDb('GroupShareService.joinGroupByLink', async () => this._joinGroupByLink(userId, linkId));
    }

    private async _joinGroupByLink(userId: UserId, linkId: string): Promise<JoinGroupResponse> {
        const timer = new PerformanceTimer();

        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        // Performance optimization: Find shareLink outside transaction
        timer.startPhase('query');
        const shareLinkLookup = await this.findShareLinkByToken(linkId);

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
        const joinedAt = new Date().toISOString();
        const existingMembersIds = await this.firestoreReader.getAllGroupMemberIds(groupId);

        // Enforce hard cap on group size
        if (existingMembersIds.length >= MAX_GROUP_MEMBERS) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'GROUP_AT_CAPACITY', `Cannot add member. Group has reached maximum size of ${MAX_GROUP_MEMBERS} members`);
        }

        const memberIndex = existingMembersIds.length;

        // Get user's display name to set as initial groupDisplayName
        const userData = await this.firestoreReader.getUser(userId);
        if (!userData || !userData.displayName) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User profile not found');
        }

        // Check for display name conflicts with existing members
        const existingMembers = await this.firestoreReader.getAllGroupMembers(groupId);
        const displayNameConflict = existingMembers.some(
            (member) => member.groupDisplayName.toLowerCase() === userData.displayName.toLowerCase(),
        );

        const themeColor = this.getThemeColorForMember(memberIndex);
        const memberDoc: GroupMembershipDTO = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.MEMBER,
            theme: themeColor,
            joinedAt: joinedAt,
            memberStatus: requiresApproval ? MemberStatuses.PENDING : MemberStatuses.ACTIVE,
            invitedBy: shareLink.createdBy,
            groupDisplayName: userData.displayName, // Default to user's account display name
        };

        const now = new Date().toISOString();
        timer.endPhase();

        const shouldEmitJoinedActivity = !requiresApproval;
        const activityRecipients = shouldEmitJoinedActivity ? Array.from(new Set<string>([...existingMembersIds, userId])) : [];

        // Atomic transaction: check group exists and create member subcollection
        timer.startPhase('transaction');
        const result = await this.firestoreWriter.runTransaction(async (transaction) => {
            const groupSnapshot = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);

            if (!groupSnapshot) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            // Update group timestamp to reflect membership change
            await this.firestoreWriter.touchGroup(groupId, transaction);

            // Write to top-level collection for improved querying (using ISO strings - DTOs)
            const topLevelMemberDoc = {
                ...createTopLevelMembershipDocument(memberDoc, now),
                createdAt: now,
                updatedAt: now,
            };

            // FirestoreWriter.createInTransaction handles conversion and validation
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, getTopLevelMembershipDocId(userId, groupId), topLevelMemberDoc);

            // Note: Group notifications are handled by the trackGroupChanges trigger
            // which fires when the group's updatedAt timestamp is modified above

            if (shouldEmitJoinedActivity && activityRecipients.length > 0) {
                const groupName = (groupSnapshot.data() as { name?: string; } | undefined)?.name ?? preCheckGroup.name;
                this.activityFeedService.recordActivityForUsers(
                    transaction,
                    activityRecipients,
                    {
                        groupId,
                        groupName,
                        eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                        action: ActivityFeedActions.JOIN,
                        actorId: userId,
                        actorName: memberDoc.groupDisplayName,
                        timestamp: now,
                        details: {
                            targetUserId: userId,
                            targetUserName: memberDoc.groupDisplayName,
                        },
                    },
                );
            }

            return {
                groupName: preCheckGroup.name,
                invitedBy: shareLink.createdBy,
            };
        });

        timer.endPhase();

        logger.info('User joined group via share link', {
            groupId,
            userId,
            linkId: linkId.substring(0, 4) + '...',
            invitedBy: result.invitedBy,
            displayNameConflict,
            memberStatus: memberDoc.memberStatus,
            timings: timer.getTimings(),
        });

        return {
            groupId,
            groupName: result.groupName,
            success: !requiresApproval,
            displayNameConflict,
            memberStatus: memberDoc.memberStatus,
        };
    }
}

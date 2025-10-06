import { randomBytes } from 'crypto';
import { z } from 'zod';
import { ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import { HTTP_STATUS } from '../constants';
import { COLOR_PATTERNS, MAX_GROUP_MEMBERS, MemberRoles, MemberStatuses, ShareLinkDTO, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import * as measure from '../monitoring/measure';
import { ShareLinkDataSchema } from '../schemas';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import type { GroupMemberService } from './GroupMemberService';
import { createTopLevelMembershipDocument, getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';
import { FirestoreCollections } from '../constants';
import type { GroupMembershipDTO } from '@splitifyd/shared';

export class GroupShareService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
    ) {}

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

    private async findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ShareLinkDTO }> {
        const result = await this.firestoreReader.findShareLinkByToken(token);

        if (!result) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        // Convert ParsedShareLink to ShareLink format expected by this service
        const shareLink: ShareLinkDTO = {
            id: result.shareLink.id,
            token: result.shareLink.token,
            createdBy: result.shareLink.createdBy,
            createdAt: result.shareLink.createdAt,
            updatedAt: result.shareLink.updatedAt,
            expiresAt: result.shareLink.expiresAt,
            isActive: result.shareLink.isActive,
        };

        return { groupId: result.groupId, shareLink };
    }

    async generateShareableLink(
        userId: string,
        groupId: string,
    ): Promise<{
        shareablePath: string;
        linkId: string;
    }> {
        return measure.measureDb('GroupShareService.generateShareableLink', async () => this._generateShareableLink(userId, groupId));
    }

    private async _generateShareableLink(
        userId: string,
        groupId: string,
    ): Promise<{
        shareablePath: string;
        linkId: string;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        if (!(await this.groupMemberService.isGroupOwnerAsync(group.id, userId)) && !(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'UNAUTHORIZED', 'Only group members can generate share links');
        }

        const shareToken = this.generateShareToken();

        await this.firestoreWriter.runTransaction(async (transaction) => {
            const freshGroupDoc = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
            if (!freshGroupDoc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const now = new Date().toISOString();
            const shareLinkData: Omit<ShareLinkDTO, 'id'> = {
                token: shareToken,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
                isActive: true,
            };

            // Validate share link data before writing to Firestore
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
        });

        const shareablePath = `/join?linkId=${shareToken}`;

        LoggerContext.setBusinessContext({ groupId });
        logger.info('share-link-created', { id: shareToken, groupId, createdBy: userId });

        return {
            shareablePath,
            linkId: shareToken,
        };
    }

    async previewGroupByLink(
        userId: string,
        linkId: string,
    ): Promise<{
        groupId: string;
        groupName: string;
        groupDescription: string;
        memberCount: number;
        isAlreadyMember: boolean;
    }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const { groupId } = await this.findShareLinkByToken(linkId);

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

    async joinGroupByLink(userId: string, linkId: string,): Promise<{ groupId: string; groupName: string; message: string; success: boolean }> {
        return measure.measureDb('GroupShareService.joinGroupByLink', async () => this._joinGroupByLink(userId, linkId));
    }

    private async _joinGroupByLink(userId: string, linkId: string,): Promise<{ groupId: string; groupName: string; message: string; success: boolean }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        // Performance optimization: Find shareLink outside transaction
        const { groupId, shareLink } = await this.findShareLinkByToken(linkId);

        // Pre-validate group exists outside transaction to fail fast
        const preCheckGroup = await this.firestoreReader.getGroup(groupId);
        if (!preCheckGroup) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

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

        const themeColor = this.getThemeColorForMember(memberIndex);
        const memberDoc: GroupMembershipDTO = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.MEMBER,
            theme: themeColor,
            joinedAt: joinedAt,
            memberStatus: MemberStatuses.ACTIVE,
            invitedBy: shareLink.createdBy,
        };

        const now = new Date().toISOString();

        // Atomic transaction: check group exists and create member subcollection
        const result = await this.firestoreWriter.runTransaction(
            async (transaction) => {
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

                return {
                    groupName: preCheckGroup.name,
                    invitedBy: shareLink.createdBy,
                };
            },
            {
                maxAttempts: 3,
                baseDelayMs: 100,
                context: {
                    operation: 'joinGroupByLink',
                    userId,
                    groupId,
                    linkId: linkId.substring(0, 4) + '...',
                },
            },
        );

        logger.info('User joined group via share link', {
            groupId,
            userId,
            linkId: linkId.substring(0, 4) + '...',
            invitedBy: result.invitedBy,
        });

        return {
            groupId,
            groupName: result.groupName,
            message: 'Successfully joined group',
            success: true,
        };
    }
}

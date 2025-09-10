import {randomBytes} from 'crypto';
import {z} from 'zod';
import {ApiError} from '../utils/errors';
import {logger, LoggerContext} from '../logger';
import {HTTP_STATUS} from '../constants';
import {COLOR_PATTERNS, FirestoreCollections, GroupMemberDocument, MemberRoles, MemberStatuses, ShareLink, USER_COLORS, UserThemeColor} from '@splitifyd/shared';
import {createTrueServerTimestamp, timestampToISO} from '../utils/dateHelpers';
import {measureDb} from '../monitoring/measure';
import {ShareLinkDataSchema} from '../schemas/sharelink';
import type {IFirestoreReader} from './firestore/IFirestoreReader';
import type {IFirestoreWriter} from './firestore/IFirestoreWriter';
import type {GroupMemberService} from './GroupMemberService';
import { createTopLevelMembershipDocument, getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';

export class GroupShareService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService
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

    private async findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ShareLink }> {
        const result = await this.firestoreReader.findShareLinkByToken(token);
        
        if (!result) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        // Convert ParsedShareLink to ShareLink format expected by this service
        const shareLink: ShareLink = {
            id: result.shareLink.id,
            token: result.shareLink.token,
            createdBy: result.shareLink.createdBy,
            createdAt: result.shareLink.createdAt,
            expiresAt: result.shareLink.expiresAt,
            isActive: result.shareLink.isActive,
        };

        return { groupId: result.groupId, shareLink };
    }


    async generateShareableLink(userId: string, groupId: string): Promise<{
        shareablePath: string;
        linkId: string;
    }> {
        return measureDb('GroupShareService.generateShareableLink', async () => this._generateShareableLink(userId, groupId));
    }

    private async _generateShareableLink(userId: string, groupId: string): Promise<{
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

            const shareLinkData: Omit<ShareLink, 'id'> = {
                token: shareToken,
                createdBy: userId,
                createdAt: new Date().toISOString(),
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

    async previewGroupByLink(userId: string, linkId: string): Promise<{
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
        const memberDocs = await this.groupMemberService.getAllGroupMembers(group.id);

        return {
            groupId: group.id,
            groupName: group.name,
            groupDescription: group.description || '',
            memberCount: memberDocs.length,
            isAlreadyMember,
        };
    }

    async joinGroupByLink(userId: string, userEmail: string, linkId: string): Promise<{
        groupId: string;
        groupName: string;
        message: string;
        success: boolean;
    }> {
        return measureDb('GroupShareService.joinGroupByLink', async () => this._joinGroupByLink(userId, userEmail, linkId));
    }

    private async _joinGroupByLink(userId: string, userEmail: string, linkId: string): Promise<{
        groupId: string;
        groupName: string;
        message: string;
        success: boolean;
    }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const userName = userEmail.split('@')[0];
        
        // Performance optimization: Find shareLink outside transaction
        const { groupId, shareLink } = await this.findShareLinkByToken(linkId);
        
        // Pre-validate group exists outside transaction to fail fast
        const preCheckGroup = await this.firestoreReader.getGroup(groupId);
        if (!preCheckGroup) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Early membership check to avoid transaction if user is already a member
        const existingMember = await this.groupMemberService.getGroupMember(groupId, userId);
        if (existingMember) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already a member of this group');
        }
        if (await this.groupMemberService.isGroupOwnerAsync(preCheckGroup.id, userId)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already the owner of this group');
        }

        // Pre-compute member data outside transaction for speed
        const joinedAt = new Date().toISOString();
        const existingMembers = await this.groupMemberService.getAllGroupMembers(groupId);
        const memberIndex = existingMembers.length;
        
        const memberDoc: GroupMemberDocument = {
            userId: userId,
            groupId: groupId,
            memberRole: MemberRoles.MEMBER,
            theme: this.getThemeColorForMember(memberIndex),
            joinedAt,
            memberStatus: MemberStatuses.ACTIVE,
            invitedBy: shareLink.createdBy,
        };
        
        const serverTimestamp = createTrueServerTimestamp();
        const memberDocWithTimestamps = {
            ...memberDoc,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
        };

        // Atomic transaction: check group exists and create member subcollection
        const result = await this.firestoreWriter.runTransaction(
            async (transaction) => {
                const groupSnapshot = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);

                if (!groupSnapshot) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
                }

                // Update group timestamp to reflect membership change
                const groupDocumentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
                this.firestoreWriter.updateInTransaction(transaction, groupDocumentPath, {
                    updatedAt: createTrueServerTimestamp()
                });

                // Write to top-level collection for improved querying
                const now = new Date();
                const topLevelMemberDoc = createTopLevelMembershipDocument(
                    memberDoc,
                    timestampToISO(now) // Use current timestamp since group was just updated
                );
                
                this.firestoreWriter.createInTransaction(
                    transaction,
                    FirestoreCollections.GROUP_MEMBERSHIPS,
                    getTopLevelMembershipDocId(userId, groupId),
                    {
                        ...topLevelMemberDoc,
                        createdAt: serverTimestamp,
                        updatedAt: serverTimestamp,
                    }
                );

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
                }
            }
        );

        logger.info('User joined group via share link', {
            groupId,
            userId,
            userName,
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
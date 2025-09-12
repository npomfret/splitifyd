import { ICommentStrategy } from './ICommentStrategy';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { FirestoreCollections } from '@splitifyd/shared';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';

/**
 * Strategy for handling comments on group entities
 *
 * Groups are directly commentable entities where:
 * - Access verification checks group membership
 * - Group ID is the target ID itself
 * - Comments are stored in the group's comments subcollection
 */
export class GroupCommentStrategy implements ICommentStrategy {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    async verifyAccess(targetId: string, userId: string): Promise<void> {
        // For group comments, verify user is a group member
        const group = await this.firestoreReader.getGroup(targetId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        if (!(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }
    }

    async resolveGroupId(targetId: string): Promise<string> {
        // For group comments, the target ID is the group ID
        return targetId;
    }

    getCollectionPath(targetId: string): string {
        return `${FirestoreCollections.GROUPS}/${targetId}/${FirestoreCollections.COMMENTS}`;
    }
}

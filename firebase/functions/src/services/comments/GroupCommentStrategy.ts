import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';
import { ICommentStrategy } from './ICommentStrategy';
import type {GroupId, UserId } from '@splitifyd/shared';

/**
 * Strategy for handling comments on group entities
 *
 * Groups are directly commentable entities where:
 * - Access verification checks group membership
 * - Group ID is the target ID itself
 * - Comments are stored in the group's comments subcollection
 */
export class GroupCommentStrategy implements ICommentStrategy<GroupId> {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    async verifyAccess(groupId: GroupId, userId: UserId): Promise<void> {
        // For group comments, verify user is a group member
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        if (!(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }
    }
}

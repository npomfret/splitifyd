import type { GroupId, UserId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';
import { ICommentStrategy } from './ICommentStrategy';

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
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        if (!(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }
    }
}

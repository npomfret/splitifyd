import type { GroupName, PreviewGroupResponse } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import { toGroupId, toGroupName } from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating PreviewGroupResponse objects for tests
 */
export class PreviewGroupResponseBuilder {
    private fields: PreviewGroupResponse = {
        groupId: toGroupId(`group-${generateShortId()}`),
        groupName: toGroupName('Test Group'),
        groupDescription: 'Test group description',
        memberCount: 1,
        isAlreadyMember: false,
    };

    withGroupId(groupId: GroupId | string): this {
        this.fields.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withGroupName(groupName: GroupName | string): this {
        this.fields.groupName = typeof groupName === 'string' ? toGroupName(groupName) : groupName;
        return this;
    }

    withGroupDescription(groupDescription: string): this {
        this.fields.groupDescription = groupDescription;
        return this;
    }

    withMemberCount(memberCount: number): this {
        this.fields.memberCount = memberCount;
        return this;
    }

    withIsAlreadyMember(isAlreadyMember: boolean): this {
        this.fields.isAlreadyMember = isAlreadyMember;
        return this;
    }

    build(): PreviewGroupResponse {
        return { ...this.fields };
    }

    /**
     * Creates a preview for a user who is already a member
     */
    static alreadyMember(): PreviewGroupResponseBuilder {
        return new PreviewGroupResponseBuilder()
            .withIsAlreadyMember(true);
    }

    /**
     * Creates a preview for a new user who can join
     */
    static newMember(): PreviewGroupResponseBuilder {
        return new PreviewGroupResponseBuilder()
            .withIsAlreadyMember(false);
    }
}

import type { PreviewGroupResponse } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating PreviewGroupResponse objects for tests
 */
export class PreviewGroupResponseBuilder {
    private fields: PreviewGroupResponse = {
        groupId: `group-${generateShortId()}`,
        groupName: 'Test Group',
        groupDescription: 'Test group description',
        memberCount: 1,
        isAlreadyMember: false,
    };

    withGroupId(groupId: string): this {
        this.fields.groupId = groupId;
        return this;
    }

    withGroupName(groupName: string): this {
        this.fields.groupName = groupName;
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

import type { JoinGroupResponse, MemberStatus } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import type { GroupName } from '@splitifyd/shared';
import { toGroupId, toGroupName } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating JoinGroupResponse objects for tests
 */
export class JoinGroupResponseBuilder {
    private fields: JoinGroupResponse = {
        groupId: toGroupId(`group-${generateShortId()}`),
        groupName: toGroupName('Test Group'),
        success: true,
        displayNameConflict: false,
        memberStatus: 'active',
    };

    withGroupId(groupId: GroupId | string): this {
        this.fields.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withGroupName(groupName: GroupName | string): this {
        this.fields.groupName = typeof groupName === 'string' ? toGroupName(groupName) : groupName;
        return this;
    }

    withSuccess(success: boolean): this {
        this.fields.success = success;
        return this;
    }

    withDisplayNameConflict(conflict: boolean): this {
        this.fields.displayNameConflict = conflict;
        return this;
    }

    withMemberStatus(status: MemberStatus): this {
        this.fields.memberStatus = status;
        return this;
    }

    build(): JoinGroupResponse {
        return { ...this.fields };
    }

    /**
     * Creates a successful join response
     */
    static success(groupName: GroupName | string = toGroupName('Test Group')): JoinGroupResponseBuilder {
        return new JoinGroupResponseBuilder()
            .withGroupName(groupName)
            .withSuccess(true)
            .withMemberStatus('active');
    }

}

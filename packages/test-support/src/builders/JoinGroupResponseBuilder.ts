import type { JoinGroupResponse, MemberStatus } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import type { GroupName } from '@billsplit-wl/shared';
import { toGroupId, toGroupName } from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating JoinGroupResponse objects for tests
 */
export class JoinGroupResponseBuilder {
    private fields: JoinGroupResponse = {
        groupId: toGroupId(`group-${generateShortId()}`),
        groupName: toGroupName('Test Group'),
        success: true,
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

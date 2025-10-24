import type { JoinGroupResponse, MemberStatus } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';
import type {GroupName} from "@splitifyd/shared";

/**
 * Builder for creating JoinGroupResponse objects for tests
 */
export class JoinGroupResponseBuilder {
    private fields: JoinGroupResponse = {
        groupId: `group-${generateShortId()}`,
        groupName: 'Test Group',
        success: true,
        displayNameConflict: false,
        memberStatus: 'active',
    };

    withGroupId(groupId: GroupId): this {
        this.fields.groupId = groupId;
        return this;
    }

    withGroupName(groupName: GroupName): this {
        this.fields.groupName = groupName;
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
    static success(groupName: GroupName = 'Test Group'): JoinGroupResponseBuilder {
        return new JoinGroupResponseBuilder()
            .withGroupName(groupName)
            .withSuccess(true)
            .withMemberStatus('active');
    }

    /**
     * Creates a failed join response
     */
    static failure(): JoinGroupResponseBuilder {
        return new JoinGroupResponseBuilder()
            .withSuccess(false)
            .withMemberStatus('pending');
    }
}

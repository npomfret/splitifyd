import type { JoinGroupResponse } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating JoinGroupResponse objects for tests
 */
export class JoinGroupResponseBuilder {
    private fields: JoinGroupResponse = {
        groupId: `group-${generateShortId()}`,
        groupName: 'Test Group',
        success: true,
    };

    withGroupId(groupId: string): this {
        this.fields.groupId = groupId;
        return this;
    }

    withGroupName(groupName: string): this {
        this.fields.groupName = groupName;
        return this;
    }

    withSuccess(success: boolean): this {
        this.fields.success = success;
        return this;
    }

    build(): JoinGroupResponse {
        return { ...this.fields };
    }

    /**
     * Creates a successful join response
     */
    static success(groupName: string = 'Test Group'): JoinGroupResponseBuilder {
        return new JoinGroupResponseBuilder()
            .withGroupName(groupName)
            .withSuccess(true);
    }

    /**
     * Creates a failed join response
     */
    static failure(): JoinGroupResponseBuilder {
        return new JoinGroupResponseBuilder()
            .withSuccess(false);
    }
}

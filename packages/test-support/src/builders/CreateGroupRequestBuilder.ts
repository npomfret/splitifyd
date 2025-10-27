import type { CreateGroupRequest, GroupName } from '@splitifyd/shared';
import { toGroupName } from '@splitifyd/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

export class CreateGroupRequestBuilder {
    private group: CreateGroupRequest;

    constructor() {
        this.group = {
            name: toGroupName(`${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(6)}`),
            description: `${randomChoice(['Fun', 'Cool', 'Awesome', 'Great', 'Nice'])} group ${generateShortId()}`,
        };
    }

    withName(name: GroupName | string): this {
        this.group.name = typeof name === 'string' ? toGroupName(name) : name;
        return this;
    }

    withDescription(description: string): this {
        this.group.description = description;
        return this;
    }

    build(): CreateGroupRequest {
        const result: CreateGroupRequest = {
            name: this.group.name,
        };

        if (this.group.description !== undefined) {
            result.description = this.group.description;
        }

        return result;
    }
}

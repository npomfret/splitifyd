import type { CreateGroupRequest, DisplayName, GroupName } from '@billsplit-wl/shared';
import { toGroupName } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

export class CreateGroupRequestBuilder {
    private group: CreateGroupRequest;

    constructor() {
        this.group = {
            name: toGroupName(`${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(6)}`),
            groupDisplayName: toDisplayName(`Member ${generateShortId()}`),
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

    withGroupDisplayName(displayName: DisplayName | string): this {
        this.group.groupDisplayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    build(): CreateGroupRequest {
        const result: CreateGroupRequest = {
            name: this.group.name,
            groupDisplayName: this.group.groupDisplayName,
        };

        if (this.group.description !== undefined) {
            result.description = this.group.description;
        }

        return result;
    }
}

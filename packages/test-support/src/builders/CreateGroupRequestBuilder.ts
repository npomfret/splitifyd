import type { CreateGroupRequest } from '@splitifyd/shared';
import { randomString, randomChoice, generateShortId } from '../test-helpers';

export class CreateGroupRequestBuilder {
    private group: CreateGroupRequest;

    constructor() {
        this.group = {
            name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(6)}`,
            description: `${randomChoice(['Fun', 'Cool', 'Awesome', 'Great', 'Nice'])} group ${generateShortId()}`,
        };
    }

    withName(name: string): this {
        this.group.name = name;
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

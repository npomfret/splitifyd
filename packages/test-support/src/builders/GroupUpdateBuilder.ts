import {GroupName, toGroupName, UpdateGroupRequest} from '@splitifyd/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

export class GroupUpdateBuilder {
    private update: Partial<UpdateGroupRequest>;

    constructor() {
        this.update = {
            name: toGroupName(`${randomChoice(['Updated', 'New', 'Modified', 'Changed'])} ${randomChoice(['Team', 'Group', 'Squad', 'Club'])} ${randomString(4)}`),
            description: `${randomChoice(['Updated', 'Modified', 'New'])} description ${generateShortId()}`,
        };
    }

    withName(name: string | GroupName): this {
        this.update.name = typeof name === 'string' ? toGroupName(name) : name;
        return this;
    }

    withDescription(description: string): this {
        this.update.description = description;
        return this;
    }

    build(): Partial<UpdateGroupRequest> {
        return {
            ...(this.update.name !== undefined && { name: this.update.name }),
            ...(this.update.description !== undefined && { description: this.update.description }),
        };
    }
}

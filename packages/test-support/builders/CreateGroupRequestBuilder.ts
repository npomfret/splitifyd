import { v4 as uuidv4 } from 'uuid';
import type { CreateGroupRequest } from '@splitifyd/shared';

export class CreateGroupRequestBuilder {
    private group: CreateGroupRequest;

    constructor() {
        this.group = {
            name: `Test Group ${uuidv4().slice(0, 8)}`,
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

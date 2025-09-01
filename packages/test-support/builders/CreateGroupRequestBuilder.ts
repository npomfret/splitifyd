import { v4 as uuidv4 } from 'uuid';
import type { CreateGroupRequest } from '@splitifyd/shared';
import {FirebaseUser} from "@splitifyd/shared";

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

    withMembers(users: FirebaseUser[]): this {
        // Store full member details
        this.group.members = users.map((user) => ({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
        }));
        return this;
    }

    build(): CreateGroupRequest {
        const result: CreateGroupRequest = {
            name: this.group.name,
        };

        if (this.group.description !== undefined) {
            result.description = this.group.description;
        }

        if (this.group.members !== undefined) {
            result.members = this.group.members;
        }

        return result;
    }
}

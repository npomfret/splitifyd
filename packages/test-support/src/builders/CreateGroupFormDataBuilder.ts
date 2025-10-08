import { generateShortId, randomString } from '../test-helpers';

export interface CreateGroupFormData {
    name?: string;
    description?: string;
}

export class CreateGroupFormDataBuilder {
    private data: CreateGroupFormData;

    constructor() {
        // Generate random defaults to ensure test isolation
        const id = generateShortId();
        this.data = {
            name: `Test Group ${id} ${randomString(6)}`,
            description: `Description for test group ${id} - ${randomString(8)}`,
        };
    }

    withName(name: string): this {
        this.data.name = name;
        return this;
    }

    withDescription(description: string): this {
        this.data.description = description;
        return this;
    }

    withoutName(): this {
        this.data.name = undefined;
        return this;
    }

    withoutDescription(): this {
        this.data.description = undefined;
        return this;
    }

    withEmptyFields(): this {
        this.data = {};
        return this;
    }

    build(): CreateGroupFormData {
        return {
            ...(this.data.name !== undefined && { name: this.data.name }),
            ...(this.data.description !== undefined && { description: this.data.description }),
        };
    }
}

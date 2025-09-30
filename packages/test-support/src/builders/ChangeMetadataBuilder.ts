import { generateShortId } from '../test-helpers';

export type ChangePriority = 'high' | 'medium' | 'low';

export interface ChangeMetadata {
    priority: ChangePriority;
    affectedUsers: string[];
    changedFields?: string[];
}

export class ChangeMetadataBuilder {
    private metadata: ChangeMetadata;

    constructor() {
        this.metadata = {
            priority: 'medium',
            affectedUsers: [`user-${generateShortId()}`],
            changedFields: ['testField'],
        };
    }

    withPriority(priority: ChangePriority): this {
        this.metadata.priority = priority;
        return this;
    }

    withAffectedUsers(users: string[]): this {
        this.metadata.affectedUsers = users;
        return this;
    }

    withChangedFields(fields: string[]): this {
        this.metadata.changedFields = fields;
        return this;
    }

    withoutChangedFields(): this {
        this.metadata.changedFields = undefined;
        return this;
    }

    asHighPriority(): this {
        this.metadata.priority = 'high';
        return this;
    }

    asMediumPriority(): this {
        this.metadata.priority = 'medium';
        return this;
    }

    asLowPriority(): this {
        this.metadata.priority = 'low';
        return this;
    }

    build(): ChangeMetadata {
        return {
            priority: this.metadata.priority,
            affectedUsers: [...this.metadata.affectedUsers],
            ...(this.metadata.changedFields && { changedFields: [...this.metadata.changedFields] }),
        };
    }
}
import { generateShortId } from '../test-helpers';

/**
 * ExpenseFormMember type represents a group member for display in expense form UI components.
 * This is a webapp-specific type, duplicated here to avoid cross-package dependencies.
 */
export interface ExpenseFormMember {
    uid: string;
    groupDisplayName: string;
    displayName?: string | null;
}

/**
 * Builder for creating ExpenseFormMember objects for testing.
 */
export class ExpenseFormMemberBuilder {
    private data: ExpenseFormMember;

    constructor() {
        const id = generateShortId();
        this.data = {
            uid: `user-${id}`,
            groupDisplayName: `User ${id}`,
            displayName: null,
        };
    }

    withUid(uid: string): this {
        this.data.uid = uid;
        return this;
    }

    withGroupDisplayName(name: string): this {
        this.data.groupDisplayName = name;
        return this;
    }

    withDisplayName(name: string | null): this {
        this.data.displayName = name;
        return this;
    }

    /**
     * Creates a builder with the specified uid prefix index (e.g., 'user-1', 'user-2')
     */
    static withIndex(index: number): ExpenseFormMemberBuilder {
        return new ExpenseFormMemberBuilder().withUid(`user-${index}`);
    }

    build(): ExpenseFormMember {
        return { ...this.data };
    }
}

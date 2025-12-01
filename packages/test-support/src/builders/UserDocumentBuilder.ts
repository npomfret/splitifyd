import { Timestamp } from '@billsplit-wl/firebase-simulator';
import type { SystemUserRole, UserId } from '@billsplit-wl/shared';
import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

interface UserDocument {
    id: UserId;
    email?: string;
    displayName?: string;
    role: SystemUserRole;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    preferredLanguage?: string;
}

/**
 * Builder for creating User document objects for seeding test databases
 * Used for db.seed() operations in unit tests
 */
export class UserDocumentBuilder {
    private data: UserDocument;

    constructor() {
        const userId = toUserId(`user-${generateShortId()}`);
        this.data = {
            id: userId,
            email: `${userId}@test.com`,
            role: SystemUserRoles.SYSTEM_USER,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
    }

    withId(id: UserId | string): this {
        this.data.id = typeof id === 'string' ? toUserId(id) : id;
        return this;
    }

    withEmail(email: string): this {
        this.data.email = email;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.data.displayName = displayName;
        return this;
    }

    withRole(role: SystemUserRole): this {
        this.data.role = role;
        return this;
    }

    withPreferredLanguage(language: string): this {
        this.data.preferredLanguage = language;
        return this;
    }

    build(): UserDocument {
        return { ...this.data };
    }
}

import type { GroupPermissions } from '@billsplit-wl/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

/**
 * Builder for raw Firestore group documents (with Timestamps)
 * Used for testing Firestore read resilience with seeded data
 *
 * Unlike GroupDTOBuilder which produces DTOs with ISO strings,
 * this builder produces raw Firestore documents with Timestamp objects.
 */
export class GroupDocumentBuilder {
    private doc: Record<string, unknown>;

    constructor() {
        const now = Timestamp.now();
        this.doc = {
            id: `group-${generateShortId()}`,
            name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(4)}`,
            description: `A test group for ${randomString(6)}`,
            permissions: {
                expenseEditing: 'anyone',
                expenseDeletion: 'anyone',
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'admin-only',
            },
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
    }

    withId(id: string): this {
        this.doc.id = id;
        return this;
    }

    withName(name: string): this {
        this.doc.name = name;
        return this;
    }

    withDescription(description: string | undefined): this {
        this.doc.description = description;
        return this;
    }

    withPermissions(permissions: Partial<GroupPermissions>): this {
        this.doc.permissions = {
            ...(this.doc.permissions as GroupPermissions),
            ...permissions,
        };
        return this;
    }

    withCreatedAt(timestamp: Timestamp): this {
        this.doc.createdAt = timestamp;
        return this;
    }

    withUpdatedAt(timestamp: Timestamp): this {
        this.doc.updatedAt = timestamp;
        return this;
    }

    withDeletedAt(timestamp: Timestamp | null): this {
        this.doc.deletedAt = timestamp;
        return this;
    }

    /**
     * Add an arbitrary extra field to the document.
     * Useful for testing schema evolution tolerance.
     */
    withExtraField(key: string, value: unknown): this {
        this.doc[key] = value;
        return this;
    }

    /**
     * Build the raw Firestore document (with Timestamps)
     */
    build(): Record<string, unknown> {
        return {
            ...this.doc,
            permissions: { ...(this.doc.permissions as object) },
        };
    }
}

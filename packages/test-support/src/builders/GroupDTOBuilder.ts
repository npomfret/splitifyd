import type { GroupDTO, GroupPermissions, UserThemeColor } from '@splitifyd/shared';
import { MemberRoles, MemberStatuses, UserId } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, randomChoice, randomString, timestampToISOString } from '../test-helpers';

/**
 * Builder for creating Group objects for tests
 * Supports both client format (Group) and server format (GroupDocument)
 */
export class GroupDTOBuilder {
    // Infrastructure audit metadata
    private auditFields = {
        id: `group-${generateShortId()}`,
        createdAt: new Date() as Date | string | { toDate(): Date; },
        updatedAt: new Date() as Date | string | { toDate(): Date; },
    };
    private deletionFields = {
        deletedAt: null as BuilderTimestamp | null,
    };

    // Business logic fields
    private businessFields: {
        createdBy: UserId;
        name: string;
        description?: string;
        permissions: GroupPermissions;
    } = {
        createdBy: `user-${generateShortId()}`,
        name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(4)}`,
        description: `A test group for ${randomString(6)}`,
        permissions: {
            expenseEditing: 'anyone',
            expenseDeletion: 'anyone',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'admin-only',
        },
    };

    // Server-specific fields (for Firestore)
    private firestoreFields: {
        members?: Record<string, any>;
        memberIds?: string[];
    } = {};

    // Client-specific fields (for API responses)
    private clientFields: {
        balance?: {
            balancesByCurrency: Record<string, any>;
        };
        lastActivity?: string;
    } = {};

    constructor() {
        // Set up default client fields
        this.clientFields = {
            balance: {
                balancesByCurrency: {},
            },
            lastActivity: '2 hours ago',
        };
    }

    withId(id: string): this {
        this.auditFields.id = id;
        return this;
    }

    withName(name: string): this {
        this.businessFields.name = name;
        return this;
    }

    withDescription(description: string): this {
        this.businessFields.description = description;
        return this;
    }

    withCreatedBy(userId: string): this {
        this.businessFields.createdBy = userId;

        // Also add as default admin member for Firestore format
        if (!this.firestoreFields.members) {
            this.firestoreFields.members = {};
        }
        this.firestoreFields.members[userId] = {
            role: MemberRoles.ADMIN,
            status: MemberStatuses.ACTIVE,
            joinedAt: new Date().toISOString(),
            color: this.createDefaultThemeColor(),
        };
        return this;
    }

    withPermissions(permissions: Partial<GroupPermissions>): this {
        this.businessFields.permissions = { ...this.businessFields.permissions, ...permissions };
        return this;
    }

    withCreatedAt(timestamp: BuilderTimestamp): this {
        this.auditFields.createdAt = timestamp;
        return this;
    }

    withUpdatedAt(timestamp: BuilderTimestamp): this {
        this.auditFields.updatedAt = timestamp;
        return this;
    }

    withDeletedAt(timestamp: BuilderTimestamp | null): this {
        this.deletionFields.deletedAt = timestamp;
        return this;
    }

    withLastActivity(activity: string): this {
        this.clientFields.lastActivity = activity;
        return this;
    }

    withBalance(balancesByCurrency: Record<string, any>): this {
        this.clientFields.balance = { balancesByCurrency };
        return this;
    }

    withMembers(members: Record<string, any>): this {
        this.firestoreFields.members = members;
        return this;
    }

    withMemberIds(memberIds: string[]): this {
        this.firestoreFields.memberIds = memberIds;
        return this;
    }

    withoutMemberIds(): this {
        delete this.firestoreFields.memberIds;
        return this;
    }

    /**
     * Helper method to create theme colors with different patterns for testing
     */
    private createDefaultThemeColor(): UserThemeColor {
        const colors = [
            { light: '#FF6B6B', dark: '#FF6B6B', name: 'Coral Red' },
            { light: '#4ECDC4', dark: '#4ECDC4', name: 'Teal' },
            { light: '#45B7D1', dark: '#45B7D1', name: 'Sky Blue' },
            { light: '#96CEB4', dark: '#96CEB4', name: 'Mint Green' },
            { light: '#FFEAA7', dark: '#FFEAA7', name: 'Sunny Yellow' },
        ];

        const color = randomChoice(colors);
        return {
            ...color,
            pattern: randomChoice(['solid', 'gradient', 'dots']) as any,
            assignedAt: new Date().toISOString(),
            colorIndex: Math.floor(Math.random() * 5),
        };
    }

    /**
     * Build client-format Group object for API responses
     */
    build(): GroupDTO {
        const result: GroupDTO = {
            ...this.auditFields,
            ...this.businessFields,
            ...this.clientFields,
            // Convert audit timestamps to ISO strings for client
            createdAt: timestampToISOString(this.auditFields.createdAt),
            updatedAt: timestampToISOString(this.auditFields.updatedAt),
            deletedAt: this.deletionFields.deletedAt ? timestampToISOString(this.deletionFields.deletedAt) : null,
            // Default client fields if not set
            balance: this.clientFields.balance || { balancesByCurrency: {} },
            lastActivity: this.clientFields.lastActivity || '2 hours ago',
        };
        return result;
    }

    /**
     * Build Firestore-format Group document for database storage
     * Excludes client-only fields like balance and lastActivity
     */
    buildDocument(): Omit<GroupDTO, 'balance' | 'lastActivity'> {
        const result = {
            ...this.auditFields,
            ...this.businessFields,
            // Convert audit timestamps to ISO strings
            createdAt: timestampToISOString(this.auditFields.createdAt),
            updatedAt: timestampToISOString(this.auditFields.updatedAt),
            deletedAt: this.deletionFields.deletedAt ? timestampToISOString(this.deletionFields.deletedAt) : null,
        };
        return result;
    }

    static groupForUser(userId: string): GroupDTOBuilder {
        return new GroupDTOBuilder()
            .withCreatedBy(userId)
            .withName(`${userId}'s Group`);
    }

    /**
     * Creates multiple groups with sequential IDs for testing pagination
     */
    /**
     * Creates multiple groups with sequential IDs for testing pagination
     */
    static buildMany(count: number, customizer?: (builder: GroupDTOBuilder, index: number) => void): GroupDTO[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new GroupDTOBuilder()
                .withId(`group-${i + 1}`);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }
}

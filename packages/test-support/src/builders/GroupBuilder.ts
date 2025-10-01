import type { GroupDTO, SecurityPreset, GroupPermissions, UserThemeColor, FirestoreTimestamp, FirestoreAuditMetadata } from '@splitifyd/shared';
import { SecurityPresets, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Builder for creating Group objects for tests
 * Supports both client format (Group) and server format (GroupDocument)
 */
export class GroupBuilder {
    // Infrastructure audit metadata
    private auditFields: FirestoreAuditMetadata = {
        id: `group-${generateShortId()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Business logic fields
    private businessFields: {
        createdBy: string;
        name: string;
        description?: string;
        securityPreset: SecurityPreset;
        presetAppliedAt: FirestoreTimestamp;
        permissions: GroupPermissions;
    } = {
        createdBy: `user-${generateShortId()}`,
        name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(4)}`,
        description: `A test group for ${randomString(6)}`,
        securityPreset: SecurityPresets.OPEN,
        presetAppliedAt: new Date(),
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
        lastActivityRaw?: string;
    } = {};

    constructor() {
        // Set up default client fields
        this.clientFields = {
            balance: {
                balancesByCurrency: {},
            },
            lastActivity: '2 hours ago',
            lastActivityRaw: new Date().toISOString(),
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

    withSecurityPreset(preset: SecurityPreset): this {
        this.businessFields.securityPreset = preset;
        return this;
    }

    withPermissions(permissions: Partial<GroupPermissions>): this {
        this.businessFields.permissions = { ...this.businessFields.permissions, ...permissions };
        return this;
    }

    withCreatedAt(timestamp: any): this {
        this.auditFields.createdAt = timestamp;
        return this;
    }

    withUpdatedAt(timestamp: any): this {
        this.auditFields.updatedAt = timestamp;
        return this;
    }

    withPresetAppliedAt(timestamp: any): this {
        this.businessFields.presetAppliedAt = timestamp;
        return this;
    }

    withLastActivity(activity: string): this {
        this.clientFields.lastActivity = activity;
        return this;
    }

    withLastActivityRaw(date: string | Date): this {
        this.clientFields.lastActivityRaw = date instanceof Date ? date.toISOString() : date;
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

    withClientCompatibleTimestamps(): this {
        // For client-side tests that can't handle Firebase Admin Timestamps
        this.auditFields.createdAt = new Date();
        this.auditFields.updatedAt = new Date();
        this.businessFields.presetAppliedAt = new Date();
        return this;
    }

    withServerCompatibleTimestamps(): this {
        // For server-side tests that expect Firebase Admin Timestamps
        this.auditFields.createdAt = Timestamp.now();
        this.auditFields.updatedAt = Timestamp.now();
        this.businessFields.presetAppliedAt = Timestamp.now();
        return this;
    }

    /**
     * Helper to convert FirestoreTimestamp to ISO string
     */
    private timestampToISOString(timestamp: FirestoreTimestamp): string {
        if (typeof timestamp === 'string') {
            return timestamp;
        }
        if (timestamp instanceof Date) {
            return timestamp.toISOString();
        }
        // Firestore Timestamp
        return (timestamp as any).toDate().toISOString();
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
            createdAt: this.timestampToISOString(this.auditFields.createdAt),
            updatedAt: this.timestampToISOString(this.auditFields.updatedAt),
            // Convert business field timestamps to ISO strings for client
            presetAppliedAt: this.timestampToISOString(this.businessFields.presetAppliedAt),
            // Default client fields if not set
            balance: this.clientFields.balance || { balancesByCurrency: {} },
            lastActivity: this.clientFields.lastActivity || '2 hours ago',
            lastActivityRaw: this.clientFields.lastActivityRaw || new Date().toISOString(),
        };
        return result;
    }

    /**
     * Build server-format GroupDocument for Firestore operations
     * Use this when setting data directly in Firestore stubs/mocks
     */
    buildForFirestore(): any {
        const result = {
            ...this.auditFields,
            ...this.businessFields,
            ...this.firestoreFields,
            // Keep Firestore Timestamps as-is for server format
        };
        return result;
    }

    static groupForUser(userId: string): GroupBuilder {
        return new GroupBuilder()
            .withCreatedBy(userId)
            .withName(`${userId}'s Group`);
    }

    /**
     * Creates multiple groups with sequential IDs for testing pagination
     */
    /**
     * Creates multiple groups with sequential IDs for testing pagination
     */
    static buildMany(count: number, customizer?: (builder: GroupBuilder, index: number) => void): GroupDTO[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new GroupBuilder().withId(`group-${i + 1}`);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }

}
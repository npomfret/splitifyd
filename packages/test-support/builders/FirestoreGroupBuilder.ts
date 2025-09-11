import { SecurityPresets, MemberRoles, MemberStatuses, type UserThemeColor } from '@splitifyd/shared';
import { randomString, generateShortId, randomChoice } from '../test-helpers';
import { Timestamp } from 'firebase-admin/firestore';

// Note: GroupDocument should be imported from the consuming project's schemas
// This builder is generic and will work with any compatible GroupDocument type

/**
 * Builder for creating GroupDocument objects in tests
 * Provides sensible defaults and fluent API for customization
 */
export class FirestoreGroupBuilder {
    private group: any;

    constructor() {
        const defaultUserId = `user-${generateShortId()}`;
        const defaultGroupId = `group-${generateShortId()}`;

        this.group = {
            id: defaultGroupId,
            name: `Test Group ${randomString(4)}`,
            description: 'Test group description',
            createdBy: defaultUserId,
            members: {
                [defaultUserId]: {
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: new Date().toISOString(),
                    color: this.createDefaultThemeColor(),
                },
            },
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: Timestamp.now(),
            permissions: {
                expenseEditing: 'all-members',
                expenseDeletion: 'creator-and-admins',
                memberInvitation: 'admins-only',
                memberApproval: 'automatic',
                settingsManagement: 'admins-only',
            },
        };
    }

    withId(id: string): this {
        this.group.id = id;
        return this;
    }

    withName(name: string): this {
        this.group.name = name;
        return this;
    }

    withDescription(description: string): this {
        this.group.description = description;
        return this;
    }

    withCreatedBy(userId: string): this {
        this.group.createdBy = userId;
        // Update the creator to be admin if they're not already in members
        if (!this.group.members[userId]) {
            this.group.members[userId] = {
                role: MemberRoles.ADMIN,
                status: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                color: this.createDefaultThemeColor(),
            };
        }
        return this;
    }

    withMember(userId: string, role: 'admin' | 'member' = 'member', status: 'active' | 'pending' = 'active'): this {
        this.group.members[userId] = {
            role: role as any,
            status: status as any,
            joinedAt: new Date().toISOString(),
            color: this.createThemeColorForUser(userId),
        };
        return this;
    }

    withMembers(members: Record<string, { role?: 'admin' | 'member'; status?: 'active' | 'pending' }>): this {
        // Clear existing members except creator
        this.group.members = {
            [this.group.createdBy]: this.group.members[this.group.createdBy],
        };

        // Add new members
        Object.entries(members).forEach(([userId, config]) => {
            this.withMember(userId, config.role, config.status);
        });
        return this;
    }

    withSecurityPreset(preset: 'open' | 'restricted' | 'private'): this {
        this.group.securityPreset = preset as any;
        return this;
    }

    withPermissions(permissions: Partial<typeof this.group.permissions>): this {
        this.group.permissions = {
            ...this.group.permissions,
            ...permissions,
        };
        return this;
    }

    withCreatedAt(date: string | Date): this {
        this.group.createdAt = date instanceof Date ? Timestamp.fromDate(date) : Timestamp.fromDate(new Date(date));
        return this;
    }

    withUpdatedAt(date: string | Date): this {
        this.group.updatedAt = date instanceof Date ? Timestamp.fromDate(date) : Timestamp.fromDate(new Date(date));
        return this;
    }

    // Helper method to create theme colors with different patterns for testing
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

    private createThemeColorForUser(userId: string): UserThemeColor {
        // Create deterministic colors based on userId for consistent testing
        const colorIndex = Math.abs(userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 5;
        const colors = [
            { light: '#FF6B6B', dark: '#FF6B6B', name: 'Coral Red' },
            { light: '#4ECDC4', dark: '#4ECDC4', name: 'Teal' },
            { light: '#45B7D1', dark: '#45B7D1', name: 'Sky Blue' },
            { light: '#96CEB4', dark: '#96CEB4', name: 'Mint Green' },
            { light: '#FFEAA7', dark: '#FFEAA7', name: 'Sunny Yellow' },
        ];

        return {
            ...colors[colorIndex],
            pattern: 'solid',
            assignedAt: new Date().toISOString(),
            colorIndex,
        };
    }

    build(): any {
        return { ...this.group };
    }

    /**
     * Helper to build multiple groups with sequential IDs
     * Useful for pagination and bulk testing scenarios
     */
    static buildMany(count: number, customizer?: (builder: FirestoreGroupBuilder, index: number) => void): any[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new FirestoreGroupBuilder().withId(`group-${i + 1}`);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }
}

import type { Group, SecurityPreset, GroupPermissions } from '@splitifyd/shared';
import { SecurityPresets } from '@splitifyd/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

/**
 * Builder for creating API Group objects for tests
 * Creates the Group format returned by API endpoints (not Firestore documents)
 * Use FirestoreGroupBuilder for Firestore document creation
 */
export class GroupBuilder {
    private group: Group;

    constructor() {
        const randomId = generateShortId();
        const now = new Date().toISOString();

        this.group = {
            id: `group-${randomId}`,
            name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(4)}`,
            description: `A test group for ${randomString(6)}`,
            createdBy: `user-${generateShortId()}`,
            createdAt: now,
            updatedAt: now,
            securityPreset: SecurityPresets.OPEN,
            permissions: {
                expenseEditing: 'anyone',
                expenseDeletion: 'anyone',
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'admin-only',
            },
            // API computed fields
            balance: {
                balancesByCurrency: {},
            },
            lastActivity: '2 hours ago',
            lastActivityRaw: now,
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
        return this;
    }

    withSecurityPreset(preset: SecurityPreset): this {
        this.group.securityPreset = preset;
        return this;
    }

    withPermissions(permissions: Partial<GroupPermissions>): this {
        this.group.permissions = { ...this.group.permissions, ...permissions };
        return this;
    }

    withCreatedAt(date: string | Date): this {
        this.group.createdAt = date instanceof Date ? date.toISOString() : date;
        return this;
    }

    withUpdatedAt(date: string | Date): this {
        this.group.updatedAt = date instanceof Date ? date.toISOString() : date;
        return this;
    }

    withLastActivity(activity: string): this {
        this.group.lastActivity = activity;
        return this;
    }

    withLastActivityRaw(date: string | Date): this {
        this.group.lastActivityRaw = date instanceof Date ? date.toISOString() : date;
        return this;
    }

    withBalance(balancesByCurrency: Record<string, any>): this {
        this.group.balance = { balancesByCurrency };
        return this;
    }

    build(): Group {
        return { ...this.group };
    }

    static basicGroup(): GroupBuilder {
        return new GroupBuilder()
            .withName('Test Group')
            .withDescription('A basic test group');
    }

    static emptyGroup(): GroupBuilder {
        return new GroupBuilder()
            .withName('Empty Group')
            .withDescription('An empty group for testing')
            .withBalance({});
    }

    static groupWithActivity(activity: string): GroupBuilder {
        return new GroupBuilder()
            .withLastActivity(activity)
            .withLastActivityRaw(new Date());
    }

    static groupForUser(userId: string): GroupBuilder {
        return new GroupBuilder()
            .withCreatedBy(userId)
            .withName(`${userId}'s Group`);
    }

    /**
     * Creates multiple groups with sequential IDs for testing pagination
     */
    static buildMany(count: number, customizer?: (builder: GroupBuilder, index: number) => void): Group[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new GroupBuilder().withId(`group-${i + 1}`);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }
}
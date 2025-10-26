import type { CurrencyBalance, GroupDTO, GroupPermissions, InviteLink, PermissionChangeLog, UserId } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, randomChoice, randomString, timestampToISOString } from '../test-helpers';

/**
 * Builder for creating GroupDTO objects for tests.
 * Maintains a single GroupDTO instance to match patterns used by other builders.
 */
export class GroupDTOBuilder {
    private group: GroupDTO;

    constructor() {
        const defaultOwner = `user-${generateShortId()}`;

        this.group = {
            id: `group-${generateShortId()}`,
            name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(4)}`,
            description: `A test group for ${randomString(6)}`,
            createdBy: defaultOwner,
            permissions: {
                expenseEditing: 'anyone',
                expenseDeletion: 'anyone',
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'admin-only',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            balance: {
                balancesByCurrency: {},
            },
            lastActivity: '2 hours ago',
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

    withDescription(description: string | undefined): this {
        this.group.description = description;
        return this;
    }

    withCreatedBy(userId: UserId): this {
        this.group.createdBy = userId;
        return this;
    }

    withPermissions(permissions: Partial<GroupPermissions>): this {
        this.group.permissions = {
            ...this.group.permissions,
            ...permissions,
        };
        return this;
    }

    withPermissionHistory(history: PermissionChangeLog[]): this {
        this.group.permissionHistory = history.map((entry) => ({
            ...entry,
            changes: entry.changes.map((change) => ({ ...change })),
        }));
        return this;
    }

    withInviteLinks(inviteLinks: Record<string, InviteLink>): this {
        this.group.inviteLinks = Object
            .entries(inviteLinks)
            .reduce<Record<string, InviteLink>>((acc, [id, link]) => {
                acc[id] = { ...link };
                return acc;
            }, {});
        return this;
    }

    withCreatedAt(timestamp: BuilderTimestamp): this {
        this.group.createdAt = timestampToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: BuilderTimestamp): this {
        this.group.updatedAt = timestampToISOString(timestamp);
        return this;
    }

    withDeletedAt(timestamp: BuilderTimestamp | null): this {
        this.group.deletedAt = timestamp ? timestampToISOString(timestamp) : null;
        return this;
    }

    withLastActivity(activity: string): this {
        this.group.lastActivity = activity;
        return this;
    }

    withBalance(balancesByCurrency: Record<string, CurrencyBalance>): this {
        this.group.balance = {
            balancesByCurrency: Object
                .entries(balancesByCurrency)
                .reduce<Record<string, CurrencyBalance>>((acc, [currency, balance]) => {
                    acc[currency] = { ...balance };
                    return acc;
                }, {}),
        };
        return this;
    }

    withoutBalance(): this {
        delete this.group.balance;
        return this;
    }

    withoutLastActivity(): this {
        delete this.group.lastActivity;
        return this;
    }

    build(): GroupDTO {
        const {
            balance,
            permissionHistory,
            inviteLinks,
            permissions,
            ...rest
        } = this.group;

        const cloned: GroupDTO = {
            ...rest,
            permissions: { ...permissions },
        };

        if (balance) {
            cloned.balance = {
                balancesByCurrency: Object
                    .entries(balance.balancesByCurrency)
                    .reduce<Record<string, CurrencyBalance>>((acc, [currency, value]) => {
                        acc[currency] = { ...value };
                        return acc;
                    }, {}),
            };
        }

        if (this.group.lastActivity !== undefined) {
            cloned.lastActivity = this.group.lastActivity;
        }

        if (permissionHistory) {
            cloned.permissionHistory = permissionHistory.map((entry) => ({
                ...entry,
                changes: entry.changes.map((change) => ({ ...change })),
            }));
        }

        if (inviteLinks) {
            cloned.inviteLinks = Object.entries(inviteLinks).reduce<Record<string, InviteLink>>((acc, [id, link]) => {
                acc[id] = { ...link };
                return acc;
            }, {});
        }

        return cloned;
    }

    static groupForUser(userId: UserId): GroupDTOBuilder {
        return new GroupDTOBuilder()
            .withCreatedBy(userId)
            .withName(`${userId}'s Group`);
    }
}

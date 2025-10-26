import { PolicyId, UserId } from '@splitifyd/shared';
import { StubFirestoreDatabase, Timestamp } from '@splitifyd/firebase-simulator';

type GroupId = string;
type ExpenseId = string;
type SettlementId = string;

/**
 * Splitifyd-specific test database that extends StubFirestoreDatabase
 * with application-specific seed methods for testing.
 */
export class SplitifydFirestoreTestDatabase extends StubFirestoreDatabase {
    seedUser(userId: UserId, userData: Record<string, any> = {}) {
        const defaultUser = {
            id: userId,
            email: userData.email || `${userId}@test.com`,
            displayName: userData.displayName || `User ${userId}`,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            ...this.convertDatesToTimestamps(userData),
        };

        this.seed(`users/${userId}`, defaultUser);

        return defaultUser;
    }

    seedGroup(groupId: GroupId, overrides: Record<string, any> = {}): void {
        const now = Timestamp.now();
        const {
            permissions: overridePermissions,
            securityPreset: _legacySecurityPreset,
            presetAppliedAt: _legacyPresetAppliedAt,
            ...restOverrides
        } = overrides;

        const defaultPermissions = {
            expenseEditing: 'anyone',
            expenseDeletion: 'anyone',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'admin-only',
        };

        const groupData = {
            id: groupId,
            name: restOverrides.name ?? 'Test Group',
            description: restOverrides.description ?? 'A test group',
            createdBy: restOverrides.createdBy ?? 'test-creator',
            deletedAt: restOverrides.deletedAt ?? null,
            permissions: {
                ...defaultPermissions,
                ...(overridePermissions ?? {}),
            },
            createdAt: now,
            updatedAt: now,
            ...restOverrides,
        };

        const firestoreData = this.convertDatesToTimestamps(groupData);
        this.seed(`groups/${groupId}`, firestoreData);
    }

    seedGroupMember(groupId: GroupId, userId: UserId, memberData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(memberData);
        this.seed(`group-memberships/${userId}_${groupId}`, firestoreData);
    }

    seedExpense(expenseId: ExpenseId, expenseData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(expenseData);
        this.seed(`expenses/${expenseId}`, firestoreData);
    }

    seedSettlement(settlementId: SettlementId, settlementData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(settlementData);
        this.seed(`settlements/${settlementId}`, firestoreData);
    }

    seedPolicy(policyId: PolicyId, policyData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(policyData);
        this.seed(`policies/${policyId}`, firestoreData);
    }

    initializeGroupBalance(groupId: GroupId): void {
        const initialBalance = {
            groupId,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: Timestamp.now(),
            version: 0,
        };
        this.seed(`groups/${groupId}/metadata/balance`, initialBalance);
    }

    private convertDatesToTimestamps(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const converted = Array.isArray(data) ? [...data] : { ...data };
        const dateFields = new Set([
            'date',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'markedForDeletionAt',
            'joinedAt',
            'groupUpdatedAt',
            'assignedAt',
            'lastUpdatedAt',
        ]);

        for (const key in converted) {
            const value = converted[key];

            if (value === null || value === undefined) {
                continue;
            }

            if (dateFields.has(key)) {
                if (typeof value === 'string') {
                    try {
                        const date = new Date(value);
                        if (!Number.isNaN(date.getTime())) {
                            converted[key] = Timestamp.fromDate(date);
                        }
                    } catch {
                        //
                    }
                } else if (value instanceof Date) {
                    converted[key] = Timestamp.fromDate(value);
                }
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp) && !(value instanceof Date)) {
                converted[key] = this.convertDatesToTimestamps(value);
            } else if (Array.isArray(value)) {
                converted[key] = value.map((item) => (typeof item === 'object' && item !== null ? this.convertDatesToTimestamps(item) : item));
            }
        }

        return converted;
    }
}

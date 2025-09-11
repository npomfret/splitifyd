import { AuthenticatedFirebaseUser, Group } from '@splitifyd/shared';
import { ApiDriver } from './ApiDriver';
import { SettlementBuilder } from './builders';
import { generateShortId } from './test-helpers';
import { TestGroupManager } from './TestGroupManager';

interface SettlementOptions {
    amount?: number;
    note?: string;
    fresh?: boolean;
}

interface SettlementCacheKey {
    groupId: string;
    payerId: string;
    payeeId: string;
}

export class TestSettlementManager {
    private static settlementCache: Map<string, Promise<any>> = new Map();
    private static apiDriver = new ApiDriver();

    private static createCacheKey(groupId: string, payerId: string, payeeId: string): string {
        return `${groupId}:${payerId}:${payeeId}`;
    }

    public static async getOrCreateSettlement(group: Group, payer: AuthenticatedFirebaseUser, payee: AuthenticatedFirebaseUser, options: SettlementOptions = {}): Promise<any> {
        const { amount = 25.0, note, fresh = false } = options;

        if (fresh) {
            return this.createFreshSettlement(group, payer, payee, options);
        }

        const cacheKey = this.createCacheKey(group.id, payer.uid, payee.uid);

        if (!this.settlementCache.has(cacheKey)) {
            const settlementPromise = this.createFreshSettlement(group, payer, payee, options);
            this.settlementCache.set(cacheKey, settlementPromise);
        }

        return this.settlementCache.get(cacheKey)!;
    }

    private static async createFreshSettlement(group: Group, payer: AuthenticatedFirebaseUser, payee: AuthenticatedFirebaseUser, options: SettlementOptions = {}): Promise<any> {
        const { amount = 25.0, note } = options;
        const uniqueId = generateShortId();
        const settlementNote = note || `Settlement ${uniqueId}`;

        const settlementData = new SettlementBuilder().withGroupId(group.id).withPayer(payer.uid).withPayee(payee.uid).withAmount(amount).withNote(settlementNote).build();

        return this.apiDriver.createSettlement(settlementData, payer.token);
    }

    /**
     * Creates multiple settlements between different user pairs
     */
    public static async createMultipleSettlements(group: Group, users: AuthenticatedFirebaseUser[], count: number = 3): Promise<any[]> {
        const settlements = [];

        for (let i = 0; i < count && i < users.length - 1; i++) {
            const settlement = await this.getOrCreateSettlement(group, users[i], users[i + 1], {
                amount: 10 + i * 5, // Varying amounts
                note: `Multi-settlement ${i + 1}`,
                fresh: true, // Create fresh settlements for multiple scenarios
            });
            settlements.push(settlement);
        }

        return settlements;
    }

    public static clearCache(): void {
        this.settlementCache.clear();
    }

    public static getCacheSize(): number {
        return this.settlementCache.size;
    }
}

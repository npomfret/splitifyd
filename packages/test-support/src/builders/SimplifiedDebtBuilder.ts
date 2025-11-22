import type { SimplifiedDebt, UserId } from '@billsplit-wl/shared';
import { Amount, USD, toCurrencyISOCode } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import {toUserId} from "@billsplit-wl/shared";

/**
 * Builder for creating SimplifiedDebt objects for testing
 * Used to construct debt relationships between users in balance displays
 */
export class SimplifiedDebtBuilder {
    private debt: SimplifiedDebt & {
        from: { uid: string; displayName?: string; };
        to: { uid: string; displayName?: string; };
    };

    constructor() {
        this.debt = {
            from: {
                uid: toUserId('user-1'),
            },
            to: {
                uid: toUserId('user-2'),
            },
            amount: '50.0',
            currency: USD,
        };
    }

    /**
     * Set the user who owes money (from)
     */
    from(userId: UserId | string, displayName?: string): this {
        this.debt.from = {
            uid: typeof userId === 'string' ? toUserId(userId) : userId,
            ...(displayName && { displayName })
        };
        return this;
    }

    /**
     * Set the user who is owed money (to)
     */
    to(userId: UserId | string, displayName?: string): this {
        this.debt.to = {
            uid: typeof userId === 'string' ? toUserId(userId) : userId,
            ...(displayName && { displayName })
        };
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.debt.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
        this.debt.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.debt.currency = currency;
        return this;
    }

    build(): SimplifiedDebt & {
        from: { uid: string; displayName?: string; };
        to: { uid: string; displayName?: string; };
    } {
        return { ...this.debt };
    }
}

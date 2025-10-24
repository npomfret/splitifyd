import type { SimplifiedDebt } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';

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
                uid: 'user-1',
            },
            to: {
                uid: 'user-2',
            },
            amount: '50.0',
            currency: 'USD',
        };
    }

    /**
     * Set the user who owes money (from)
     */
    from(uid: string, displayName?: string): this {
        this.debt.from = { uid, ...(displayName && { displayName }) };
        return this;
    }

    /**
     * Set the user who is owed money (to)
     */
    to(uid: string, displayName?: string): this {
        this.debt.to = { uid, ...(displayName && { displayName }) };
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.debt.currency = currency;
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

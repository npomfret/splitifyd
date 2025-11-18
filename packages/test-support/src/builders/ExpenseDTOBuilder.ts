import type { ExpenseDTO, UserId } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { ExpenseId, toExpenseId } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomChoice, randomDate, randomLabel, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

/**
 * Builder for creating ExpenseDTO objects for tests
 * Creates complete expense documents with ID and audit metadata
 */
export class ExpenseDTOBuilder {
    private expense: ExpenseDTO;

    constructor() {
        const userId = `user-${generateShortId()}`;
        const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

        this.expense = {
            // Audit fields (BaseDTO)
            id: toExpenseId(`expense-${generateShortId()}`),
            createdAt: convertToISOString(new Date()),
            updatedAt: convertToISOString(new Date()),

            // Business fields
            groupId: toGroupId(`group-${generateShortId()}`),
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            paidBy: userId,
            createdBy: userId,
            splitType: randomChoice(['equal', 'exact', 'percentage'] as const),
            participants: [userId],
            splits: [{ uid: userId, amount }],
            date: convertToISOString(randomDate()),
            label: randomLabel(),
            deletedAt: null,
            deletedBy: null,
            isLocked: false, // Default to unlocked
        };
    }

    // Audit field methods
    withExpenseId(id: ExpenseId | string): this {
        this.expense.id = typeof id === 'string' ? toExpenseId(id) : id;
        return this;
    }

    withCreatedAt(timestamp: Date | string | ISOString): this {
        this.expense.createdAt = convertToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: Date | string | ISOString): this {
        this.expense.updatedAt = convertToISOString(timestamp);
        return this;
    }

    withDeletedAt(timestamp: Date | string | ISOString | null): this {
        this.expense.deletedAt = timestamp ? convertToISOString(timestamp) : null;
        return this;
    }

    withDeletedBy(userId: UserId | null): this {
        this.expense.deletedBy = userId;
        return this;
    }

    // Business field methods
    withGroupId(groupId: GroupId | string): this {
        this.expense.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.expense.currency = currency;
        const normalizedAmount = typeof amount === 'number' ? amount.toString() : amount;
        this.expense.amount = normalizedAmount;

        // Keep default split amounts in sync when builder still owns the split definition
        if (this.expense.splits.length === 1) {
            const [existingSplit] = this.expense.splits;
            this.expense.splits = [{
                ...existingSplit,
                amount: normalizedAmount,
            }];
        }
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.expense.currency = currency;
        return this;
    }

    withPaidBy(userId: UserId): this {
        this.expense.paidBy = userId;
        return this;
    }

    withCreatedBy(userId: UserId): this {
        this.expense.createdBy = userId;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: UserId[]): this {
        this.expense.participants = [...participants];
        if (participants.length === this.expense.splits.length) {
            this.expense.splits = participants.map((uid, index) => ({
                uid,
                amount: this.expense.splits[index]?.amount ?? this.expense.amount,
                ...(this.expense.splits[index]?.percentage !== undefined
                    ? { percentage: this.expense.splits[index]?.percentage }
                    : {}),
            }));
        } else {
            this.expense.splits = participants.map((uid) => ({
                uid,
                amount: this.expense.amount,
            }));
        }
        return this;
    }

    withSplits(splits: Array<{ uid: string; amount: Amount; percentage?: number; }>): this {
        this.expense.splits = [...splits];
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.expense.date = convertToISOString(timestamp);
        return this;
    }

    withLabel(label: string): this {
        this.expense.label = label;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    withIsLocked(isLocked: boolean): this {
        this.expense.isLocked = isLocked;
        return this;
    }

    build(): ExpenseDTO {
        return {
            ...this.expense,
            participants: [...this.expense.participants],
            splits: [...this.expense.splits],
        };
    }
}

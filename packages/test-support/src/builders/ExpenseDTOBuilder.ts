import type { ExpenseDTO, ExpenseLabel, ReactionCounts, ReactionEmoji, UserId, UserReactionsMap } from '@billsplit-wl/shared';
import { Amount, toExpenseLabel } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { ExpenseId, toExpenseId } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { ExpenseSplit } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomChoice, randomDate, randomLabels, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

/**
 * Builder for creating ExpenseDTO objects for tests
 * Creates complete expense documents with ID and audit metadata
 */
export class ExpenseDTOBuilder {
    private expense: ExpenseDTO;

    constructor() {
        const userId = toUserId(`user-${generateShortId()}`);
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
            labels: randomLabels(),
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
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

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.expense.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
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

    withPaidBy(userId: UserId | string): this {
        this.expense.paidBy = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withCreatedBy(userId: UserId | string): this {
        this.expense.createdBy = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: UserId[] | string[]): this {
        this.expense.participants = participants.map(item => typeof item === 'string' ? toUserId(item) : item) as UserId[];

        if (participants.length === this.expense.splits.length) {
            this.expense.splits = this.expense.participants.map((uid, index) => ({
                uid,
                amount: this.expense.splits[index]?.amount ?? this.expense.amount,
                ...(this.expense.splits[index]?.percentage !== undefined
                    ? { percentage: this.expense.splits[index]?.percentage }
                    : {}),
            }));
        } else {
            this.expense.splits = this.expense.participants.map((uid) => ({
                uid,
                amount: this.expense.amount,
            }));
        }
        return this;
    }

    withSplits(splits: ExpenseSplit[]): this {
        this.expense.splits = [...splits];
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.expense.date = convertToISOString(timestamp);
        return this;
    }

    withLabels(labels: ExpenseLabel[] | string[]): this {
        this.expense.labels = labels.map(l => typeof l === 'string' ? toExpenseLabel(l) : l);
        return this;
    }

    withLabel(label: string): this {
        this.expense.labels = [toExpenseLabel(label)];
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    withLocation(location: { name: string; url?: string; }): this {
        this.expense.location = location;
        return this;
    }

    withIsLocked(isLocked: boolean): this {
        this.expense.isLocked = isLocked;
        return this;
    }

    withReactionCounts(reactionCounts: ReactionCounts): this {
        this.expense.reactionCounts = reactionCounts;
        return this;
    }

    withUserReactions(userReactions: UserReactionsMap): this {
        this.expense.userReactions = userReactions;
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

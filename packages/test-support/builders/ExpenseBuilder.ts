import { 
    randomString, 
    randomDecimal, 
    randomChoice, 
    randomDate, 
    randomCurrency, 
    randomCategory, 
    generateShortId 
} from '../test-helpers';

//todo: WTF is this?  this should build a CreateExpenseRequest

export interface TestExpense {
    groupId: string;
    description: string;
    amount: number;
    currency: string;
    paidByDisplayName: string;
    splitType: 'equal' | 'exact' | 'percentage';
    participants: string[];
    splits?: Array<{
        userId: string;
        amount: number;
    }>;
    date: string;
    category: string;
    receiptUrl?: string;
}

export class ExpenseBuilder {
    private expense: TestExpense;

    constructor() {
        const userId = `user-${generateShortId()}`;
        this.expense = {
            groupId: `group-${generateShortId()}`,
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount: randomDecimal(5, 500),
            currency: randomCurrency(),
            paidByDisplayName: userId,
            splitType: randomChoice(['equal', 'exact', 'percentage']),
            participants: [userId],
            date: randomDate(),
            category: randomCategory(),
        };
    }

    withGroupId(groupId: string): this {
        this.expense.groupId = groupId;
        return this;
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: number): this {
        this.expense.amount = amount;
        return this;
    }

    withPaidBy(userId: string): this {
        this.expense.paidByDisplayName = userId;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: string[]): this {
        this.expense.participants = [...participants];
        return this;
    }

    withSplits(splits: Array<{ userId: string; amount: number; percentage?: number }>): this {
        this.expense.splits = [...splits];
        return this;
    }

    withDate(date: string): this {
        this.expense.date = date;
        return this;
    }

    withCategory(category: string): this {
        this.expense.category = category;
        return this;
    }

    withCurrency(currency: string): this {
        this.expense.currency = currency;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    build(): TestExpense {
        // Auto-generate splits if not explicitly provided
        let splits = this.expense.splits;
        if (!splits && this.expense.participants.length > 0) {
            if (this.expense.splitType === 'equal') {
                const splitAmount = this.expense.amount / this.expense.participants.length;
                splits = this.expense.participants.map(userId => ({
                    userId,
                    amount: splitAmount
                }));
            } else if (this.expense.splitType === 'exact') {
                // For exact splits, distribute evenly as default
                const splitAmount = this.expense.amount / this.expense.participants.length;
                splits = this.expense.participants.map(userId => ({
                    userId,
                    amount: splitAmount
                }));
            } else if (this.expense.splitType === 'percentage') {
                // For percentage splits, distribute evenly as default
                const percentage = 100 / this.expense.participants.length;
                const splitAmount = (this.expense.amount * percentage) / 100;
                splits = this.expense.participants.map(userId => ({
                    userId,
                    amount: splitAmount,
                    percentage: percentage
                }));
            }
        }

        return {
            groupId: this.expense.groupId,
            description: this.expense.description,
            amount: this.expense.amount,
            currency: this.expense.currency,
            paidByDisplayName: this.expense.paidByDisplayName,
            splitType: this.expense.splitType,
            participants: [...this.expense.participants],
            splits: splits ? [...splits] : undefined,
            date: this.expense.date,
            category: this.expense.category,
            ...(this.expense.receiptUrl && { receiptUrl: this.expense.receiptUrl }),
        };
    }
}

export interface TestExpense {
    groupId: string;
    description: string;
    amount: number;
    currency: string;
    paidBy: string;
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
        this.expense = {
            groupId: 'default-group-id',
            description: 'Test Expense',
            amount: 100,
            currency: 'USD',
            paidBy: 'default-user-id',
            splitType: 'equal',
            participants: ['default-user-id'],
            date: new Date().toISOString(),
            category: 'other',
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
        this.expense.paidBy = userId;
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
        return {
            groupId: this.expense.groupId,
            description: this.expense.description,
            amount: this.expense.amount,
            currency: this.expense.currency,
            paidBy: this.expense.paidBy,
            splitType: this.expense.splitType,
            participants: [...this.expense.participants],
            ...(this.expense.splits && { splits: [...this.expense.splits] }),
            date: this.expense.date,
            category: this.expense.category,
            ...(this.expense.receiptUrl && { receiptUrl: this.expense.receiptUrl }),
        };
    }
}

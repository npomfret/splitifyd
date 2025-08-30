export interface ValidationExpenseData {
    groupId: string;
    paidBy: string;
    amount: number;
    description: string;
    category: string;
    currency: string;
    date: string;
    splitType: string;
    participants: string[];
    receiptUrl?: string;
}

export class ValidationExpenseBuilder {
    private expense: ValidationExpenseData = {
        groupId: 'group123',
        paidBy: 'user123',
        amount: 100.5,
        description: 'Dinner at restaurant',
        category: 'food',
        currency: 'USD',
        date: '2024-01-15T00:00:00.000Z',
        splitType: 'equal',
        participants: ['user123', 'user456'],
    };

    withReceiptUrl(url: string): ValidationExpenseBuilder {
        this.expense.receiptUrl = url;
        return this;
    }

    build(): any {
        return { ...this.expense };
    }
}
import { convertCurrency } from '../utils/currency.js';
import { generateId } from '../utils/helpers.js';

export class ExpenseService {
    calculateBalances(project) {
        if (!project) return {};
        
        const balances = {};
        project.members.forEach(member => {
            balances[member.id] = 0;
        });

        project.expenses.forEach(expense => {
            // Convert to default currency
            const amountInDefault = convertCurrency(expense.amount, expense.currency, project.defaultCurrency);
            
            // Credit the payer
            if (balances[expense.paidBy] !== undefined) {
                balances[expense.paidBy] += amountInDefault;
            }

            // Debit those who owe
            const splitAmount = amountInDefault / expense.splitBetween.length;
            expense.splitBetween.forEach(userId => {
                if (balances[userId] !== undefined) {
                    balances[userId] -= splitAmount;
                }
            });
        });

        return balances;
    }

    calculateSettlements(project) {
        const balances = this.calculateBalances(project);
        const settlements = [];
        
        // Create arrays of debtors and creditors
        const debtors = [];
        const creditors = [];
        
        Object.entries(balances).forEach(([userId, balance]) => {
            if (balance < -0.01) {
                debtors.push({ userId, amount: Math.abs(balance) });
            } else if (balance > 0.01) {
                creditors.push({ userId, amount: balance });
            }
        });

        // Sort by amount
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        // Calculate minimal transactions
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.amount, creditor.amount);

            if (amount > 0.01) {
                settlements.push({
                    from: debtor.userId,
                    to: creditor.userId,
                    amount: amount
                });
            }

            debtor.amount -= amount;
            creditor.amount -= amount;

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    }

    createExpense(description, amount, currency, paidBy, splitBetween, addedBy) {
        return {
            id: generateId('exp'),
            description,
            amount: parseFloat(amount),
            currency,
            paidBy,
            splitBetween,
            timestamp: Date.now(),
            addedBy
        };
    }

    createSettlement(from, to, amount, currency, addedBy) {
        return {
            id: generateId('exp'),
            description: 'Settlement payment',
            amount: parseFloat(amount),
            currency,
            paidBy: from,
            splitBetween: [to],
            timestamp: Date.now(),
            addedBy,
            isSettlement: true
        };
    }

    validateExpense(expense, project) {
        if (!expense.description || expense.description.trim() === '') {
            throw new Error('Description is required');
        }
        
        if (!expense.amount || expense.amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
        
        if (!expense.paidBy || !project.members.find(m => m.id === expense.paidBy)) {
            throw new Error('Valid payer must be selected');
        }
        
        if (!expense.splitBetween || expense.splitBetween.length === 0) {
            throw new Error('At least one person must be selected for splitting');
        }
        
        const invalidSplits = expense.splitBetween.filter(
            id => !project.members.find(m => m.id === id)
        );
        
        if (invalidSplits.length > 0) {
            throw new Error('Invalid members selected for splitting');
        }
        
        return true;
    }
}
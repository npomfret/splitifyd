import { generateId } from '../utils/helpers.js';

export class ExpenseService {
    calculateBalances(project) {
        if (!project) return {};
        
        // Structure: { userId: { currency: amount } }
        const balances = {};
        project.members.forEach(member => {
            balances[member.id] = {};
        });

        project.expenses.forEach(expense => {
            const currency = expense.currency;
            
            // Initialize currency balance if not exists
            project.members.forEach(member => {
                if (!balances[member.id][currency]) {
                    balances[member.id][currency] = 0;
                }
            });
            
            // Credit the payer
            if (balances[expense.paidBy]) {
                balances[expense.paidBy][currency] += expense.amount;
            }

            // Debit those who owe
            const splitAmount = expense.amount / expense.splitBetween.length;
            expense.splitBetween.forEach(userId => {
                if (balances[userId]) {
                    balances[userId][currency] -= splitAmount;
                }
            });
        });

        return balances;
    }

    calculateSettlements(project) {
        const balances = this.calculateBalances(project);
        const settlementsByCurrency = {};
        
        // Get all currencies used
        const currencies = new Set();
        Object.values(balances).forEach(userBalance => {
            Object.keys(userBalance).forEach(currency => currencies.add(currency));
        });
        
        // Calculate settlements for each currency
        currencies.forEach(currency => {
            const debtors = [];
            const creditors = [];
            
            Object.entries(balances).forEach(([userId, userBalance]) => {
                const amount = userBalance[currency] || 0;
                if (amount < -0.01) {
                    debtors.push({ userId, amount: Math.abs(amount) });
                } else if (amount > 0.01) {
                    creditors.push({ userId, amount: amount });
                }
            });
            
            // Sort by amount
            debtors.sort((a, b) => b.amount - a.amount);
            creditors.sort((a, b) => b.amount - a.amount);
            
            settlementsByCurrency[currency] = [];
            
            // Calculate minimal transactions for this currency
            let i = 0, j = 0;
            while (i < debtors.length && j < creditors.length) {
                const debtor = debtors[i];
                const creditor = creditors[j];
                const amount = Math.min(debtor.amount, creditor.amount);
                
                if (amount > 0.01) {
                    settlementsByCurrency[currency].push({
                        from: debtor.userId,
                        to: creditor.userId,
                        amount: amount,
                        currency: currency
                    });
                }
                
                debtor.amount -= amount;
                creditor.amount -= amount;
                
                if (debtor.amount < 0.01) i++;
                if (creditor.amount < 0.01) j++;
            }
        });
        
        return settlementsByCurrency;
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
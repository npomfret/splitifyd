// Balance calculation algorithms
const Balance = {
    // Calculate balances for each member
    calculateBalances(projectData) {
        Utils.log('Calculating balances', projectData);
        
        const balances = {};
        
        // Initialize balances for all members
        Object.keys(projectData.members).forEach(memberId => {
            if (projectData.members[memberId].active !== false) {
                balances[memberId] = {};
            }
        });
        
        // Process expenses
        Object.entries(projectData.expenses).forEach(([expenseId, expense]) => {
            if (expense.active === false) return;
            
            const { amount, currency, paidBy, splitBetween } = expense;
            
            if (!splitBetween || splitBetween.length === 0) return;
            
            const sharePerPerson = amount / splitBetween.length;
            
            // Initialize currency balances
            if (!balances[paidBy]) balances[paidBy] = {};
            if (!balances[paidBy][currency]) balances[paidBy][currency] = 0;
            
            splitBetween.forEach(memberId => {
                if (!balances[memberId]) balances[memberId] = {};
                if (!balances[memberId][currency]) balances[memberId][currency] = 0;
                
                if (memberId === paidBy) {
                    // Person paid for themselves
                    balances[memberId][currency] += amount - sharePerPerson;
                } else {
                    // Person owes money
                    balances[memberId][currency] -= sharePerPerson;
                }
            });
        });
        
        // Process settlements
        Object.entries(projectData.settlements).forEach(([settlementId, settlement]) => {
            if (settlement.active === false) return;
            
            const { from, to, amount, currency } = settlement;
            
            if (!balances[from]) balances[from] = {};
            if (!balances[to]) balances[to] = {};
            if (!balances[from][currency]) balances[from][currency] = 0;
            if (!balances[to][currency]) balances[to][currency] = 0;
            
            balances[from][currency] += amount;
            balances[to][currency] -= amount;
        });
        
        Utils.log('Calculated balances', balances);
        return balances;
    },
    
    // Simplify balances and calculate suggested payments
    calculateSuggestedPayments(balances, members) {
        Utils.log('Calculating suggested payments', balances);
        
        const suggestions = {};
        
        // Process each currency separately
        const currencies = new Set();
        Object.values(balances).forEach(memberBalance => {
            Object.keys(memberBalance).forEach(currency => currencies.add(currency));
        });
        
        currencies.forEach(currency => {
            suggestions[currency] = this.calculatePaymentsForCurrency(balances, members, currency);
        });
        
        Utils.log('Suggested payments', suggestions);
        return suggestions;
    },
    
    // Calculate payments for a specific currency
    calculatePaymentsForCurrency(balances, members, currency) {
        const payments = [];
        
        // Create lists of creditors and debtors
        const creditors = [];
        const debtors = [];
        
        Object.entries(balances).forEach(([memberId, memberBalance]) => {
            const amount = memberBalance[currency] || 0;
            
            if (amount > 0.01) {
                creditors.push({
                    id: memberId,
                    name: members[memberId]?.name || 'Unknown',
                    amount: amount
                });
            } else if (amount < -0.01) {
                debtors.push({
                    id: memberId,
                    name: members[memberId]?.name || 'Unknown',
                    amount: Math.abs(amount)
                });
            }
        });
        
        // Sort by amount (descending)
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);
        
        // Create payments using greedy algorithm
        let i = 0, j = 0;
        
        while (i < creditors.length && j < debtors.length) {
            const creditor = creditors[i];
            const debtor = debtors[j];
            
            const paymentAmount = Math.min(creditor.amount, debtor.amount);
            
            if (paymentAmount > 0.01) {
                payments.push({
                    from: debtor,
                    to: creditor,
                    amount: paymentAmount,
                    currency: currency
                });
            }
            
            creditor.amount -= paymentAmount;
            debtor.amount -= paymentAmount;
            
            if (creditor.amount < 0.01) i++;
            if (debtor.amount < 0.01) j++;
        }
        
        return payments;
    },
    
    // Format balance for display
    formatBalance(amount, currency) {
        if (Math.abs(amount) < 0.01) {
            return 'Settled';
        }
        
        const formatted = Utils.formatCurrency(Math.abs(amount), currency);
        
        if (amount > 0) {
            return `Gets back ${formatted}`;
        } else {
            return `Owes ${formatted}`;
        }
    },
    
    // Get member's total balance across all currencies
    getMemberTotalBalance(memberId, balances) {
        const memberBalance = balances[memberId] || {};
        const totals = [];
        
        Object.entries(memberBalance).forEach(([currency, amount]) => {
            if (Math.abs(amount) > 0.01) {
                totals.push({
                    currency,
                    amount,
                    formatted: this.formatBalance(amount, currency)
                });
            }
        });
        
        return totals;
    }
};
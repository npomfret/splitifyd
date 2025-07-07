export function simplifyDebts(balances) {
    const netBalances = calculateNetBalances(balances);
    return createOptimalTransactions(netBalances);
}

function calculateNetBalances(balances) {
    const netBalances = {};
    
    Object.values(balances).forEach(user => {
        let netAmount = 0;
        
        Object.values(user.owes).forEach(amount => {
            netAmount -= amount;
        });
        
        Object.values(user.owedBy).forEach(amount => {
            netAmount += amount;
        });
        
        if (Math.abs(netAmount) > 0.01) {
            netBalances[user.userId] = {
                userId: user.userId,
                name: user.name,
                netAmount: netAmount
            };
        }
    });
    
    return netBalances;
}

function createOptimalTransactions(netBalances) {
    const transactions = [];
    const creditors = [];
    const debtors = [];
    
    Object.values(netBalances).forEach(user => {
        if (user.netAmount > 0) {
            creditors.push({ ...user });
        } else if (user.netAmount < 0) {
            debtors.push({ ...user, netAmount: -user.netAmount });
        }
    });
    
    creditors.sort((a, b) => b.netAmount - a.netAmount);
    debtors.sort((a, b) => b.netAmount - a.netAmount);
    
    let creditorIndex = 0;
    let debtorIndex = 0;
    
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];
        
        const transferAmount = Math.min(creditor.netAmount, debtor.netAmount);
        
        if (transferAmount > 0.01) {
            transactions.push({
                from: {
                    userId: debtor.userId,
                    name: debtor.name
                },
                to: {
                    userId: creditor.userId,
                    name: creditor.name
                },
                amount: transferAmount
            });
        }
        
        creditor.netAmount -= transferAmount;
        debtor.netAmount -= transferAmount;
        
        if (creditor.netAmount <= 0.01) {
            creditorIndex++;
        }
        if (debtor.netAmount <= 0.01) {
            debtorIndex++;
        }
    }
    
    return transactions;
}
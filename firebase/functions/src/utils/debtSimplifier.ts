export interface UserBalance {
    userId: string;
    owes: Record<string, number>;
    owedBy: Record<string, number>;
    netBalance: number;
}

export interface NetBalance {
    userId: string;
    name: string;
    netAmount: number;
}

export interface SimplifiedDebt {
    from: {
        userId: string;
        name: string;
    };
    to: {
        userId: string;
        name: string;
    };
    amount: number;
}

export function simplifyDebts(balances: Record<string, UserBalance>, userNames: Map<string, string>): SimplifiedDebt[] {
    const netBalances = calculateNetBalances(balances, userNames);
    return createOptimalTransactions(netBalances);
}

function calculateNetBalances(balances: Record<string, UserBalance>, userNames: Map<string, string>): Record<string, NetBalance> {
    const netBalances: Record<string, NetBalance> = {};
    
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
                name: userNames.get(user.userId) || 'Unknown User',
                netAmount: netAmount
            };
        }
    });
    
    return netBalances;
}

function createOptimalTransactions(netBalances: Record<string, NetBalance>): SimplifiedDebt[] {
    const transactions: SimplifiedDebt[] = [];
    const creditors: NetBalance[] = [];
    const debtors: NetBalance[] = [];
    
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
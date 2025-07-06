export function simplifyDebts(balances) {
    const simplified = [];
    const debts = {};
    
    Object.values(balances).forEach(user => {
        Object.entries(user.owes).forEach(([creditorId, amount]) => {
            const debtKey = `${user.userId}-${creditorId}`;
            const reverseKey = `${creditorId}-${user.userId}`;
            
            if (debts[reverseKey]) {
                const netAmount = debts[reverseKey] - amount;
                if (netAmount > 0) {
                    debts[reverseKey] = netAmount;
                } else if (netAmount < 0) {
                    delete debts[reverseKey];
                    debts[debtKey] = -netAmount;
                } else {
                    delete debts[reverseKey];
                }
            } else if (!debts[debtKey]) {
                debts[debtKey] = amount;
            }
        });
    });
    
    Object.entries(debts).forEach(([key, amount]) => {
        const [fromId, toId] = key.split('-');
        const fromUser = balances[fromId];
        const toUser = balances[toId];
        
        simplified.push({
            from: fromUser,
            to: toUser,
            amount: amount
        });
    });
    
    return simplified;
}
import { simplifyDebts } from './debt-simplifier.js';

describe('Debt Simplifier', () => {
    describe('simplifyDebts', () => {
        it('should handle empty balances', () => {
            const balances = {};
            const result = simplifyDebts(balances);
            expect(result).toEqual([]);
        });

        it('should handle balanced accounts with no debts', () => {
            const balances = {
                user1: { userId: 'user1', name: 'Alice', owes: {}, owedBy: {} },
                user2: { userId: 'user2', name: 'Bob', owes: {}, owedBy: {} }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([]);
        });

        it('should handle simple two-person debt', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 20 }, 
                    owedBy: {} 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: {}, 
                    owedBy: { user1: 20 } 
                }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([{
                from: { userId: 'user1', name: 'Alice' },
                to: { userId: 'user2', name: 'Bob' },
                amount: 20
            }]);
        });

        it('should handle direct reciprocal debts', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 30 }, 
                    owedBy: { user2: 10 } 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: { user1: 10 }, 
                    owedBy: { user1: 30 } 
                }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([{
                from: { userId: 'user1', name: 'Alice' },
                to: { userId: 'user2', name: 'Bob' },
                amount: 20
            }]);
        });

        it('should handle triangular debt cycle', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 10 }, 
                    owedBy: { user3: 10 } 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: { user3: 10 }, 
                    owedBy: { user1: 10 } 
                },
                user3: { 
                    userId: 'user3', 
                    name: 'Charlie', 
                    owes: { user1: 10 }, 
                    owedBy: { user2: 10 } 
                }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([]);
        });

        it('should handle complex debt network', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 50, user3: 30 }, 
                    owedBy: { user4: 20 } 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: { user4: 40 }, 
                    owedBy: { user1: 50 } 
                },
                user3: { 
                    userId: 'user3', 
                    name: 'Charlie', 
                    owes: {}, 
                    owedBy: { user1: 30 } 
                },
                user4: { 
                    userId: 'user4', 
                    name: 'David', 
                    owes: { user1: 20 }, 
                    owedBy: { user2: 40 } 
                }
            };
            const result = simplifyDebts(balances);
            
            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: expect.objectContaining({ userId: 'user1' }),
                        to: expect.objectContaining({ userId: 'user3' }),
                        amount: 30
                    }),
                    expect.objectContaining({
                        from: expect.objectContaining({ userId: 'user1' }),
                        to: expect.objectContaining({ userId: 'user2' }),
                        amount: 30
                    })
                ])
            );
        });

        it('should handle uneven amounts with optimal matching', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 100 }, 
                    owedBy: {} 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: { user3: 30 }, 
                    owedBy: { user1: 100 } 
                },
                user3: { 
                    userId: 'user3', 
                    name: 'Charlie', 
                    owes: {}, 
                    owedBy: { user2: 30 } 
                }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([
                {
                    from: { userId: 'user1', name: 'Alice' },
                    to: { userId: 'user2', name: 'Bob' },
                    amount: 70
                },
                {
                    from: { userId: 'user1', name: 'Alice' },
                    to: { userId: 'user3', name: 'Charlie' },
                    amount: 30
                }
            ]);
        });

        it('should ignore very small amounts (< 0.01)', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user2: 0.005 }, 
                    owedBy: {} 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: {}, 
                    owedBy: { user1: 0.005 } 
                }
            };
            const result = simplifyDebts(balances);
            expect(result).toEqual([]);
        });

        it('should handle larger group with multiple creditors and debtors', () => {
            const balances = {
                user1: { 
                    userId: 'user1', 
                    name: 'Alice', 
                    owes: { user3: 25, user4: 25 }, 
                    owedBy: {} 
                },
                user2: { 
                    userId: 'user2', 
                    name: 'Bob', 
                    owes: { user3: 25, user4: 25 }, 
                    owedBy: {} 
                },
                user3: { 
                    userId: 'user3', 
                    name: 'Charlie', 
                    owes: {}, 
                    owedBy: { user1: 25, user2: 25 } 
                },
                user4: { 
                    userId: 'user4', 
                    name: 'David', 
                    owes: {}, 
                    owedBy: { user1: 25, user2: 25 } 
                }
            };
            const result = simplifyDebts(balances);
            
            expect(result).toHaveLength(4);
            
            const totalFromUser1 = result.filter(t => t.from.userId === 'user1').reduce((sum, t) => sum + t.amount, 0);
            const totalFromUser2 = result.filter(t => t.from.userId === 'user2').reduce((sum, t) => sum + t.amount, 0);
            const totalToUser3 = result.filter(t => t.to.userId === 'user3').reduce((sum, t) => sum + t.amount, 0);
            const totalToUser4 = result.filter(t => t.to.userId === 'user4').reduce((sum, t) => sum + t.amount, 0);
            
            expect(totalFromUser1).toBe(50);
            expect(totalFromUser2).toBe(50);
            expect(totalToUser3).toBe(50);
            expect(totalToUser4).toBe(50);
        });
    });
});
import type { ExpenseData, GroupBalances } from '../../../firebase/functions/src/shared/shared-types';
import { apiClient } from '../app/apiClient';

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface BalanceResult {
  balances: { [userId: string]: number };
  settlements: Settlement[];
  calculated: 'client' | 'server';
  timestamp: number;
  totalOwed: number;
  totalOwing: number;
}

export class BalanceCalculator {
  private static readonly CLIENT_CALC_THRESHOLD = 100; // Max expenses for client-side calculation
  private static readonly PRECISION = 0.01; // Minimum amount precision

  /**
   * Calculate balances either client-side or server-side based on data size
   */
  static async calculateBalances(
    groupId: string,
    expenses: ExpenseData[]
  ): Promise<BalanceResult> {
    // Check if we should calculate client-side
    if (expenses.length <= this.CLIENT_CALC_THRESHOLD) {
      return this.calculateClientSide(expenses);
    }

    try {
      // Use server calculation for large datasets
      const serverResult = await apiClient.getGroupBalances(groupId);
      
      // Convert server format to our format
      const balances: { [userId: string]: number } = {};
      Object.entries(serverResult.userBalances).forEach(([userId, userBalance]) => {
        balances[userId] = userBalance.netBalance;
      });
      
      const settlements = serverResult.simplifiedDebts.map(debt => ({
        from: debt.from.userId,
        to: debt.to.userId,
        amount: debt.amount
      }));
      
      return {
        balances,
        settlements,
        calculated: 'server',
        timestamp: Date.now(),
        totalOwed: Object.values(balances).filter(b => b > 0).reduce((sum, b) => sum + b, 0),
        totalOwing: Object.values(balances).filter(b => b < 0).reduce((sum, b) => sum + Math.abs(b), 0)
      };
    } catch (error) {
      // Fallback to client calculation if server fails
      console.warn('Server balance calculation failed, using client fallback:', error);
      return this.calculateClientSide(expenses);
    }
  }

  /**
   * Perform client-side balance calculation
   */
  private static calculateClientSide(expenses: ExpenseData[]): BalanceResult {
    const balances = new Map<string, number>();
    const userExpenses = new Map<string, ExpenseData[]>();

    // Initialize balance tracking
    expenses.forEach(expense => {
      const { paidBy, splits, amount } = expense;

      // Track who paid
      balances.set(paidBy, (balances.get(paidBy) || 0) + amount);

      // Track who owes what
      splits.forEach(split => {
        const { userId, amount: splitAmount } = split;
        if (typeof splitAmount === 'number' && !isNaN(splitAmount)) {
          balances.set(userId, (balances.get(userId) || 0) - splitAmount);

          // Track expenses for each user for audit trail
          if (!userExpenses.has(userId)) {
            userExpenses.set(userId, []);
          }
          userExpenses.get(userId)!.push(expense);
        }
      });
    });

    // Convert to plain object and round to precision
    const finalBalances: { [userId: string]: number } = {};
    balances.forEach((balance, userId) => {
      finalBalances[userId] = this.roundToPrecision(balance);
    });

    // Calculate optimized settlements
    const settlements = this.optimizeSettlements(finalBalances);

    // Calculate totals
    const totalOwed = Object.values(finalBalances)
      .filter(balance => balance > this.PRECISION)
      .reduce((sum, balance) => sum + balance, 0);

    const totalOwing = Object.values(finalBalances)
      .filter(balance => balance < -this.PRECISION)
      .reduce((sum, balance) => sum + Math.abs(balance), 0);

    return {
      balances: finalBalances,
      settlements,
      calculated: 'client',
      timestamp: Date.now(),
      totalOwed: this.roundToPrecision(totalOwed),
      totalOwing: this.roundToPrecision(totalOwing)
    };
  }

  /**
   * Optimize settlements using debt simplification algorithm
   */
  private static optimizeSettlements(balances: { [userId: string]: number }): Settlement[] {
    const settlements: Settlement[] = [];
    
    // Convert to arrays and sort for optimal matching
    const creditors = Object.entries(balances)
      .filter(([_, balance]) => balance > this.PRECISION)
      .sort((a, b) => b[1] - a[1]); // Sort by amount descending

    const debtors = Object.entries(balances)
      .filter(([_, balance]) => balance < -this.PRECISION)
      .map(([userId, balance]) => [userId, Math.abs(balance)] as [string, number])
      .sort((a, b) => b[1] - a[1]); // Sort by debt descending

    let creditorIndex = 0;
    let debtorIndex = 0;

    // Match creditors with debtors to minimize number of transactions
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const [creditorId, creditAmount] = creditors[creditorIndex];
      const [debtorId, debtAmount] = debtors[debtorIndex];

      const settlementAmount = Math.min(creditAmount, debtAmount);

      // Only create settlement if amount is significant
      if (settlementAmount > this.PRECISION) {
        settlements.push({
          from: debtorId,
          to: creditorId,
          amount: this.roundToPrecision(settlementAmount)
        });

        // Update remaining amounts
        creditors[creditorIndex][1] -= settlementAmount;
        debtors[debtorIndex][1] -= settlementAmount;
      }

      // Move to next creditor or debtor if amount is exhausted
      if (creditors[creditorIndex][1] <= this.PRECISION) {
        creditorIndex++;
      }
      if (debtors[debtorIndex][1] <= this.PRECISION) {
        debtorIndex++;
      }
    }

    return settlements;
  }

  /**
   * Validate balance calculation accuracy
   */
  static validateBalances(
    expenses: ExpenseData[],
    result: BalanceResult
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that total credits equal total debits
    const totalCredits = Object.values(result.balances)
      .filter(b => b > 0)
      .reduce((sum, b) => sum + b, 0);

    const totalDebits = Object.values(result.balances)
      .filter(b => b < 0)
      .reduce((sum, b) => sum + Math.abs(b), 0);

    if (Math.abs(totalCredits - totalDebits) > this.PRECISION) {
      errors.push(`Balance mismatch: credits=${totalCredits.toFixed(2)}, debits=${totalDebits.toFixed(2)}`);
    }

    // Check that settlements resolve all balances
    const balancesAfterSettlement = { ...result.balances };
    result.settlements.forEach(settlement => {
      balancesAfterSettlement[settlement.from] += settlement.amount;
      balancesAfterSettlement[settlement.to] -= settlement.amount;
    });

    const remainingBalances = Object.values(balancesAfterSettlement)
      .filter(balance => Math.abs(balance) > this.PRECISION);

    if (remainingBalances.length > 0) {
      errors.push(`Settlements don't resolve all balances: remaining=${remainingBalances.join(', ')}`);
    }

    // Check that all expense amounts are accounted for
    const totalExpenseAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalSplitAmount = expenses.reduce((sum, expense) => {
      const splitSum = expense.splits.reduce((splitSum, split) => {
        return splitSum + (typeof split.amount === 'number' && !isNaN(split.amount) ? split.amount : 0);
      }, 0);
      return sum + splitSum;
    }, 0);

    if (Math.abs(totalExpenseAmount - totalSplitAmount) > this.PRECISION) {
      errors.push(`Split amount mismatch: expenses=${totalExpenseAmount.toFixed(2)}, splits=${totalSplitAmount.toFixed(2)}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get balance summary for a specific user
   */
  static getUserBalanceSummary(
    userId: string,
    result: BalanceResult,
    expenses: ExpenseData[]
  ) {
    const userBalance = result.balances[userId] || 0;
    const userSettlements = result.settlements.filter(
      s => s.from === userId || s.to === userId
    );

    // Calculate what user paid vs their share
    let totalPaid = 0;
    let totalShare = 0;

    expenses.forEach(expense => {
      if (expense.paidBy === userId) {
        totalPaid += expense.amount;
      }
      const userSplit = expense.splits.find(split => split.userId === userId);
      if (userSplit) {
        totalShare += typeof userSplit.amount === 'number' && !isNaN(userSplit.amount) ? userSplit.amount : 0;
      }
    });

    return {
      balance: userBalance,
      totalPaid: this.roundToPrecision(totalPaid),
      totalShare: this.roundToPrecision(totalShare),
      settlements: userSettlements,
      owesTotal: Math.max(0, -userBalance),
      owedTotal: Math.max(0, userBalance)
    };
  }

  /**
   * Round number to specified precision
   */
  private static roundToPrecision(value: number): number {
    return Math.round(value / this.PRECISION) * this.PRECISION;
  }

  /**
   * Compare two balance results for changes
   */
  static compareBalanceResults(
    oldResult: BalanceResult | null,
    newResult: BalanceResult
  ): { hasChanges: boolean; changes: string[] } {
    if (!oldResult) {
      return { hasChanges: true, changes: ['Initial calculation'] };
    }

    const changes: string[] = [];

    // Compare individual balances
    Object.keys({ ...oldResult.balances, ...newResult.balances }).forEach(userId => {
      const oldBalance = oldResult.balances[userId] || 0;
      const newBalance = newResult.balances[userId] || 0;

      if (Math.abs(oldBalance - newBalance) > this.PRECISION) {
        changes.push(`${userId}: ${oldBalance.toFixed(2)} → ${newBalance.toFixed(2)}`);
      }
    });

    // Compare settlement counts
    if (oldResult.settlements.length !== newResult.settlements.length) {
      changes.push(`Settlements: ${oldResult.settlements.length} → ${newResult.settlements.length}`);
    }

    return {
      hasChanges: changes.length > 0,
      changes
    };
  }
}
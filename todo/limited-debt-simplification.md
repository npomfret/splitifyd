# Limited Debt Simplification in `debt-simplifier.js`

## Problem
- **Location**: `webapp/js/utils/debt-simplifier.js`
- **Description**: The `simplifyDebts` function currently only simplifies direct reciprocal debts between two individuals (e.g., if A owes B $10 and B owes A $5, it correctly nets this to A owes B $5). However, it does not handle more complex debt networks, such as triangular debts (e.g., A owes B, B owes C, and C owes A). In such scenarios, the function will output all three individual debts instead of simplifying them into fewer transactions.
- **Current vs Expected**:
  - Current: Only direct reciprocal debts are simplified.
  - Expected: The function should identify and simplify complex debt cycles (e.g., A->B, B->C, C->A should be simplified to fewer, more direct transactions, potentially involving a central clearing party or a different set of direct payments).

## Solution
- Implement a more advanced debt simplification algorithm. Common approaches include:
    - **Graph-based algorithms**: Represent debts as a directed graph and find cycles to simplify. This often involves finding paths from debtors to creditors and adjusting balances.
    - **Netting algorithm**: Calculate the net balance for each person (who they owe vs. who owes them). Then, iterate through positive and negative balances to find the minimum number of transactions. This typically involves sorting debtors and creditors and matching them up.

## Impact
- **Type**: Feature improvement, correctness for complex scenarios.
- **Risk**: Medium (implementing a new algorithm requires careful testing to ensure correctness and handle edge cases).
- **Complexity**: Moderate to Complex.
- **Benefit**: High value (provides a more accurate and useful debt simplification, reducing the number of transactions users need to make in real-world scenarios).

## Implementation Notes
- Research standard debt simplification algorithms (e.g., those used in financial clearing houses or similar applications).
- Consider the performance implications for a large number of users and transactions.
- Write comprehensive unit tests to cover various debt network configurations, including simple, reciprocal, and triangular debts.

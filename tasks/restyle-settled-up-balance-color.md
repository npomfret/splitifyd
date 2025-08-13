# Feature: Restyle "Settled Up" Balance Color

## Overview

To improve the visual language of the balance summaries, this task is to change the color used for "settled up" balances. This will create a clearer distinction between being owed money (a positive state) and being fully settled (a neutral state).

## The Problem

Currently, the application may use a single color (e.g., green) to represent both "You are owed" and "You are settled up". While both are positive financial states, they are distinct. Using the same color can make it harder for users to quickly differentiate between having an outstanding credit and having a zero balance.

## Proposed Change

1.  **"You are owed" Color:**
    -   This state should remain **green**. Green is universally understood to mean positive, credit, or "go". This is the correct color for representing money that is owed to the user.

2.  **"You are settled up" Color:**
    -   This state should be changed to a **light, neutral blue**.
    -   **Rationale:** Blue is a calm, neutral color that effectively communicates a state of equilibrium or "information". It indicates that the balance is zero without implying the strong positive connotation of green. This creates a clear visual hierarchy:
        -   **Red (`#e74c3c`):** You owe money (negative, action required).
        -   **Green (`#2ecc71`):** You are owed money (positive).
        -   **Light Blue (`#3498db` or a lighter shade):** You are settled up (neutral, informational).

## UI Components to Update

This color change needs to be applied consistently wherever balance summaries are displayed:

-   **Dashboard:** The main "You owe" / "You are owed" summary.
-   **Group Detail Page:** The balance summary within each group.
-   **Settlements Page:** Any summary views on the settlement page.

## Implementation Details

-   **CSS/Styling:**
    -   Locate the CSS classes or styled-component rules that apply to the balance text.
    -   Update the color logic. This might involve changing a class name or updating a conditional style.

**Example (Conceptual):**

```tsx
// In a BalanceDisplay component

const getBalanceColor = (balance) => {
  if (balance < 0) {
    return 'text-red-500'; // You owe
  }
  if (balance > 0) {
    return 'text-green-500'; // You are owed
  }
  // The key change is here:
  return 'text-blue-400'; // You are settled up
};

return <p className={getBalanceColor(balance)}>{formatBalance(balance)}</p>;
```

## Benefits

-   **Improved Clarity:** Creates a more intuitive and instantly understandable visual system for user balances.
-   **Better UX:** Reduces cognitive load by providing clear visual cues for different financial states.
-   **Polished UI:** Adds a level of design polish and thoughtfulness to the application's financial displays.

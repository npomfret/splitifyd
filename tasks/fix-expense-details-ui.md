# Task: Fix and Improve Expense Details Page UI

## Overview

This task addresses a bug and several UI/UX shortcomings on the Expense Details page to improve clarity, correctness, and user experience.

## 1. Bug Fix: Incorrect Currency Display

### Problem
The Expense Details page currently displays all amounts with a dollar sign (`$`) regardless of the expense's actual currency (e.g., EUR, GBP). This is misleading and incorrect, especially for groups using multiple currencies.

### Root Cause
The component rendering the amount on the details page is likely not using the `currencyFormatter` utility or is not being passed the `currency` property from the expense object, causing it to fall back to a default format.

### Solution
-   **Identify the Component:** Locate the React component responsible for rendering the Expense Details page/view.
-   **Pass Currency Data:** Ensure the full expense object, including the `currency` field, is available to the component.
-   **Use Formatter:** Modify the component to use the existing `currencyFormatter` utility (from `webapp-v2/src/utils/currency/currencyFormatter.ts`) to display the amount. This will ensure the correct currency symbol and formatting rules are applied based on the expense's currency.

## 2. UI/UX Improvements

### Problem
The current Expense Details page has a generic, static layout that doesn't provide immediate context about the expense being viewed.

### Proposed Changes

#### A. Dynamic Page Header

-   **Current:** The page has a static header, likely reading "Expense Details".
-   **Proposed:** Replace the static header with a dynamic one that includes the expense's description and its formatted amount.
    -   The description should be truncated with an ellipsis (`...`) if it exceeds a certain length (e.g., 40 characters) to prevent it from wrapping awkwardly.
    -   The amount must be formatted with the correct currency, using the fix described in section 1.
-   **Example:**
    -   **Before:** `Expense Details`
    -   **After:** `Dinner with colleagues - £45.00`

#### B. Human-Readable Relative Timestamp

-   **Current:** The page displays the absolute date of the expense (e.g., "August 10, 2025").
-   **Proposed:** Below the absolute date, add a secondary text element that displays the relative time in a human-readable format.
    -   This provides users with a quicker sense of how long ago the expense occurred.
-   **Implementation:** Use a library like `date-fns` (specifically the `formatDistanceToNow` function) to generate this string.
-   **Example:**
    -   `August 10, 2025`
    -   `(3 days ago)`

## Implementation Details

-   **File to Modify:** The primary file to be changed will likely be the component that renders the expense detail view (e.g., `ExpenseDetailPage.tsx` or a similar component in `webapp-v2/src/pages/` or `webapp-v2/src/components/`).
-   **Utilities to Use:**
    -   `currencyFormatter.ts` for currency formatting.
    -   `date-fns` (or similar) for the relative timestamp.
    -   A simple string truncation utility for the header description.

## Benefits

-   **Correctness:** Fixes a critical bug, ensuring financial data is displayed accurately.
-   **Context:** The dynamic header provides immediate, at-a-glance information about the expense.
-   **Improved UX:** The relative timestamp makes the information easier to process for users.
-   **Consistency:** Aligns the page with modern UI patterns where the page title reflects the content.

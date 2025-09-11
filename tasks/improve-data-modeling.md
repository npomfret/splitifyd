# Task: Improve Core Data Modeling

## 1. Overview

This document outlines two key architectural improvements for the project's core data models to enhance type safety and reliability. These changes address fundamental issues with how unique identifiers (IDs) and monetary values are handled, which will prevent entire classes of bugs at compile time and reduce runtime errors.

---

## 2. Branded Types for ID Safety

### 2.1. The Problem: `string` is not specific enough

Currently, all unique identifiers (`userId`, `groupId`, `expenseId`, etc.) are typed as `string`. This is a common practice, but it provides no compile-time safety. It is dangerously easy for a developer to accidentally pass a `userId` to a function that expects a `groupId`, and the TypeScript compiler will not catch this error.

### 2.2. The Solution: Branded Types

We will implement a **Branded Types** pattern. This creates distinct, nominal types that are still represented as `string`s at runtime (imposing no performance overhead) but are treated as unique and incompatible by the TypeScript compiler.

### 2.3. Implementation Plan

1.  **Define Branded Types (`packages/shared/src/branded-types.ts`):**
    A new file will be created in the shared package to define the generic `Brand` type and all specific ID types.

    ```typescript
    export type Brand<K, T> = K & { __brand: T };

    export type UserId = Brand<string, 'UserId'>;
    export type GroupId = Brand<string, 'GroupId'>;
    export type ExpenseId = Brand<string, 'ExpenseId'>;
    // ... and so on for all other IDs.
    ```

2.  **Update Codebase:**
    Gradually refactor function signatures, interfaces, and type definitions throughout the entire codebase to use these new, specific types instead of generic `string`s.
    - **Before:** `function getGroup(groupId: string) { ... }`
    - **After:** `function getGroup(groupId: GroupId) { ... }`

3.  **Handle Type Casting:**
    At the boundaries of the system where raw strings are received (e.g., from API request parameters), explicitly cast the string to the appropriate branded type. This signals a deliberate type assertion.
    `const groupId = req.params.id as GroupId;`

---

## 3. Money Value Object

### 3.1. The Problem: Floating-Point Math is Unsafe for Money

Monetary values are currently stored and calculated as floating-point `number`s. This is a well-known anti-pattern that can lead to precision and rounding errors. Additionally, the rules for handling different currencies (e.g., number of decimal places) are not encapsulated.

### 3.2. The Solution: A `Money` Value Object

We will create a `Money` class to encapsulate all logic and data related to monetary values. This standardizes money calculations and formatting, making them safe and reliable.

### 3.3. Implementation Plan

1.  **Create a `Money` Class (`packages/shared/src/money.ts`):**
    This class will be the single source of truth for handling money.

2.  **Store Amount as an Integer:**
    The `Money` object will store all amounts in their smallest unit (e.g., cents) as a safe integer to completely avoid floating-point inaccuracies.

3.  **Centralize Currency Logic:**
    The class will use the metadata from `firebase/functions/src/static-data/currencies.json` (which defines `decimal_digits` for each currency) to correctly convert between decimal and integer representations.

    ```typescript
    class Money {
        private constructor(
            public readonly amountInCents: number,
            public readonly currency: string,
        ) {}

        static fromDecimal(amount: number, currency: string): Money {
            const decimalDigits = getCurrencyDecimalDigits(currency); // Fetches from currencies.json
            const amountInCents = Math.round(amount * 10 ** decimalDigits);
            return new Money(amountInCents, currency);
        }

        public toDecimal(): number {
            const decimalDigits = getCurrencyDecimalDigits(this.currency);
            return this.amountInCents / 10 ** decimalDigits;
        }

        public add(other: Money): Money {
            if (this.currency !== other.currency) {
                throw new Error('Cannot add money of different currencies.');
            }
            return new Money(this.amountInCents + other.amountInCents, this.currency);
        }

        // ... methods for safe subtraction, multiplication, and formatting.
    }
    ```

4.  **Refactor the Data Model:**
    Update all relevant interfaces and schemas (e.g., `Expense`, `Settlement`) to replace the separate `amount` and `currency` fields with a single `money: Money` field. This ensures that monetary values are always handled through the safe, encapsulated `Money` object.

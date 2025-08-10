# WebApp-v2 Code Review and Refactoring Suggestions

This document outlines the findings of a code review of the `webapp-v2` codebase, along with suggestions for improvement. The goal of these suggestions is to improve the maintainability, readability, and overall quality of the code.

## 1. Overly Complex Components

Several components in the codebase have grown to be overly complex, managing too much state and logic in one place. This makes them difficult to understand, test, and maintain.

### `AddExpensePage.tsx`

*   **Problem**: This is the most complex component in the application. It handles a large amount of form state, validation logic, and submission handling. The `useEffect` hooks for initialization and auto-saving are complex and have a lot of dependencies.
*   **Suggestion**:
    *   **Extract form logic into a custom hook**: Create a `useExpenseForm` hook to encapsulate the form state, validation, and submission logic. This will make the `AddExpensePage` component much cleaner and easier to read.
    *   **Create smaller components**: The participant selection, split type selection, and split amount inputs could all be extracted into their own components. This would improve reusability and make the main component smaller.
    *   **Simplify state management**: Instead of using `useSignal` for each form field, consider using a single `useSignal` with an object for the form data, or a more robust form management library like `preact-hook-form`.

### `GroupDetailPage.tsx`

*   **Problem**: This component is also quite large and manages a lot of state. It fetches and manages the state for the group, members, expenses, and balances. It also handles the logic for modals and other UI elements.
*   **Suggestion**:
    *   **Use a dedicated store for the group detail page**: The `groupDetailStore` is a good start, but the component itself still has a lot of logic for handling modals and other UI state. Consider moving more of this logic into the store or a dedicated UI state store.
    *   **Create more specific components**: The left and right sidebars could be extracted into their own components to make the main layout cleaner.

## 2. Inconsistent State Management

*   **Problem**: The application uses a mix of Preact signals (`@preact/signals`) and custom-built stores. While this is not inherently bad, the interaction between them can be confusing. For example, some components read directly from the stores, while others use `useComputed` to derive state.
*   **Suggestion**: Establish a clear convention for how to interact with the stores. For example, always use `useComputed` to select state from the stores in components, and only call store actions directly. This will make the data flow more predictable.

## 3. API Client and Error Handling

*   **`ApiClient.ts`**:
    *   **Problem**: The `ApiClient` has a lot of convenience methods for each endpoint. This can lead to code duplication if the API changes.
    *   **Suggestion**:
        *   **Generic request method**: Instead of having a method for each endpoint, consider a more generic `request` method that takes the endpoint, method, and options as arguments. This would make the `ApiClient` more flexible and easier to maintain. The existing convenience methods could be kept as wrappers around the generic method.
        *   **Centralized error handling**: The error handling logic is repeated in each convenience method. This could be centralized in the main `request` method to avoid duplication.

## 4. Code Duplication

*   **Problem**: There is some code duplication in the UI components. For example, the loading spinners and error messages are implemented in multiple places.
*   **Suggestion**: Create more reusable UI components. The `ui` directory is a good start, but it could be expanded with more general-purpose components like `LoadingIndicator` and `ErrorMessage`.

## 5. Fragile Routing

*   **Problem**: The routing in `App.tsx` is simple, but it uses hardcoded strings for the paths. This can be error-prone if the routes change.
*   **Suggestion**: Create a separate file for the route paths, and import them into `App.tsx`. This will make it easier to manage the routes and avoid typos.

## 6. Lack of a clear styling strategy

*   **Problem**: The project uses Tailwind CSS, which is great for utility-first styling. However, there are some inconsistencies in how it's used. Some components have a lot of inline classes, while others use `@apply` in CSS files.
*   **Suggestion**: Establish a clear styling guide for the project. This should include conventions for when to use inline classes, when to use `@apply`, and how to organize the CSS files.

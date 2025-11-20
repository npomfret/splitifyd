# Refactor Global Click Listener

## Problem

The current implementation of analytics logging for user interactions relies on a global click listener in `webapp-v2/src/main.tsx`. This listener intercepts every click on the page and attempts to determine what was clicked and log it. This approach has several significant drawbacks:

1.  **Brittleness**: The listener uses a complex set of heuristics to guess the context of a click (e.g., checking `tagName`, `role`, `closest('button')`). This is prone to errors and will likely break as the application evolves. If a developer adds a new type of clickable element, they also have to remember to update the global listener, which is a pattern that's easy to forget.

2.  **Performance**: The listener runs on *every single click* anywhere in the application, including clicks on non-interactive elements. This is inefficient and can lead to performance degradation, especially on complex pages.

3.  **Lack of Clarity**: It's not immediately obvious how click logging is implemented. A developer looking at a component with an `onClick` handler might not realize it's being logged by a global listener. This makes the code harder to understand and maintain.

4.  **Inconsistent Logging**: The existing `Button` component has its own logging logic and has to explicitly opt-out of the global listener using a `data-logged` attribute. This creates two separate and inconsistent ways of handling click logging.

## Proposed Solution

The proposed solution is to eliminate the global click listener entirely and move to a component-based logging approach.

1.  **Introduce a `Clickable` Component**: Create a new generic `Clickable` component. This component will be a simple wrapper (e.g., a `<span>`) that can be used to make any element or group of elements clickable and ensure that interaction is logged correctly. It will handle its own logging, similar to the existing `Button` component.

2.  **Systematic Refactoring**: Incrementally refactor the entire codebase to replace all ad-hoc `onClick` handlers with either the existing `Button` component (for buttons) or the new `Clickable` component (for all other interactive elements like links, divs, etc.).

3.  **Remove the Global Listener**: Once all clickable elements in the application are using a standardized component that handles its own logging, the global click listener in `main.tsx` can be safely removed.

## Benefits

This refactoring will result in a more robust, performant, and maintainable application:

1.  **Improved Maintainability**: Logging logic will be co-located with the component, making it explicit and easy to understand. Developers will no longer need to worry about a hidden global listener.
2.  **Enhanced Performance**: Click handlers will only be attached to elements that are actually interactive, eliminating the overhead of the global listener.
3.  **Code Quality and Consistency**: Enforces a single, consistent pattern for handling user interactions and logging, improving overall code quality.
4.  **Developer Experience**: Provides clear, reusable components (`Button`, `Clickable`) for handling user interactions, making development faster and less error-prone.

## Updated Plan (2025-11-20)

**Design direction**
- Introduce a small `Clickable` wrapper that forwards refs/ARIA, accepts `eventName`/`eventProps`, and calls `logUserAction` (or `logButtonClick` parity) before delegating to its `onClick`. Keep payload fields aligned with `Button` (`buttonText`, `page`, `variant`, `id`) to avoid dashboard regressions.
- Keep `Button` as-is for now; share event-schema constants between `Button` and `Clickable` once added.

**Migration steps**
1. Add `Clickable` + unit tests (passes through props, logs once, respects disabled-like props if provided).
2. Replace ad-hoc `onClick` on non-button elements with `Clickable`, starting with low-risk views; ensure icon-only controls carry `aria-label`.
3. After coverage is high, remove the global capture listener from `webapp-v2/src/main.tsx`.

**Guardrails**
- Consider ESLint rule to flag `onClick` on elements that are not `Button`/`Clickable`.
- Verify a few key analytics payloads against current outputs before removing the listener.

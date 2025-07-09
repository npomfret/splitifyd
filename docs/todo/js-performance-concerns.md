# Performance Concerns

This document outlines key performance issues in the `webapp/js` directory that can lead to a slow, unresponsive user experience.

## 1. Inefficient DOM Updates

*   **Problem:** The application frequently re-renders large portions of the DOM when only a small piece of data has changed. This is done by clearing a container (`.innerHTML = ''`) and then rebuilding the entire HTML string for all items in a list.
*   **Impact:** This is computationally expensive. It causes layout thrashing, where the browser has to repeatedly calculate layout, paint, and composite the page. On devices with slower CPUs, this leads to noticeable jank and unresponsiveness.
*   **Example:** When one expense is added to a group, the entire list of expenses is rebuilt from scratch.

### Research & Detailed Analysis

*   **Targeted Updates:** The key to efficient rendering is to make the smallest possible change to the DOM. Instead of rebuilding an entire list, only add, remove, or update the specific element that changed.
*   **Virtual DOM (Concept):** Frameworks like React and Vue solve this with a "virtual DOM." They compute the difference (a "diff") between the new and old UI state and then apply only those minimal changes to the actual DOM.
*   **Vanilla JS Approach:** While implementing a full virtual DOM is overkill, the principle can be applied manually. When data changes, identify the corresponding DOM element (e.g., via a `data-id` attribute) and update its properties directly.

### Implementation Plan

1.  **Adopt a Keyed-List Strategy:**
    *   When rendering lists, assign a unique ID to the top-level element of each item. For example: `<li data-expense-id="${expense.id}">...</li>`.
2.  **Implement Targeted Update Functions:**
    *   **`addListItem(item)`:** A function that creates a single new list item and appends it to the container.
    *   **`updateListItem(item)`:** A function that finds the existing element using `document.querySelector('[data-expense-id="' + item.id + '"]')` and updates its `textContent` or attributes.
    *   **`removeListItem(itemId)`:** A function that finds the element by its ID and calls `.remove()`.
3.  **Refactor Rendering Logic:**
    *   Change the data-handling logic to call these new functions instead of re-rendering the entire list.

## 2. Lack of Throttling/Debouncing

*   **Problem:** Event handlers for frequent events like search input (`keyup`), window resizing, or scrolling trigger a function on every single event. This can lead to a high volume of expensive operations, such as API calls or DOM manipulations.
*   **Impact:** This can overwhelm the browser's main thread, making the UI feel sluggish. It can also lead to unnecessary API requests, wasting network bandwidth and server resources.

### Implementation Plan

1.  **Create a `debounce` Utility:**
    *   Add a `debounce` function to `webapp/js/utils/common.js`. A debounce function delays invoking a function until after a certain amount of time has passed without it being called again. It's perfect for search inputs.
    *   **Example Usage:** `searchInput.addEventListener('input', debounce(handleSearch, 300));`
2.  **Create a `throttle` Utility:**
    *   Add a `throttle` function. Throttling ensures a function is called at most once every X milliseconds. It's ideal for rate-limiting events like scrolling or resizing.
3.  **Apply to Event Listeners:**
    *   Identify all handlers for frequent events and wrap them in `debounce` or `throttle` as appropriate.

## 3. Synchronous Operations

*   **Problem:** Some event handlers may be performing synchronous, blocking operations that freeze the UI.
*   **Impact:** The browser's main thread is blocked, and the user cannot interact with the page until the operation completes.

### Implementation Plan

1.  **Audit for Blocking Code:**
    *   Review event handlers for any long-running loops or synchronous calculations.
2.  **Offload to Asynchronous Tasks:**
    *   Use `setTimeout(..., 0)` to yield to the main thread for non-critical tasks.
    *   For very heavy computations, consider using **Web Workers** to run them in a background thread, although this is likely overkill for this application's needs at present.

## 4. No Lazy Loading

*   **Problem:** All JavaScript files are loaded upfront when the first page is visited, regardless of whether they are needed. For example, the code for `expense-detail.html` is loaded on the `dashboard.html` page.
*   **Impact:** This increases the initial page load time and consumes more memory than necessary.

### Implementation Plan

1.  **Dynamic Imports:**
    *   Since the project is moving to ES6 modules, we can use dynamic `import()`. This is a function-like expression that returns a Promise, allowing modules to be loaded on demand.
2.  **Page-Specific Initialization:**
    *   Create an "init" script for each page (e.g., `dashboard-init.js`, `group-detail-init.js`).
    *   The main script on each page will be very small. It will determine which components are needed and then load them using dynamic `import()`.
    *   **Example in `group-detail.html`'s main script:**
        ```javascript
        if (document.querySelector('#expense-list')) {
          const { renderExpenseList } = await import('./components/expense-list.js');
          renderExpenseList();
        }
        ```

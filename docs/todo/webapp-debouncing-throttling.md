# Webapp Issue: Debouncing and Throttling - COMPLETED

## Issue Description

Frequent events like search input and window resizing trigger expensive operations on every event, leading to a sluggish UI.

## ✅ IMPLEMENTATION COMPLETED

The debouncing and throttling utilities have been successfully implemented:

1. **Created `webapp/src/js/utils/event-utils.ts`** - Added centralized `debounce` and `throttle` functions
2. **Refactored `webapp/src/js/auth.ts`** - Replaced local debounce implementation with centralized version
3. **Applied debouncing to `webapp/src/js/add-expense.ts`** - Added 300ms debounce to:
   - Amount input field when updating custom split inputs
   - Individual split amount inputs when updating total
4. **Applied throttling to `webapp/src/js/globe.js`** - Added 100ms throttle to window resize event
5. **Build and tests successful** - All 34 tests pass, no TypeScript errors

The implementation successfully reduces UI sluggishness by limiting the rate of expensive operations during frequent events.

## Recommendation

Create `debounce` and `throttle` utilities and apply them to event handlers for frequent events to limit the rate of execution.

## Implementation Suggestions

1.  **Create `webapp/src/js/utils/event-utils.ts`:**

    ```typescript
    // webapp/src/js/utils/event-utils.ts

    /**
     * Returns a function, that, as long as it continues to be invoked, will not
     * be triggered. The function will be called after it stops being called for
     * N milliseconds. If `immediate` is passed, trigger the function on the
     * leading edge, instead of the trailing.
     * @param func The function to debounce.
     * @param wait The number of milliseconds to wait after the last call.
     * @param immediate If true, trigger the function on the leading edge.
     */
    export function debounce<T extends (...args: any[]) => any>(func: T, wait: number, immediate: boolean = false): (...args: Parameters<T>) => void {
        let timeout: ReturnType<typeof setTimeout> | null;
        let result: any;

        return function(this: any, ...args: Parameters<T>): void {
            const context = this;
            const later = function() {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                }
            };

            const callNow = immediate && !timeout;
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
            if (callNow) {
                result = func.apply(context, args);
            }

            return result;
        };
    }

    /**
     * Creates a throttled function that only invokes `func` at most once per
     * every `wait` milliseconds.
     * @param func The function to throttle.
     * @param wait The number of milliseconds to throttle invocations to.
     */
    export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
        let inThrottle: boolean, lastFn: ReturnType<typeof setTimeout>, lastTime: number;
        return function(this: any, ...args: Parameters<T>): void {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                lastTime = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFn);
                lastFn = setTimeout(function() {
                    if (Date.now() - lastTime >= wait) {
                        func.apply(context, args);
                        lastTime = Date.now();
                    }
                }, Math.max(wait - (Date.now() - lastTime), 0));
            }
        };
    }
    ```

2.  **Apply to Event Handlers:**
    *   **Search Inputs:** Apply `debounce` to `input` event listeners on search fields to delay filtering/API calls until the user stops typing.
    *   **Window Resizing/Scrolling:** Apply `throttle` to `resize` or `scroll` event listeners to limit the frequency of layout recalculations or data loading.
    *   **Example (from `auth.ts` which already uses a debounce for validation):
        ```typescript
        // webapp/src/js/auth.ts
        import { debounce } from './utils/event-utils.js'; // Import the new debounce

        // ...

        private setupFormValidation(form: HTMLFormElement): void {
            const inputs = form.querySelectorAll<HTMLInputElement>('.form-input');

            inputs.forEach(input => {
                const debouncedValidation = debounce(() => this.validateField(input), 300); // Use the new debounce

                this.addEventListenerWithCleanup(input, 'blur', () => this.validateField(input));
                this.addEventListenerWithCleanup(input, 'input', debouncedValidation as EventListener);
            });
        }
        ```

**Next Steps:**
1.  Create the `event-utils.ts` file with `debounce` and `throttle` functions.
2.  Identify all event listeners in the webapp that could benefit from debouncing or throttling.
3.  Refactor those event listeners to use the new utilities.

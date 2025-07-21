# Task: Create a `BaseComponent` Class

**Objective:** To establish a standardized, reusable foundation for all UI components by creating a `BaseComponent` class. This will reduce boilerplate code, enforce a consistent component lifecycle, and simplify state management within components.

**Status:** Not Started

**Dependencies:**
*   `centralize-ui-component-creation.md`: The `BaseComponent` will be more effective if it can leverage a standardized UI kit.

---

## Detailed Steps

### Step 1: Create the `BaseComponent` Class

1.  **Create a new directory:** `webapp/src/js/components`.
2.  **Create a new file:** `webapp/src/js/components/BaseComponent.ts`.
3.  **Implement the `BaseComponent` class:** This class will serve as the blueprint for all other components.

    ```typescript
    // webapp/src/js/components/BaseComponent.ts

    export abstract class BaseComponent<T extends object = object> {
      protected element: HTMLElement;
      protected state: T;

      constructor(initialState: T = {} as T) {
        this.state = initialState;
        this.element = this.render();
        this.addEventListeners();
      }

      // Abstract method to be implemented by subclasses
      abstract render(): HTMLElement;

      // Optional methods for subclasses to override
      addEventListeners(): void {}
      removeEventListeners(): void {}

      setState(newState: Partial<T>): void {
        this.state = { ...this.state, ...newState };
        const newElement = this.render();
        this.element.replaceWith(newElement);
        this.element = newElement;
        this.addEventListeners();
      }

      destroy(): void {
        this.removeEventListeners();
        this.element.remove();
      }
    }
    ```

### Step 2: Refactor the Warning Banner into a Component

**Target Files:**
*   `webapp/src/js/utils/ui-messages.ts`
*   `webapp/src/js/app-init.ts`

**Actions:**

1.  **Create a new `WarningBanner` component:**
    *   **File:** `webapp/src/js/components/WarningBanner.ts`.
    *   **Implementation:** This class will extend `BaseComponent` and encapsulate all the logic for the warning banner.

        ```typescript
        // webapp/src/js/components/WarningBanner.ts
        import { BaseComponent } from './BaseComponent';

        interface WarningBannerState {
          message: string;
          isVisible: boolean;
        }

        export class WarningBanner extends BaseComponent<WarningBannerState> {
          constructor() {
            super({ message: '', isVisible: false });
          }

          render(): HTMLElement {
            const banner = document.createElement('div');
            banner.id = 'warningBanner';
            banner.className = `warning-banner ${this.state.isVisible ? '' : 'hidden'}`;
            banner.innerHTML = `
              <span class="warning-banner__content">${this.state.message}</span>
              <div class="warning-banner__close-container">
                <button class="warning-banner__close">&times;</button>
              </div>
            `;
            return banner;
          }

          addEventListeners(): void {
            this.element.querySelector('.warning-banner__close')?.addEventListener('click', () => {
              this.hide();
            });
          }

          show(message: string): void {
            this.setState({ message, isVisible: true });
          }

          hide(): void {
            this.setState({ isVisible: false });
          }
        }
        ```

2.  **Update `app-init.ts`:**
    *   Instantiate the new `WarningBanner` component.
    *   Replace the direct DOM manipulation in `setupWarningBanner` with calls to the `warningBanner` component's `show` and `hide` methods.
    *   The global `showWarning` and `hideWarning` functions in `ui-messages.ts` should be updated to use the new component instance.

3.  **Clean up `ui-messages.ts`:**
    *   Remove the old, imperative `showWarning` and `hideWarning` implementations.

---

## Acceptance Criteria

*   The `BaseComponent` class is created in `webapp/src/js/components/BaseComponent.ts`.
*   The `WarningBanner` component is created in `webapp/src/js/components/WarningBanner.ts`.
*   The warning banner functionality is fully handled by the new `WarningBanner` component.
*   The `app-init.ts` file is updated to use the new component.
*   There is no functional or visual regression in the warning banner's behavior.
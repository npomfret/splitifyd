# Task: Create Reusable Form Components

**Objective:** To replace the manually created forms with reusable form components. This will encapsulate validation and error handling logic, reduce duplicated code, and ensure a consistent user experience across all forms.

**Status:** Not Started

**Dependencies:**
*   `create-a-basecomponent-class.md`: The `FormField` component will extend `BaseComponent`.

---

## Detailed Steps

### Step 1: Create a `FormField` Component

1.  **Create the file:** `webapp/src/js/components/FormField.ts`.
2.  **Implement the `FormField` component:** This component will extend `BaseComponent` and will be responsible for rendering a label, input, and error message.

    ```typescript
    // webapp/src/js/components/FormField.ts
    import { BaseComponent } from './BaseComponent';

    interface FormFieldState {
      value: string;
      error: string | null;
      touched: boolean;
    }

    export class FormField extends BaseComponent<FormFieldState> {
      private readonly label: string;
      private readonly inputType: string;

      constructor(label: string, inputType: string = 'text') {
        super({ value: '', error: null, touched: false });
        this.label = label;
        this.inputType = inputType;
      }

      render(): HTMLElement {
        const field = document.createElement('div');
        field.className = 'form-group';
        field.innerHTML = `
          <label class="form-label">${this.label}</label>
          <input type="${this.inputType}" class="form-input" value="${this.state.value}">
          <div class="form-error">${this.state.error || ''}</div>
        `;
        return field;
      }

      addEventListeners(): void {
        this.element.querySelector('input')?.addEventListener('input', (e) => {
          this.setState({ value: (e.target as HTMLInputElement).value, touched: true });
        });
      }

      // Add validation logic here
    }
    ```

### Step 2: Refactor the Login Form

**Target Files:**
*   `webapp/login.html`
*   `webapp/src/js/login-init.ts`

**Actions:**

1.  **Update `login.html`:**
    *   Remove the hardcoded form fields. The body of the `login.html` should now only contain a single container element, like `<div id="login-form-container"></div>`.

2.  **Update `login-init.ts`:**
    *   Import the new `FormField` component.
    *   Instantiate `FormField` components for the email and password fields.
    *   Append the `element` property of these components to the `login-form-container`.
    *   The form submission logic will now get the values from the `state` of the `FormField` components.

---

## Acceptance Criteria

*   The `FormField` component is created and implemented.
*   The login form is refactored to use the new `FormField` component.
*   The `login.html` file is simplified to a single container element.
*   Validation and error handling for the login form are now managed by the `FormField` components.
*   There is no functional or visual regression in the login form.
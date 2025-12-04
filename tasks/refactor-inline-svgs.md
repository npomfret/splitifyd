# Refactor Inline SVGs to Asset Components

## Objective
This report details the findings of a deep dive into the webapp codebase to identify all inline SVG images. The goal is to replace these with dedicated, reusable components that load from the `/src/assets` directory. This will improve maintainability, reduce code duplication, and allow for better code-splitting and asset optimization.

No code has been changed as part of this investigation.

## Summary of Findings

The webapp contains a significant number of inline SVGs used for icons and simple graphics. These are scattered across various UI components. The primary areas of concern are buttons, empty states, and layout components.

## Files with Inline SVGs

### 1. `webapp-v2/src/components/ui/ConfirmDialog.tsx`
- **SVG 1 (Danger Icon):**
  - **Context:** Used to indicate a dangerous or destructive action in the confirmation dialog.
  - **Code:**
    ```html
    <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
        <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
        />
    </svg>
    ```
- **SVG 2 (Warning Icon):**
  - **Context:** Used to indicate a warning or a non-destructive but important action.
  - **Code:**
    ```html
    <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    </svg>
    ```
- **SVG 3 (Info Icon):**
  - **Context:** Used for informational dialogs.
  - **Code:**
    ```html
    <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    </svg>
    ```

### 2. `webapp-v2/src/components/ui/Pagination.tsx`
- **SVG 1 (Previous Icon):**
  - **Context:** Used for the "Previous" button in pagination controls.
  - **Code:**
    ```html
    <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
        <path
            fill-rule='evenodd'
            d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
            clip-rule='evenodd'
        />
    </svg>
    ```
- **SVG 2 (Next Icon):**
  - **Context:** Used for the "Next" button in pagination controls.
  - **Code:**
    ```html
    <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
        <path
            fill-rule='evenodd'
            d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
            clip-rule='evenodd'
        />
    </svg>
    ```
### 3. `webapp-v2/src/components/ui/ErrorState.tsx`
- **SVG 1 (Error Icon):**
  - **Context:** Used to indicate an error state.
  - **Code:**
    ```html
    <svg className='h-6 w-6 text-semantic-error' fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true'>
        <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        />
    </svg>
    ```

### 4. `webapp-v2/src/components/ui/Alert.tsx`
- **SVG 1 (Info Icon):**
  - **Context:** Used for informational alerts.
  - **Code:**
    ```html
    <svg className='w-5 h-5 mr-2' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
        <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z' clipRule='evenodd' />
    </svg>
    ```
- **SVG 2 (Success Icon):**
  - **Context:** Used for success alerts.
  - **Code:**
    ```html
    <svg className='w-5 h-5 mr-2' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
        <path
            fillRule='evenodd'
            d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
            clipRule='evenodd'
        />
    </svg>
    ```
- **SVG 3 (Warning Icon):**
  - **Context:** Used for warning alerts.
  - **Code:**
    ```html
    <svg className='w-5 h-5 mr-2' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
        <path
            fillRule='evenodd'
            d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
            clipRule='evenodd'
        />
    </svg>
    ```
- **SVG 4 (Error Icon):**
  - **Context:** Used for error alerts.
  - **Code:**
    ```html
    <svg className='w-5 h-5 mr-2' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
        <path
            fillRule='evenodd'
            d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
            clipRule='evenodd'
        />
    </svg>
    ```
- **SVG 5 (Dismiss Icon):**
  - **Context:** Used for the dismiss button in alerts.
  - **Code:**
    ```html
    <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
    </svg>
    ```

### 5. `webapp-v2/src/components/ui/LoadingSpinner.tsx`
- **SVG 1 (Spinner Icon):**
  - **Context:** Used to indicate a loading state.
  - **Code:**
    ```html
    <svg
        data-testid={testId}
        className={`animate-spin ${sizeClasses[size]} ${color}`}
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        role='status'
        aria-label={t('uiComponents.loadingSpinner.loading')}
    >
        <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
        <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
    </svg>
    ```

### 6. `webapp-v2/src/components/ui/CurrencyAmountInput.tsx`
- **SVG 1 (Dropdown Icon):**
  - **Context:** Used for the dropdown arrow in the currency selector.
  - **Code:**
    ```html
    <svg
        className={`ml-1 h-4 w-4 text-text-muted/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden='true'
        focusable='false'
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 20 20'
        fill='currentColor'
    >
        <path
            fillRule='evenodd'
            d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
            clipRule='evenodd'
        />
    </svg>
    ```

### 7. `webapp-v2/src/components/ui/Button.tsx`
- **SVG 1 (Loading Spinner):**
  - **Context:** Used to indicate a loading state within a button.
  - **Code:**
    ```html
    <svg className='h-4 w-4 animate-spin text-current' viewBox='0 0 24 24' role='presentation' aria-hidden='true' focusable='false' data-testid='loading-spinner'>
        <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
        <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
    </svg>
    ```

### 8. `webapp-v2/src/components/ui/Toast.tsx`
- **SVG 1 (Success Icon):**
  - **Context:** Used for success toasts.
  - **Code:**
    ```html
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
    </svg>
    ```
- **SVG 2 (Error Icon):**
  - **Context:** Used for error toasts.
  - **Code:**
    ```html
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M6 18L18 6M6 6l12 12'
        />
    </svg>
    ```
- **SVG 3 (Warning Icon):**
  - **Context:** Used for warning toasts.
  - **Code:**
    ```html
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        />
    </svg>
    ```
- **SVG 4 (Info Icon):**
  - **Context:** Used for info toasts.
  - **Code:**
    ```html
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
    </svg>
    ```
- **SVG 5 (Dismiss Icon):**
  - **Context:** Used for the dismiss button in toasts.
  - **Code:**
    ```html
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
    </svg>
    ```
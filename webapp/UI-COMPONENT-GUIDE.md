# UI Component System Guide

## Overview

This component system eliminates HTML duplication by providing reusable components and templates. All components are built with vanilla JavaScript - no external libraries required.

## Directory Structure

```
webapp/
├── js/
│   ├── components/          # Reusable UI components
│   │   ├── header.js       # App header with logout
│   │   ├── navigation.js   # Page navigation with back button
│   │   ├── form-components.js  # Form fields and utilities
│   │   ├── list-components.js  # List items and states
│   │   └── modal.js        # Modal dialogs
│   ├── templates/          # Page templates and engine
│   │   ├── base-layout.js  # Base HTML structure
│   │   ├── template-engine.js  # Template rendering
│   │   └── page-builder.js # Page construction helpers
│   └── app-init.js        # App initialization and auth
```

## Usage Examples

### 1. Creating a New Page

```javascript
import { PageBuilder } from './js/templates/page-builder.js';

PageBuilder.buildAuthenticatedPage({
    title: 'My Page',
    pageId: 'myPage',
    renderContent: async (user) => {
        // Fetch data and build page content
        const data = await fetchData();
        return `<div>${data}</div>`;
    },
    onReady: (user) => {
        // Attach event listeners
    }
});
```

### 2. Using Form Components

```javascript
import { FormComponents } from './js/components/form-components.js';

const form = PageBuilder.renderForm({
    formId: 'myForm',
    fields: [
        {
            label: 'Name',
            id: 'name',
            required: true,
            placeholder: 'Enter your name'
        },
        {
            label: 'Amount',
            id: 'amount',
            type: 'number',
            step: '0.01',
            required: true
        },
        {
            label: 'Category',
            id: 'category',
            type: 'select',
            options: ['Food', 'Transport', 'Entertainment'],
            required: true
        }
    ],
    submitButton: { text: 'Submit', id: 'submitBtn' },
    onSubmit: async (data) => {
        // Handle form submission
        console.log(data);
    }
});
```

### 3. Using List Components

```javascript
import { ListComponents } from './js/components/list-components.js';

// Render expense list
const expenses = await fetchExpenses();
const expensesList = PageBuilder.renderList({
    items: expenses,
    renderItem: (expense) => ListComponents.renderExpenseItem(expense, userId),
    containerId: 'expensesList',
    emptyState: ListComponents.renderEmptyState({
        icon: 'fas fa-receipt',
        title: 'No expenses',
        message: 'Add your first expense'
    })
});
```

### 4. Using Modals

```javascript
import { ModalComponent } from './js/components/modal.js';

// Simple confirmation
const confirmed = await PageBuilder.showConfirmDialog({
    title: 'Delete Item',
    message: 'Are you sure?',
    confirmText: 'Delete',
    confirmClass: 'btn-danger'
});

// Custom modal
const modalHtml = ModalComponent.render({
    id: 'myModal',
    title: 'Custom Modal',
    body: '<p>Modal content here</p>',
    footer: '<button onclick="ModalComponent.hide(\'myModal\')">Close</button>'
});
document.body.insertAdjacentHTML('beforeend', modalHtml);
ModalComponent.show('myModal');
```

## Migration Guide

To migrate existing pages:

1. Replace the HTML file with a minimal loader
2. Move page logic to use PageBuilder
3. Replace repeated HTML with component calls
4. Use AppInit for common initialization

Example migration:

**Before (dashboard.html):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="...">
    <!-- 20+ lines of repeated meta tags and links -->
</head>
<body>
    <div id="warningBanner">...</div>
    <header class="header">
        <!-- Repeated header HTML -->
    </header>
    <main>
        <!-- Page content -->
    </main>
    <script>
        // Auth checks, logout logic, etc
    </script>
</body>
</html>
```

**After (dashboard.html):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script type="module">
        import { PageBuilder } from './js/templates/page-builder.js';
        
        PageBuilder.buildAuthenticatedPage({
            title: 'Dashboard',
            pageId: 'dashboard',
            renderContent: async (user) => {
                // Return page-specific content only
            }
        });
    </script>
</head>
<body>
    <div class="loading">Loading...</div>
</body>
</html>
```

## Benefits

1. **No Duplication**: Common HTML is defined once
2. **Consistency**: All pages use the same components
3. **Maintainability**: Changes propagate automatically
4. **Type Safety**: Components can validate inputs
5. **No Dependencies**: Pure vanilla JavaScript
6. **Performance**: Minimal overhead, efficient rendering

## Best Practices

1. Always use components for repeated patterns
2. Keep component methods pure and stateless
3. Use PageBuilder for standard page layouts
4. Handle errors with AppInit.handleError()
5. Use semantic component names and IDs
6. Test components in isolation before integration
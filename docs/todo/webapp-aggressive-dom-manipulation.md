# Webapp Issue: Aggressive DOM Manipulation (`dashboard.ts`)

## Issue Description

`dashboard.ts` performs aggressive DOM manipulation by calling `clearElement(document.head)` and `clearElement(document.body)`. This can lead to unintended side effects, such as removing essential meta tags, stylesheets, or scripts loaded by other means, and is generally not a robust way to manage page content.

## Recommendation

Instead of clearing the entire `head` and `body`, implement a more targeted approach for rendering dynamic content. For example, use a designated content area (`<div id="app-root"></div>`) and update only that section. Leverage existing UI components (e.g., `HeaderComponent`, `ListComponents`) to construct the dashboard UI programmatically, rather than relying on large HTML strings and manual DOM manipulation.

## Implementation Suggestions

1.  **Modify `webapp/src/dashboard.html`:**
    Create a minimal `dashboard.html` that includes only essential meta tags, CSS links, and a root element for the application to mount to.

    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">
        <title>Splitifyd - Dashboard</title>
        <link rel="stylesheet" href="/css/main.css">
        <link rel="stylesheet" href="/css/utility.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div id="app-root"></div>
        <script type="module" src="./js/dashboard-init.ts"></script>
    </body>
    </html>
    ```

2.  **Refactor `webapp/src/js/dashboard.ts`:**
    *   Remove all DOM manipulation related to `document.head` and `document.body`.
    *   Focus on rendering the dashboard content into the `#app-root` element.
    *   Utilize `HeaderComponent` and `ListComponents` to build the UI.

    ```typescript
    // webapp/src/js/dashboard.ts
    import { HeaderComponent } from './components/header.js';
    import { ListComponents } from './components/list-components.js';
    import { authManager } from './auth.js';
    import { GroupsList } from './groups.js';
    import { AppInit } from './app-init.js';

    async function initializeDashboardPage(): Promise<void> {
        try {
            await AppInit.initialize({ requireAuth: true });

            const appRoot = document.getElementById('app-root');
            if (!appRoot) {
                console.error('#app-root element not found');
                return;
            }

            // Render Header
            appRoot.innerHTML = HeaderComponent.render({
                title: 'Splitifyd',
                showLogout: true,
                titleLink: 'dashboard.html'
            });
            HeaderComponent.attachEventListeners();

            // Render main content area
            const mainContent = document.createElement('main');
            mainContent.className = 'dashboard-main';
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <section class="dashboard-content">
                        <h2>Welcome to Splitifyd!</h2>
                        <p>You are successfully logged in.</p>
                        <div id="groupsContainer" class="groups-container">
                            ${ListComponents.renderLoadingState('Loading your groups...')}
                        </div>
                    </section>
                </div>
            `;
            appRoot.appendChild(mainContent);

            // Initialize GroupsList
            const groupsList = new GroupsList('groupsContainer');
            groupsList.loadGroups();

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            AppInit.showError('Failed to load dashboard. Please try again.');
        }
    }

    document.addEventListener('DOMContentLoaded', initializeDashboardPage);
    ```

3.  **Update `webapp/src/js/dashboard-init.ts`:**
    This file becomes the main entry point for the dashboard page, calling `initializeDashboardPage` from `dashboard.ts`.

    ```typescript
    // webapp/src/js/dashboard-init.ts
    import { initializeDashboardPage } from './dashboard.js'; // Import the new init function

    // Dashboard initialization logic
    window.addEventListener('DOMContentLoaded', initializeDashboardPage);
    ```

4.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.

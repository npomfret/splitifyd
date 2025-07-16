import { AddExpenseComponent } from './components/AddExpenseComponent.js';
import './warning-banner.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', () => {
    // Set up API base URL before loading components that use auth
    AppInit.setupApiBaseUrl();
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        throw new Error('app-root element not found');
    }

    const addExpenseComponent = new AddExpenseComponent();
    addExpenseComponent.mount(appRoot);
});
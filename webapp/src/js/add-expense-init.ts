import { AddExpenseComponent } from './components/AddExpenseComponent.js';
import './warning-banner.js';

document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        throw new Error('app-root element not found');
    }

    const addExpenseComponent = new AddExpenseComponent();
    addExpenseComponent.mount(appRoot);
});
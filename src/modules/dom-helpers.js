// DOM element cache for frequently accessed elements
class DOMCache {
    constructor() {
        this.cache = new Map();
    }

    get(id) {
        if (!this.cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.cache.set(id, element);
            }
            return element;
        }
        return this.cache.get(id);
    }

    clear() {
        this.cache.clear();
    }
}

// Global DOM cache instance
export const domCache = new DOMCache();

// Optimized DOM query functions
export function getElementById(id) {
    return domCache.get(id);
}

export function getElements() {
    return {
        // Landing page
        landingPage: getElementById('landingPage'),
        mainApp: getElementById('mainApp'),
        
        // Header elements
        headerNewProject: getElementById('headerNewProject'),
        headerSwitchProject: getElementById('headerSwitchProject'),
        
        // App content
        projectTitle: getElementById('projectTitle'),
        memberCount: getElementById('memberCount'),
        membersList: getElementById('membersList'),
        expensesList: getElementById('expensesList'),
        expensesEmpty: getElementById('expensesEmpty'),
        settlementsList: getElementById('settlementsList'),
        settlementsEmpty: getElementById('settlementsEmpty'),
        
        // Form elements
        projectName: getElementById('projectName'),
        yourName: getElementById('yourName'),
        joinProjectId: getElementById('joinProjectId'),
        joinYourName: getElementById('joinYourName'),
        newMemberName: getElementById('newMemberName'),
        
        // Expense form
        expenseDescription: getElementById('expenseDescription'),
        expenseAmount: getElementById('expenseAmount'),
        expenseCurrency: getElementById('expenseCurrency'),
        expensePaidBy: getElementById('expensePaidBy'),
        splitBetweenContainer: getElementById('splitBetweenContainer'),
        
        // Settlement form
        settlementFrom: getElementById('settlementFrom'),
        settlementTo: getElementById('settlementTo'),
        settlementAmount: getElementById('settlementAmount'),
        settlementCurrency: getElementById('settlementCurrency'),
        
        // Share elements
        shareUrl: getElementById('shareUrl'),
        shareStorageId: getElementById('shareStorageId'),
        
        // Project switcher
        projectSwitcherList: getElementById('projectSwitcherList'),
        newProjectExistingList: getElementById('newProjectExistingList'),
        
        // Other
        toastContainer: getElementById('toastContainer'),
        syncIndicator: getElementById('syncIndicator'),
        syncStatus: getElementById('syncStatus')
    };
}

// Show/hide utility functions
export function showElement(element) {
    if (element) {
        element.style.display = 'block';
    }
}

export function hideElement(element) {
    if (element) {
        element.style.display = 'none';
    }
}

export function toggleElement(element, show) {
    if (show) {
        showElement(element);
    } else {
        hideElement(element);
    }
}
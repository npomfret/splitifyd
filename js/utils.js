// Utility functions
const Utils = {
    // Generate UUID v4
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Get timestamp
    getTimestamp() {
        return new Date().toISOString();
    },

    // Parse project ID from URL
    getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    },

    // Extract project ID from various formats
    extractProjectId(input) {
        // If it's already just an ID
        if (input.match(/^[a-f0-9-]+$/i)) {
            return input;
        }
        
        // Try to extract from URL
        const urlMatch = input.match(/[?&]id=([a-f0-9-]+)/i);
        if (urlMatch) {
            return urlMatch[1];
        }
        
        return input;
    },

    // Format currency
    formatCurrency(amount, currency) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(amount);
    },

    // Show error message
    showError(message) {
        console.error('Error:', message);
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 5000);
    },

    // Show loading
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    },

    // Hide loading
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Log with timestamp
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[${timestamp}] ${message}`, data);
        } else {
            console.log(`[${timestamp}] ${message}`);
        }
    },

    // Validate JSONBin ID format (24 character hex string)
    isValidJsonBinId(id) {
        return /^[a-f0-9]{24}$/i.test(id);
    },

    // Validate data structure
    validateProjectData(data) {
        if (!data || typeof data !== 'object') {
            Utils.log('Invalid project data: not an object');
            return false;
        }

        // Check required fields
        const requiredFields = ['id', 'name', 'created'];
        for (const field of requiredFields) {
            if (!data[field]) {
                Utils.log(`Invalid project data: missing ${field}`);
                return false;
            }
        }

        // Initialize missing structures
        if (!data.members || typeof data.members !== 'object') {
            Utils.log('Invalid project data: invalid members structure');
            data.members = {};
        }

        if (!data.expenses || typeof data.expenses !== 'object') {
            Utils.log('Invalid project data: invalid expenses structure');
            data.expenses = {};
        }

        if (!data.settlements || typeof data.settlements !== 'object') {
            Utils.log('Invalid project data: invalid settlements structure');
            data.settlements = {};
        }

        if (!Array.isArray(data.edits)) {
            Utils.log('Invalid project data: invalid edits array');
            data.edits = [];
        }

        return true;
    },

    // Clean invalid data
    cleanProjectData(data) {
        // Remove invalid members
        for (const [id, member] of Object.entries(data.members || {})) {
            if (!member || !member.name || !member.joined) {
                Utils.log(`Removing invalid member: ${id}`, member);
                delete data.members[id];
            }
        }

        // Remove invalid expenses
        for (const [id, expense] of Object.entries(data.expenses || {})) {
            if (!expense || !expense.amount || !expense.paidBy || !expense.created) {
                Utils.log(`Removing invalid expense: ${id}`, expense);
                delete data.expenses[id];
            }
        }

        // Remove invalid settlements
        for (const [id, settlement] of Object.entries(data.settlements || {})) {
            if (!settlement || !settlement.amount || !settlement.from || !settlement.to) {
                Utils.log(`Removing invalid settlement: ${id}`, settlement);
                delete data.settlements[id];
            }
        }

        return data;
    }
};
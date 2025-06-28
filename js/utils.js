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

    // Logging configuration
    _logConfig: {
        enabled: true,
        level: 'CHANGE', // CHANGE, INFO, DEBUG
        lastStates: new Map() // Track last states for change detection
    },

    // Set logging level (CHANGE = only changes, INFO = important events, DEBUG = everything)
    setLogLevel(level) {
        this._logConfig.level = level;
    },

    // Enable/disable logging
    setLoggingEnabled(enabled) {
        this._logConfig.enabled = enabled;
    },

    // Log with timestamp and level filtering
    log(message, data = null, level = 'INFO') {
        if (!this._logConfig.enabled) return;
        
        // Filter based on log level
        if (this._logConfig.level === 'CHANGE' && level !== 'CHANGE') {
            return;
        }
        if (this._logConfig.level === 'INFO' && level === 'DEBUG') {
            return;
        }
        
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[${timestamp}] ${message}`, data);
        } else {
            console.log(`[${timestamp}] ${message}`);
        }
    },

    // Log only when state changes
    logChange(key, newValue, message) {
        if (!this._logConfig.enabled) return;
        
        const lastValue = this._logConfig.lastStates.get(key);
        const hasChanged = JSON.stringify(lastValue) !== JSON.stringify(newValue);
        
        if (hasChanged) {
            this._logConfig.lastStates.set(key, structuredClone(newValue));
            this.log(message, { from: lastValue, to: newValue }, 'CHANGE');
        }
    },

    // Legacy log method for compatibility
    logDebug(message, data = null) {
        this.log(message, data, 'DEBUG');
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

    // Clean invalid data with recovery
    cleanProjectData(data) {
        let cleanedCount = 0;
        let recoveredCount = 0;
        
        // Clean and attempt to recover invalid members
        for (const [id, member] of Object.entries(data.members || {})) {
            if (!member || typeof member !== 'object') {
                Utils.log(`Removing completely invalid member: ${id}`, member);
                delete data.members[id];
                cleanedCount++;
                continue;
            }
            
            // Attempt to recover partially invalid members
            let wasInvalid = false;
            if (!member.name || typeof member.name !== 'string') {
                member.name = `Member ${id.substring(0, 8)}`;
                wasInvalid = true;
            }
            if (!member.joined) {
                member.joined = new Date().toISOString();
                wasInvalid = true;
            }
            if (member.active === undefined) {
                member.active = true;
                wasInvalid = true;
            }
            
            if (wasInvalid) {
                Utils.log(`Recovered invalid member: ${id}`, { before: member, after: data.members[id] });
                recoveredCount++;
            }
        }

        // Clean and attempt to recover invalid expenses
        for (const [id, expense] of Object.entries(data.expenses || {})) {
            if (!expense || typeof expense !== 'object') {
                Utils.log(`Removing completely invalid expense: ${id}`, expense);
                delete data.expenses[id];
                cleanedCount++;
                continue;
            }
            
            // Attempt to recover partially invalid expenses
            let wasInvalid = false;
            if (!expense.amount || typeof expense.amount !== 'number' || expense.amount <= 0) {
                // Can't recover expenses without valid amounts
                Utils.log(`Removing expense with invalid amount: ${id}`, expense);
                delete data.expenses[id];
                cleanedCount++;
                continue;
            }
            
            if (!expense.description || typeof expense.description !== 'string') {
                expense.description = `Expense ${id.substring(0, 8)}`;
                wasInvalid = true;
            }
            if (!expense.currency || typeof expense.currency !== 'string') {
                expense.currency = 'USD';
                wasInvalid = true;
            }
            if (!expense.paidBy) {
                // Try to find a valid member ID
                const memberIds = Object.keys(data.members || {});
                if (memberIds.length > 0) {
                    expense.paidBy = memberIds[0];
                    wasInvalid = true;
                } else {
                    // Can't recover without a valid payer
                    Utils.log(`Removing expense without valid payer: ${id}`, expense);
                    delete data.expenses[id];
                    cleanedCount++;
                    continue;
                }
            }
            if (!expense.created) {
                expense.created = new Date().toISOString();
                wasInvalid = true;
            }
            if (expense.active === undefined) {
                expense.active = true;
                wasInvalid = true;
            }
            if (!Array.isArray(expense.splitBetween)) {
                expense.splitBetween = [expense.paidBy];
                wasInvalid = true;
            }
            
            if (wasInvalid) {
                Utils.log(`Recovered invalid expense: ${id}`, { before: expense, after: data.expenses[id] });
                recoveredCount++;
            }
        }

        // Clean and attempt to recover invalid settlements
        for (const [id, settlement] of Object.entries(data.settlements || {})) {
            if (!settlement || typeof settlement !== 'object') {
                Utils.log(`Removing completely invalid settlement: ${id}`, settlement);
                delete data.settlements[id];
                cleanedCount++;
                continue;
            }
            
            // Attempt to recover partially invalid settlements
            let wasInvalid = false;
            if (!settlement.amount || typeof settlement.amount !== 'number' || settlement.amount <= 0) {
                // Can't recover settlements without valid amounts
                Utils.log(`Removing settlement with invalid amount: ${id}`, settlement);
                delete data.settlements[id];
                cleanedCount++;
                continue;
            }
            
            if (!settlement.from || !settlement.to) {
                // Can't recover without valid participants
                Utils.log(`Removing settlement without valid participants: ${id}`, settlement);
                delete data.settlements[id];
                cleanedCount++;
                continue;
            }
            
            if (!settlement.currency || typeof settlement.currency !== 'string') {
                settlement.currency = 'USD';
                wasInvalid = true;
            }
            if (!settlement.created) {
                settlement.created = new Date().toISOString();
                wasInvalid = true;
            }
            if (settlement.active === undefined) {
                settlement.active = true;
                wasInvalid = true;
            }
            
            if (wasInvalid) {
                Utils.log(`Recovered invalid settlement: ${id}`, { before: settlement, after: data.settlements[id] });
                recoveredCount++;
            }
        }

        if (cleanedCount > 0 || recoveredCount > 0) {
            Utils.log(`Data integrity check complete: ${cleanedCount} items removed, ${recoveredCount} items recovered`, null, 'INFO');
        }

        return data;
    },
    
    // Create backup of project data
    createDataBackup(projectId, data, reason = 'manual') {
        try {
            const backupKey = `fairsplit_backup_${projectId}_${Date.now()}`;
            const backup = {
                projectId,
                data: structuredClone(data),
                timestamp: this.getTimestamp(),
                reason,
                version: data.version || 1
            };
            
            localStorage.setItem(backupKey, JSON.stringify(backup));
            Utils.log(`Data backup created: ${backupKey}`, { reason, version: backup.version }, 'INFO');
            
            // Clean old backups (keep only last 5 per project)
            this.cleanOldBackups(projectId);
            
            return backupKey;
        } catch (error) {
            Utils.log('Failed to create data backup', error, 'INFO');
            return null;
        }
    },
    
    // Clean old backups to prevent localStorage bloat
    cleanOldBackups(projectId) {
        try {
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`fairsplit_backup_${projectId}_`)) {
                    backupKeys.push(key);
                }
            }
            
            // Sort by timestamp (embedded in key) and keep only latest 5
            backupKeys.sort().reverse();
            const toDelete = backupKeys.slice(5);
            
            toDelete.forEach(key => {
                localStorage.removeItem(key);
                Utils.logDebug(`Removed old backup: ${key}`);
            });
            
        } catch (error) {
            Utils.log('Failed to clean old backups', error, 'INFO');
        }
    },
    
    // Attempt to recover data from backups
    recoverFromBackup(projectId, maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        try {
            const backupKeys = [];
            const cutoffTime = Date.now() - maxAge;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`fairsplit_backup_${projectId}_`)) {
                    const timestamp = parseInt(key.split('_').pop());
                    if (timestamp > cutoffTime) {
                        backupKeys.push({ key, timestamp });
                    }
                }
            }
            
            if (backupKeys.length === 0) {
                Utils.log('No recent backups found for recovery', { projectId, maxAge }, 'INFO');
                return null;
            }
            
            // Get the most recent backup
            backupKeys.sort((a, b) => b.timestamp - a.timestamp);
            const latestBackup = localStorage.getItem(backupKeys[0].key);
            
            if (!latestBackup) {
                Utils.log('Failed to read backup data', { key: backupKeys[0].key }, 'INFO');
                return null;
            }
            
            const backup = JSON.parse(latestBackup);
            Utils.log('Successfully recovered data from backup', { 
                backupKey: backupKeys[0].key, 
                version: backup.version,
                timestamp: backup.timestamp 
            }, 'INFO');
            
            return backup.data;
            
        } catch (error) {
            Utils.log('Failed to recover from backup', error, 'INFO');
            return null;
        }
    }
};
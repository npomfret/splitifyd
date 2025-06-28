// Main application controller
const App = {
    currentProject: null,
    currentUser: null,
    
    // Initialize the application
    init() {
        // Configure logging to only show changes
        Utils.setLogLevel('CHANGE');
        Utils.log('Initializing Fair Split app', null, 'INFO');
        
        // Make App globally accessible for sync
        window.App = this;
        
        // Initialize cache
        Cache.init();
        
        // Clean up any invalid projects
        Cache.cleanupInvalidProjects();
        
        // Load current user
        this.currentUser = Cache.getUser();
        
        // Start auto sync
        Sync.startAutoSync();
        
        Utils.log('App initialized', null, 'INFO');
    },
    
    // Create a new project
    async createProject(name) {
        Utils.log('Creating new project', name);
        
        try {
            Utils.showLoading();
            
            const projectData = {
                name: name,
                created: Utils.getTimestamp(),
                members: {},
                expenses: {},
                settlements: {},
                edits: []
            };
            
            // Create on server first to get the JSONBin ID
            const result = await API.createBin(projectData);
            const projectId = result.id;
            
            // Add the JSONBin ID to the project data
            projectData.id = projectId;
            
            // Save to cache with the correct ID
            Cache.saveProject(projectId, projectData);
            
            // Add to user's projects
            this.currentUser.projects.push(projectId);
            Cache.saveUser(this.currentUser);
            
            Utils.hideLoading();
            return projectId;
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showError('Failed to create project: ' + error.message);
            throw error;
        }
    },
    
    // Join an existing project
    async joinProject(projectIdOrUrl) {
        Utils.log('Joining project', projectIdOrUrl);
        
        try {
            Utils.showLoading();
            
            // Extract project ID
            const projectId = Utils.extractProjectId(projectIdOrUrl);
            
            // Check if already a member
            if (this.currentUser.projects.includes(projectId)) {
                Utils.hideLoading();
                return projectId;
            }
            
            // Fetch project data
            const projectData = await API.withRetry(() => API.readBin(projectId));
            
            // Validate project data
            if (!Utils.validateProjectData(projectData)) {
                throw new Error('Invalid project data');
            }
            
            // Save to cache
            Cache.saveProject(projectId, projectData);
            
            // Add to user's projects
            this.currentUser.projects.push(projectId);
            Cache.saveUser(this.currentUser);
            
            Utils.hideLoading();
            return projectId;
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showError('Failed to join project: ' + error.message);
            throw error;
        }
    },
    
    // Load a project
    async loadProject(projectId) {
        Utils.log('Loading project', projectId);
        
        try {
            // Load from cache first
            const cached = Cache.getProject(projectId);
            if (cached && cached.data) {
                this.currentProject = cached.data;
                
                // Sync in background
                Sync.syncProject(projectId, false).catch(error => {
                    Utils.log('Background sync failed', error);
                });
                
                return this.currentProject;
            }
            
            // Not in cache, fetch from server
            Utils.showLoading();
            const projectData = await API.withRetry(() => API.readBin(projectId));
            
            // Validate and clean
            if (!Utils.validateProjectData(projectData)) {
                throw new Error('Invalid project data');
            }
            
            // Save to cache
            Cache.saveProject(projectId, projectData);
            this.currentProject = projectData;
            
            Utils.hideLoading();
            return this.currentProject;
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showError('Failed to load project: ' + error.message);
            throw error;
        }
    },
    
    // Add member to current project
    addMember(name) {
        Utils.log('Adding member', name);
        
        const memberId = Utils.generateId();
        const member = {
            id: memberId,
            name: name,
            joined: Utils.getTimestamp(),
            addedBy: this.currentUser.id,
            active: true
        };
        
        // Update local data
        this.currentProject.members[memberId] = member;
        
        // Save to cache with dirty flag
        Cache.saveProject(this.currentProject.id, this.currentProject, true);
        
        // Update user name if joining
        if (!this.currentUser.name) {
            this.currentUser.name = name;
            Cache.saveUser(this.currentUser);
        }
        
        return memberId;
    },
    
    // Add expense to current project
    addExpense(expense) {
        Utils.log('Adding expense', expense);
        
        try {
            // Validate expense data
            if (!expense || typeof expense !== 'object') {
                throw new Error('Invalid expense data');
            }
            
            if (!expense.description || !expense.amount || !expense.paidBy) {
                throw new Error('Missing required expense fields: description, amount, or paidBy');
            }
            
            if (typeof expense.amount !== 'number' || expense.amount <= 0) {
                throw new Error('Expense amount must be a positive number');
            }
            
            if (!this.currentProject) {
                throw new Error('No current project loaded');
            }
            
            const expenseId = Utils.generateId();
            const fullExpense = {
                id: expenseId,
                ...expense,
                created: Utils.getTimestamp(),
                createdBy: this.currentUser.id,
                active: true
            };
            
            // Update local data first
            this.currentProject.expenses[expenseId] = fullExpense;
            
            // Save to cache with dirty flag in one atomic operation
            const saveSuccess = Cache.saveProject(this.currentProject.id, this.currentProject, true);
            
            if (!saveSuccess) {
                // Rollback local changes if save failed
                delete this.currentProject.expenses[expenseId];
                throw new Error('Failed to save expense to local storage');
            }
            
            // Update last used currency
            this.currentUser.lastCurrency = expense.currency;
            const userSaveSuccess = Cache.saveUser(this.currentUser);
            
            if (!userSaveSuccess) {
                Utils.log('Warning: Failed to update user currency preference', null, 'INFO');
                // Don't throw here as the expense was saved successfully
            }
            
            Utils.log('Expense added successfully', { expenseId, expense }, 'INFO');
            
            // Trigger immediate sync for critical operations
            Sync.syncProjectImmediately(this.currentProject.id).catch(error => {
                Utils.log('Background immediate sync failed', error, 'INFO');
                // Don't throw here as the expense was saved successfully locally
            });
            
            return expenseId;
            
        } catch (error) {
            Utils.log('Error adding expense', error, 'INFO');
            Utils.showError('Failed to add expense: ' + error.message);
            throw error;
        }
    },
    
    // Edit expense
    editExpense(expenseId, field, newValue) {
        Utils.log('Editing expense', { expenseId, field, newValue });
        
        // Create edit record
        const edit = {
            id: Utils.generateId(),
            type: 'expense',
            targetId: expenseId,
            field: field,
            newValue: newValue,
            timestamp: Utils.getTimestamp(),
            editedBy: this.currentUser.id
        };
        
        // Add to edits
        this.currentProject.edits.push(edit);
        
        // Apply edit locally
        if (this.currentProject.expenses[expenseId]) {
            this.currentProject.expenses[expenseId][field] = newValue;
        }
        
        // Save to cache with dirty flag
        Cache.saveProject(this.currentProject.id, this.currentProject, true);
    },
    
    // Delete expense (soft delete)
    deleteExpense(expenseId) {
        Utils.log('Deleting expense', expenseId);
        
        this.editExpense(expenseId, 'active', false);
    },
    
    // Add settlement
    addSettlement(settlement) {
        Utils.log('Adding settlement', settlement);
        
        const settlementId = Utils.generateId();
        const fullSettlement = {
            id: settlementId,
            ...settlement,
            created: Utils.getTimestamp(),
            createdBy: this.currentUser.id,
            active: true
        };
        
        // Update local data
        this.currentProject.settlements[settlementId] = fullSettlement;
        
        // Save to cache with dirty flag
        Cache.saveProject(this.currentProject.id, this.currentProject, true);
        
        return settlementId;
    },
    
    // Leave project
    leaveProject(projectId) {
        Utils.log('Leaving project', projectId);
        
        // Remove from user's projects
        this.currentUser.projects = this.currentUser.projects.filter(id => id !== projectId);
        Cache.saveUser(this.currentUser);
        
        // Clear from cache
        Cache.clearProject(projectId);
    },
    
    // Get current member ID
    getCurrentMemberId() {
        // Find member by user ID or name
        for (const [memberId, member] of Object.entries(this.currentProject.members)) {
            if (member.addedBy === this.currentUser.id || 
                member.name === this.currentUser.name) {
                return memberId;
            }
        }
        return null;
    },
    
    // Check if current user is a member
    isCurrentUserMember() {
        return this.getCurrentMemberId() !== null;
    }
};
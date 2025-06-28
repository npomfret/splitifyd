// Local storage cache manager
const Cache = {
    // Keys
    USER_KEY: 'fairsplit_user',
    PROJECTS_KEY: 'fairsplit_projects',
    SYNC_QUEUE_KEY: 'fairsplit_sync_queue',
    
    // Initialize cache
    init() {
        Utils.log('Initializing cache', null, 'INFO');
        
        // Ensure user exists
        if (!this.getUser()) {
            const user = {
                id: Utils.generateId(),
                name: '',
                projects: [],
                lastCurrency: 'USD'
            };
            this.saveUser(user);
            Utils.log('Created new user', user, 'INFO');
        }
        
        // Initialize projects cache
        if (!this.getProjects()) {
            this.saveProjects({});
        }
        
        // Initialize sync queue
        if (!this.getSyncQueue()) {
            this.saveSyncQueue([]);
        }
    },
    
    // User management
    getUser() {
        try {
            const data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            Utils.log('Error reading user data from localStorage', error, 'INFO');
            return null;
        }
    },
    
    saveUser(user) {
        try {
            const existingUser = this.getUser();
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
            Utils.logChange('user-data', user, 'User data updated');
            return true;
        } catch (error) {
            Utils.log('Error saving user data to localStorage', error, 'INFO');
            if (error.name === 'QuotaExceededError') {
                Utils.showError('Storage quota exceeded. Please clear some data.');
            } else {
                Utils.showError('Failed to save user data. Please try again.');
            }
            return false;
        }
    },
    
    // Project management
    getProjects() {
        try {
            const data = localStorage.getItem(this.PROJECTS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            Utils.log('Error reading projects data from localStorage', error, 'INFO');
            return {};
        }
    },
    
    getProject(projectId) {
        const projects = this.getProjects();
        return projects[projectId];
    },
    
    saveProject(projectId, projectData, markDirty = false) {
        try {
            const projects = this.getProjects();
            const existingProject = projects[projectId];
            
            // Create backup before saving if this is a significant change
            if (markDirty && existingProject) {
                Utils.createDataBackup(projectId, existingProject.data, 'before_save');
            }
            
            // Clean and validate data before saving
            const cleanedData = Utils.cleanProjectData(structuredClone(projectData));
            
            projects[projectId] = {
                data: cleanedData,
                lastSync: Utils.getTimestamp(),
                version: (projects[projectId]?.version || 0) + 1,
                dirty: markDirty
            };
            
            const success = this.saveProjects(projects);
            if (success) {
                Utils.logChange(`project-${projectId}`, cleanedData, `Project ${projectId} saved to cache`);
                
                // Create backup after successful save for critical operations
                if (markDirty) {
                    Utils.createDataBackup(projectId, cleanedData, 'after_save');
                }
            } else {
                // Attempt recovery if save failed
                const recovered = Utils.recoverFromBackup(projectId);
                if (recovered) {
                    Utils.showError('Save failed, but data was recovered from backup.');
                    // Try to save the recovered data
                    projects[projectId] = {
                        data: recovered,
                        lastSync: Utils.getTimestamp(),
                        version: (projects[projectId]?.version || 0) + 1,
                        dirty: markDirty
                    };
                    return this.saveProjects(projects);
                }
            }
            
            return success;
        } catch (error) {
            Utils.log('Error saving project to cache', error, 'INFO');
            
            // Attempt recovery on error
            const recovered = Utils.recoverFromBackup(projectId);
            if (recovered) {
                Utils.showError('Save failed, but data was recovered from backup. Please try again.');
                return false;
            }
            
            Utils.showError('Failed to save project data. Please try again.');
            return false;
        }
    },
    
    markProjectDirty(projectId) {
        try {
            const projects = this.getProjects();
            if (projects[projectId]) {
                const wasDirty = projects[projectId].dirty;
                projects[projectId].dirty = true;
                const success = this.saveProjects(projects);
                if (success && !wasDirty) {
                    Utils.log(`Project ${projectId} marked as dirty`, null, 'INFO');
                }
                return success;
            } else {
                Utils.log(`Failed to mark project ${projectId} as dirty - not found in cache`, null, 'INFO');
                return false;
            }
        } catch (error) {
            Utils.log('Error marking project as dirty', error, 'INFO');
            return false;
        }
    },
    
    saveProjects(projects) {
        try {
            localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
            return true;
        } catch (error) {
            Utils.log('Error saving projects to localStorage', error, 'INFO');
            if (error.name === 'QuotaExceededError') {
                Utils.showError('Storage quota exceeded. Please clear some data.');
            } else {
                Utils.showError('Failed to save project data. Please try again.');
            }
            return false;
        }
    },
    
    // Sync queue management
    getSyncQueue() {
        try {
            const data = localStorage.getItem(this.SYNC_QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            Utils.log('Error reading sync queue from localStorage', error, 'INFO');
            return [];
        }
    },
    
    addToSyncQueue(projectId) {
        const queue = this.getSyncQueue();
        const exists = queue.some(item => item.projectId === projectId);
        
        if (!exists) {
            queue.push({
                projectId,
                timestamp: Utils.getTimestamp()
            });
            this.saveSyncQueue(queue);
            Utils.logDebug(`Added project ${projectId} to sync queue`);
        }
    },
    
    removeFromSyncQueue(projectId) {
        const queue = this.getSyncQueue();
        const filtered = queue.filter(item => item.projectId !== projectId);
        this.saveSyncQueue(filtered);
        Utils.logDebug(`Removed project ${projectId} from sync queue`);
    },
    
    saveSyncQueue(queue) {
        try {
            localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
            return true;
        } catch (error) {
            Utils.log('Error saving sync queue to localStorage', error, 'INFO');
            return false;
        }
    },
    
    // Clear specific project data
    clearProject(projectId) {
        const projects = this.getProjects();
        delete projects[projectId];
        this.saveProjects(projects);
        
        // Remove from user's projects
        const user = this.getUser();
        user.projects = user.projects.filter(id => id !== projectId);
        this.saveUser(user);
        
        Utils.log(`Cleared project ${projectId} from cache`, null, 'INFO');
    },
    
    // Clear all data
    clearAll() {
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.PROJECTS_KEY);
        localStorage.removeItem(this.SYNC_QUEUE_KEY);
        Utils.log('Cleared all cache data', null, 'INFO');
    },
    
    // Clean up invalid projects
    cleanupInvalidProjects() {
        Utils.logDebug('Cleaning up invalid projects');
        
        const user = this.getUser();
        const projects = this.getProjects();
        let cleaned = false;
        
        // Remove invalid project IDs from user's list
        const validProjects = user.projects.filter(projectId => {
            const isValid = Utils.isValidJsonBinId(projectId);
            if (!isValid) {
                Utils.log(`Removing invalid project ID from user: ${projectId}`, null, 'INFO');
                cleaned = true;
            }
            return isValid;
        });
        
        if (cleaned) {
            user.projects = validProjects;
            this.saveUser(user);
        }
        
        // Remove invalid projects from cache
        Object.keys(projects).forEach(projectId => {
            if (!Utils.isValidJsonBinId(projectId)) {
                Utils.log(`Removing invalid project from cache: ${projectId}`, null, 'INFO');
                delete projects[projectId];
                cleaned = true;
            }
        });
        
        if (cleaned) {
            this.saveProjects(projects);
            Utils.log('Cleanup completed', null, 'INFO');
        }
        
        return cleaned;
    }
};
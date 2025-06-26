// Local storage cache manager
const Cache = {
    // Keys
    USER_KEY: 'fairsplit_user',
    PROJECTS_KEY: 'fairsplit_projects',
    SYNC_QUEUE_KEY: 'fairsplit_sync_queue',
    
    // Initialize cache
    init() {
        Utils.log('Initializing cache');
        
        // Ensure user exists
        if (!this.getUser()) {
            const user = {
                id: Utils.generateId(),
                name: '',
                projects: [],
                lastCurrency: 'USD'
            };
            this.saveUser(user);
            Utils.log('Created new user', user);
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
        const data = localStorage.getItem(this.USER_KEY);
        return data ? JSON.parse(data) : null;
    },
    
    saveUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        Utils.log('User saved to cache', user);
    },
    
    // Project management
    getProjects() {
        const data = localStorage.getItem(this.PROJECTS_KEY);
        return data ? JSON.parse(data) : {};
    },
    
    getProject(projectId) {
        const projects = this.getProjects();
        return projects[projectId];
    },
    
    saveProject(projectId, projectData) {
        const projects = this.getProjects();
        projects[projectId] = {
            data: projectData,
            lastSync: Utils.getTimestamp(),
            version: (projects[projectId]?.version || 0) + 1,
            dirty: false
        };
        this.saveProjects(projects);
        Utils.log(`Project ${projectId} saved to cache`, projectData);
    },
    
    markProjectDirty(projectId) {
        const projects = this.getProjects();
        if (projects[projectId]) {
            projects[projectId].dirty = true;
            this.saveProjects(projects);
            Utils.log(`Project ${projectId} marked as dirty`);
        }
    },
    
    saveProjects(projects) {
        localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
    },
    
    // Sync queue management
    getSyncQueue() {
        const data = localStorage.getItem(this.SYNC_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
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
            Utils.log(`Added project ${projectId} to sync queue`);
        }
    },
    
    removeFromSyncQueue(projectId) {
        const queue = this.getSyncQueue();
        const filtered = queue.filter(item => item.projectId !== projectId);
        this.saveSyncQueue(filtered);
        Utils.log(`Removed project ${projectId} from sync queue`);
    },
    
    saveSyncQueue(queue) {
        localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
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
        
        Utils.log(`Cleared project ${projectId} from cache`);
    },
    
    // Clear all data
    clearAll() {
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.PROJECTS_KEY);
        localStorage.removeItem(this.SYNC_QUEUE_KEY);
        Utils.log('Cleared all cache data');
    },
    
    // Clean up invalid projects
    cleanupInvalidProjects() {
        Utils.log('Cleaning up invalid projects');
        
        const user = this.getUser();
        const projects = this.getProjects();
        let cleaned = false;
        
        // Remove invalid project IDs from user's list
        const validProjects = user.projects.filter(projectId => {
            const isValid = Utils.isValidJsonBinId(projectId);
            if (!isValid) {
                Utils.log(`Removing invalid project ID from user: ${projectId}`);
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
                Utils.log(`Removing invalid project from cache: ${projectId}`);
                delete projects[projectId];
                cleaned = true;
            }
        });
        
        if (cleaned) {
            this.saveProjects(projects);
            Utils.log('Cleanup completed');
        }
        
        return cleaned;
    }
};
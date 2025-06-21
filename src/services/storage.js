import { JSONBIN_CONFIG, APP_CONFIG } from '../config/constants.js';

export class StorageService {
    async createProject(projectData) {
        try {
            const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_CONFIG.API_KEY,
                    'X-Bin-Name': projectData.id,
                    'X-Bin-Private': 'false'
                },
                body: JSON.stringify(projectData)
            });

            if (!response.ok) {
                throw new Error(`Failed to create project: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                storageId: data.metadata.id,
                url: `https://api.jsonbin.io/v3/b/${data.metadata.id}`
            };
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    async getProject(storageId) {
        try {
            const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/b/${storageId}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': JSONBIN_CONFIG.API_KEY
                }
            });

            if (!response.ok) {
                throw new Error('Project not found');
            }
            
            const data = await response.json();
            return data.record;
        } catch (error) {
            console.error('Error fetching project:', error);
            throw error;
        }
    }

    async updateProject(storageId, projectData) {
        try {
            const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/b/${storageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_CONFIG.API_KEY
                },
                body: JSON.stringify(projectData)
            });

            if (!response.ok) {
                throw new Error('Failed to update project');
            }
            
            return true;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }
}

// Local storage helpers
export const LocalStorage = {
    // Project list management
    getProjects() {
        const projects = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.PROJECTS);
        return projects ? JSON.parse(projects) : [];
    },

    addProject(storageId, userId) {
        const projects = this.getProjects();
        const filtered = projects.filter(p => p.storageId !== storageId);
        filtered.unshift({ storageId, userId });
        const trimmed = filtered.slice(0, APP_CONFIG.MAX_PROJECTS);
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.PROJECTS, JSON.stringify(trimmed));
    },

    removeProject(storageId) {
        const projects = this.getProjects();
        const filtered = projects.filter(p => p.storageId !== storageId);
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.PROJECTS, JSON.stringify(filtered));
    },

    // Active project management
    setActiveProject(storageId) {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_PROJECT, storageId);
    },

    getActiveProject() {
        return localStorage.getItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_PROJECT);
    },

    clearActiveProject() {
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_PROJECT);
    },

    getUserIdForProject(storageId) {
        const projects = this.getProjects();
        const project = projects.find(p => p.storageId === storageId);
        return project ? project.userId : null;
    },

    // Legacy compatibility methods - simplified
    getProjectInfo() {
        return {
            projectId: localStorage.getItem(APP_CONFIG.STORAGE_KEYS.PROJECT_ID),
            userId: localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER_ID)
        };
    },

    getStorageId(projectId) {
        return localStorage.getItem(`splitifyd_storage_${projectId}`);
    },

    clearLegacyData() {
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.PROJECT_ID);
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER_ID);
        // Clean up old storage keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('splitifyd_storage_')) {
                localStorage.removeItem(key);
            }
        }
    }
};
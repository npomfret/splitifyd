// Storage service using JSONBin.io
const JSONBIN_API_KEY = '$2a$10$hm7J97lLcGQCE9NGfef8ReIVgLddJrgsro7DJE14.vYdD.b01my1e';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

export class StorageService {
    async createProject(projectData) {
        try {
            const response = await fetch(`${JSONBIN_BASE_URL}/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY,
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
            const response = await fetch(`${JSONBIN_BASE_URL}/b/${storageId}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': JSONBIN_API_KEY
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
            const response = await fetch(`${JSONBIN_BASE_URL}/b/${storageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
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
    saveProjectInfo(projectId, userId) {
        localStorage.setItem('splitifyd_project_id', projectId);
        localStorage.setItem('splitifyd_user_id', userId);
    },

    getProjectInfo() {
        return {
            projectId: localStorage.getItem('splitifyd_project_id'),
            userId: localStorage.getItem('splitifyd_user_id')
        };
    },

    clearProjectInfo() {
        localStorage.removeItem('splitifyd_project_id');
        localStorage.removeItem('splitifyd_user_id');
    },

    saveStorageId(projectId, storageId) {
        localStorage.setItem(`splitifyd_storage_${projectId}`, storageId);
    },

    getStorageId(projectId) {
        return localStorage.getItem(`splitifyd_storage_${projectId}`);
    }
};
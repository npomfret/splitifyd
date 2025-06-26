// Data synchronization manager
const Sync = {
    syncInterval: null,
    isSyncing: false,
    
    // Start automatic sync
    startAutoSync() {
        Utils.log('Starting auto sync');
        
        // Sync every 5 seconds if there are dirty projects
        this.syncInterval = setInterval(() => {
            this.syncDirtyProjects();
        }, 5000);
    },
    
    // Stop automatic sync
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            Utils.log('Stopped auto sync');
        }
    },
    
    // Sync all dirty projects and check for remote updates
    async syncDirtyProjects() {
        const projects = Cache.getProjects();
        const dirtyProjects = Object.entries(projects)
            .filter(([_, meta]) => meta.dirty)
            .map(([id, _]) => id);
        
        // Always sync the current project to get remote updates
        const currentProjectId = Utils.getProjectIdFromUrl();
        if (currentProjectId && !dirtyProjects.includes(currentProjectId)) {
            dirtyProjects.push(currentProjectId);
        }
        
        Utils.logChange('dirtyProjectsCount', dirtyProjects.length, `Found ${dirtyProjects.length} projects to sync`);
        
        if (dirtyProjects.length === 0) {
            return;
        }
        
        for (const projectId of dirtyProjects) {
            await this.syncProject(projectId);
        }
    },
    
    // Sync a specific project
    async syncProject(projectId, showIndicator = false) {
        if (this.isSyncing) {
            Utils.logDebug('Already syncing, skipping');
            return;
        }
        
        this.isSyncing = true;
        
        if (showIndicator) {
            this.updateSyncIndicator('syncing');
        }
        
        try {
            Utils.log(`Syncing project ${projectId}`, null, 'INFO');
            
            // Get local data
            const localMeta = Cache.getProject(projectId);
            if (!localMeta || !localMeta.data) {
                throw new Error('No local data found');
            }
            
            const localData = localMeta.data;
            const isDirty = localMeta.dirty;
            
            // Get remote data
            let remoteData;
            try {
                remoteData = await API.withRetry(() => API.readBin(projectId));
            } catch (error) {
                if (error.message.includes('not found') || error.message.includes('Invalid Bin Id')) {
                    // Invalid project ID - clean it up
                    Utils.log('Invalid project ID detected, cleaning up', error);
                    Cache.clearProject(projectId);
                    
                    if (showIndicator) {
                        this.updateSyncIndicator('error');
                        Utils.showError('Invalid project removed');
                    }
                    return;
                }
                throw error;
            }
            
            // Merge data
            const mergedData = this.mergeProjectData(localData, remoteData);
            
            // Only update remote if we have local changes
            if (isDirty) {
                await API.withRetry(() => API.updateBin(projectId, mergedData));
                Utils.log(`Pushed local changes for project ${projectId}`, null, 'INFO');
            }
            
            // Always update local cache and clear dirty flag
            Cache.saveProject(projectId, mergedData);
            
            // Update UI if this is the current project and data changed
            const currentProjectId = Utils.getProjectIdFromUrl();
            if (projectId === currentProjectId && window.App && window.App.currentProject) {
                const hasChanges = JSON.stringify(localData) !== JSON.stringify(mergedData);
                
                if (hasChanges) {
                    Utils.log('Remote changes detected, updating UI', null, 'INFO');
                    Utils.logChange(`project-${projectId}-data`, mergedData, `Project ${projectId} data updated`);
                    window.App.currentProject = mergedData;
                    
                    // Trigger UI update if we're on the project page
                    if (typeof window.updateMembersUI === 'function') {
                        Utils.logDebug('Calling UI update functions');
                        window.updateMembersUI();
                        window.updateExpensesUI();
                        window.updateBalancesUI();
                        Utils.logDebug('UI update functions completed');
                    } else {
                        Utils.logDebug('UI update functions not available');
                    }
                } else {
                    Utils.logDebug('No remote changes detected');
                }
            }
            
            Utils.log(`Successfully synced project ${projectId}`, null, 'INFO');
            
            if (showIndicator) {
                this.updateSyncIndicator('success');
            }
        } catch (error) {
            Utils.log(`Error syncing project ${projectId}`, error);
            
            if (showIndicator) {
                this.updateSyncIndicator('error');
                Utils.showError('Sync failed: ' + error.message);
            }
            
            // Add to sync queue for retry
            Cache.addToSyncQueue(projectId);
        } finally {
            this.isSyncing = false;
        }
    },
    
    // Merge local and remote project data
    mergeProjectData(local, remote) {
        Utils.logDebug('Merging project data', { local, remote });
        
        // Validate both data sets
        if (!Utils.validateProjectData(local)) {
            Utils.log('Invalid local data, using remote', null, 'INFO');
            return remote;
        }
        
        if (!Utils.validateProjectData(remote)) {
            Utils.log('Invalid remote data, using local', null, 'INFO');
            return local;
        }
        
        // Start with base structure
        const merged = {
            id: local.id,
            name: local.name || remote.name,
            created: local.created || remote.created,
            members: {},
            expenses: {},
            settlements: {},
            edits: []
        };
        
        // Merge members (union, keep all)
        merged.members = { ...remote.members, ...local.members };
        
        // Merge expenses (union, keep all)
        merged.expenses = { ...remote.expenses, ...local.expenses };
        
        // Merge settlements (union, keep all)
        merged.settlements = { ...remote.settlements, ...local.settlements };
        
        // Merge edits (combine and sort by timestamp)
        const allEdits = [...(remote.edits || []), ...(local.edits || [])];
        const uniqueEdits = [];
        const seenIds = new Set();
        
        // Sort by timestamp and deduplicate
        allEdits
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(edit => {
                if (!seenIds.has(edit.id)) {
                    seenIds.add(edit.id);
                    uniqueEdits.push(edit);
                }
            });
        
        merged.edits = uniqueEdits;
        
        // Apply edits chronologically
        merged.edits.forEach(edit => {
            this.applyEdit(merged, edit);
        });
        
        // Clean invalid data
        Utils.cleanProjectData(merged);
        
        Utils.logDebug('Merged project data', merged);
        return merged;
    },
    
    // Apply an edit to project data
    applyEdit(data, edit) {
        Utils.logDebug('Applying edit', edit);
        
        switch (edit.type) {
            case 'expense':
                if (data.expenses[edit.targetId]) {
                    if (edit.field === 'delete') {
                        data.expenses[edit.targetId].active = false;
                    } else {
                        data.expenses[edit.targetId][edit.field] = edit.newValue;
                    }
                }
                break;
                
            case 'settlement':
                if (data.settlements[edit.targetId]) {
                    if (edit.field === 'delete') {
                        data.settlements[edit.targetId].active = false;
                    } else {
                        data.settlements[edit.targetId][edit.field] = edit.newValue;
                    }
                }
                break;
                
            case 'member':
                if (data.members[edit.targetId]) {
                    if (edit.field === 'delete') {
                        data.members[edit.targetId].active = false;
                    } else {
                        data.members[edit.targetId][edit.field] = edit.newValue;
                    }
                }
                break;
        }
    },
    
    // Update sync indicator UI
    updateSyncIndicator(status) {
        const indicator = document.getElementById('sync-indicator');
        const text = document.getElementById('sync-text');
        if (!indicator || !text) return;
        
        indicator.classList.remove('syncing', 'error');
        
        switch (status) {
            case 'syncing':
                indicator.classList.add('syncing');
                text.textContent = 'Syncing...';
                break;
            case 'error':
                indicator.classList.add('error');
                text.textContent = 'Sync error';
                break;
            case 'success':
                // Green by default
                text.textContent = 'Synced';
                setTimeout(() => {
                    indicator.classList.remove('syncing', 'error');
                }, 1000);
                break;
        }
    }
};
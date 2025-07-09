import { GroupsList } from './groups.js';
import { authManager } from './auth.js';

// Dashboard initialization logic
let groupsList;

window.addEventListener('DOMContentLoaded', () => {
    // Check authentication before loading dashboard
    if (!authManager.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    groupsList = new GroupsList('groupsContainer');
    groupsList.loadGroups();
});
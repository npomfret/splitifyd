import { GroupsList } from './groups.js';

// Dashboard initialization logic
let groupsList;

window.addEventListener('DOMContentLoaded', () => {
    // Check authentication before loading dashboard
    if (!window.authManager.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    groupsList = new GroupsList('groupsContainer');
    groupsList.loadGroups();
});
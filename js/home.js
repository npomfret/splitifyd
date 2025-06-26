// Home page controller
document.addEventListener('DOMContentLoaded', () => {
    Utils.log('Home page loaded');
    
    // Initialize app
    App.init();
    
    // Load user's projects
    loadUserProjects();
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Create project
    document.getElementById('create-btn').addEventListener('click', async () => {
        const nameInput = document.getElementById('project-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            Utils.showError('Please enter a project name');
            return;
        }
        
        try {
            const projectId = await App.createProject(name);
            window.location.href = `project.html?id=${projectId}`;
        } catch (error) {
            // Error already shown by App.createProject
        }
    });
    
    // Join project
    document.getElementById('join-btn').addEventListener('click', async () => {
        const idInput = document.getElementById('project-id');
        const idOrUrl = idInput.value.trim();
        
        if (!idOrUrl) {
            Utils.showError('Please enter a project ID or URL');
            return;
        }
        
        try {
            const projectId = await App.joinProject(idOrUrl);
            window.location.href = `project.html?id=${projectId}`;
        } catch (error) {
            // Error already shown by App.joinProject
        }
    });
    
    // Enter key support
    document.getElementById('project-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('create-btn').click();
        }
    });
    
    document.getElementById('project-id').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('join-btn').click();
        }
    });
}

function loadUserProjects() {
    const user = Cache.getUser();
    const projectsList = document.getElementById('projects-list');
    
    // Filter out invalid project IDs
    const validProjects = user.projects.filter(projectId => {
        const isValid = Utils.isValidJsonBinId(projectId);
        if (!isValid) {
            Utils.log(`Skipping invalid project ID: ${projectId}`);
        }
        return isValid;
    });
    
    if (!validProjects || validProjects.length === 0) {
        projectsList.innerHTML = '<p class="empty-state">No projects yet</p>';
        return;
    }
    
    projectsList.innerHTML = '';
    
    validProjects.forEach(projectId => {
        const cached = Cache.getProject(projectId);
        
        if (cached && cached.data) {
            const projectEl = createProjectElement(cached.data);
            projectsList.appendChild(projectEl);
        } else {
            // Try to load from server
            App.loadProject(projectId).then(projectData => {
                const projectEl = createProjectElement(projectData);
                projectsList.appendChild(projectEl);
            }).catch(error => {
                Utils.log('Failed to load project', error);
            });
        }
    });
}

function createProjectElement(projectData) {
    const div = document.createElement('div');
    div.className = 'project-item';
    div.style.cursor = 'pointer';
    
    const memberCount = Object.keys(projectData.members).filter(
        id => projectData.members[id].active !== false
    ).length;
    
    const expenseCount = Object.keys(projectData.expenses).filter(
        id => projectData.expenses[id].active !== false
    ).length;
    
    div.innerHTML = `
        <h3>${projectData.name}</h3>
        <p>${memberCount} members • ${expenseCount} expenses</p>
    `;
    
    div.addEventListener('click', () => {
        window.location.href = `project.html?id=${projectData.id}`;
    });
    
    return div;
}
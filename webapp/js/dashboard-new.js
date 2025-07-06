import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { HeaderComponent } from './components/header.js';
import { AppInit } from './app-init.js';
import { api } from './api.js';

const renderDashboard = async () => {
    const user = await AppInit.requireUser();
    const userName = user.displayName || user.email?.split('@')[0] || 'User';
    
    const groups = await api.groups.getUserGroups(user.uid);
    
    const groupsList = groups.length > 0 ? `
        <div class="groups-list" id="groupsList">
            ${groups.map(group => `
                <a href="/group-detail.html?id=${group.id}" class="group-card">
                    <div class="group-header">
                        <h3 class="group-name">${group.name}</h3>
                        <span class="member-count">${group.memberDetails?.length || 0} members</span>
                    </div>
                    <div class="group-info">
                        <span class="group-balance ${group.userBalance >= 0 ? 'positive' : 'negative'}">
                            ${group.userBalance >= 0 ? 'You are owed' : 'You owe'} 
                            $${Math.abs(group.userBalance).toFixed(2)}
                        </span>
                    </div>
                </a>
            `).join('')}
        </div>
    ` : `
        <div class="empty-state">
            <i class="fas fa-users"></i>
            <h3>No groups yet</h3>
            <p>Create a group to start splitting expenses</p>
        </div>
    `;

    const bodyContent = `
        ${HeaderComponent.render({ title: 'Dashboard' })}
        <main class="main-content">
            <div class="container">
                <div class="welcome-section">
                    <h2>Welcome, ${userName}!</h2>
                    <button class="btn btn-primary" id="createGroupBtn">
                        <i class="fas fa-plus"></i> Create New Group
                    </button>
                </div>
                ${groupsList}
            </div>
        </main>
    `;

    await TemplateEngine.loadAndRenderPage({
        layout: baseLayout,
        data: {
            title: 'Dashboard - Splitifyd',
            bodyContent,
            additionalScripts: '<script type="module" src="/js/groups.js"></script>'
        },
        afterRender: () => {
            HeaderComponent.attachEventListeners();
            document.getElementById('createGroupBtn')?.addEventListener('click', () => {
                window.location.href = '/create-group.html';
            });
        }
    });
};

AppInit.initialize({
    requireAuth: true,
    onReady: renderDashboard
}).catch(error => {
    console.error('Failed to initialize dashboard:', error);
    AppInit.handleError(error);
});
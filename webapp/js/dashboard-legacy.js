import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { HeaderComponent } from './components/header.js';

const renderDashboard = () => {
    const bodyContent = `
        ${HeaderComponent.render({ title: 'Splitifyd' })}
        
        <main class="dashboard-main">
            <div class="dashboard-container">
                <section class="dashboard-content">
                    <div id="groupsContainer" class="groups-container">
                        <div class="loading-state" id="loadingState">
                            <p>Loading your groups...</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `;

    const additionalStyles = `
        <link rel="preload" href="css/main.css" as="style">
        <link rel="stylesheet" href="css/main.css">
        <link rel="stylesheet" href="css/utility.css">
        <link rel="dns-prefetch" href="//api.splitifyd.com">
    `;

    const additionalScripts = `
        <script src="js/config.js"></script>
        <script src="js/api.js"></script>
        <script src="js/auth.js"></script>
        <script src="js/expenses.js"></script>
        <script type="module" src="js/groups.js"></script>
        <script type="module" src="js/dashboard-init.js"></script>
    `;

    TemplateEngine.loadAndRenderPage({
        layout: baseLayout,
        data: {
            title: 'Splitifyd - Dashboard',
            bodyContent,
            additionalStyles,
            additionalScripts
        },
        afterRender: () => {
            HeaderComponent.attachEventListeners();
        }
    });
};

renderDashboard();
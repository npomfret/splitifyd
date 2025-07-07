import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { HeaderComponent } from './components/header.js';
import { NavHeaderComponent } from './components/nav-header.js';

const renderExpenseDetail = () => {
    const headerActions = `
        <button id="edit-expense-btn" class="btn btn-secondary hidden">
            <i class="fas fa-edit"></i>
        </button>
        <button id="delete-expense-btn" class="btn btn-danger hidden">
            <i class="fas fa-trash"></i>
        </button>
    `;

    const deleteModal = `
        <div class="modal" id="delete-confirmation-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Delete Expense</h2>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
                    <div class="expense-preview">
                        <strong id="delete-expense-description">Expense Description</strong>
                        <span id="delete-expense-amount">$0.00</span>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="button button--secondary">Cancel</button>
                    <button class="button button--danger" id="confirm-delete-btn">Delete Expense</button>
                </div>
            </div>
        </div>
    `;

    const bodyContent = `
        ${HeaderComponent.render({ title: 'Splitifyd' })}
        
        <main class="dashboard-main">
            <div class="dashboard-container">
                <div class="expense-detail-container">
                    ${NavHeaderComponent.render({ 
                        title: 'Expense Details', 
                        actions: headerActions 
                    })}
                    
                    <div class="loading" id="loading">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Loading expense details...</p>
                    </div>

                    <div class="expense-detail-content" id="expense-detail-container" hidden>
                        <div class="expense-header">
                            <div class="expense-amount">
                                <span class="currency-symbol">$</span>
                                <span id="expense-amount">0.00</span>
                            </div>
                            <div class="expense-info">
                                <h2 id="expense-description">Loading...</h2>
                                <div class="expense-meta">
                                    <span class="expense-date" id="expense-date">Loading...</span>
                                    <span class="expense-category" id="expense-category">Loading...</span>
                                </div>
                            </div>
                        </div>

                        <div class="expense-details-section">
                            <div class="detail-card">
                                <h3>Paid By</h3>
                                <div class="payer-info">
                                    <div class="user-avatar" id="payer-avatar">
                                        <span id="payer-initials">?</span>
                                    </div>
                                    <div class="user-details">
                                        <span class="user-name" id="payer-name">Loading...</span>
                                        <span class="user-email" id="payer-email">Loading...</span>
                                    </div>
                                </div>
                            </div>

                            <div class="detail-card">
                                <h3>Split Breakdown</h3>
                                <div class="split-breakdown" id="split-breakdown">
                                    <div class="loading-text">Loading split details...</div>
                                </div>
                            </div>

                            <div class="detail-card">
                                <h3>Group</h3>
                                <div class="group-info" id="group-info">
                                    <span class="group-name">Loading...</span>
                                </div>
                            </div>

                            <div class="detail-card" id="receipt-section" hidden>
                                <h3>Receipt</h3>
                                <div class="receipt-container">
                                    <img id="receipt-image" alt="Receipt" class="receipt-image">
                                </div>
                            </div>
                        </div>

                        <div class="error-message" id="error-message" hidden>
                            <p>Failed to load expense details. Please try again.</p>
                            <button class="button button--secondary">Retry</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        
        ${deleteModal}
    `;

    const additionalStyles = `
        <link rel="preload" href="css/main.css" as="style">
        <link rel="stylesheet" href="css/main.css">
        <link rel="stylesheet" href="css/utility.css">
        <link rel="dns-prefetch" href="//api.splitifyd.com">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    `;

    const additionalScripts = `
        <script src="js/config.js"></script>
        <script src="js/api.js"></script>
        <script src="js/auth.js"></script>
        <script src="js/expenses.js"></script>
        <script type="module" src="js/expense-detail.js"></script>
        <script src="js/logout-handler.js"></script>
    `;

    TemplateEngine.loadAndRenderPage({
        layout: baseLayout,
        data: {
            title: 'Expense Detail - Splitifyd',
            bodyContent,
            additionalStyles,
            additionalScripts
        },
        afterRender: () => {
            HeaderComponent.attachEventListeners();
            NavHeaderComponent.attachEventListeners();
        }
    });
};

renderExpenseDetail();
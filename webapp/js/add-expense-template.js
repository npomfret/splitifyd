import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { HeaderComponent } from './components/header.js';
import { NavHeaderComponent } from './components/nav-header.js';

const renderAddExpense = () => {
    const bodyContent = `
        ${HeaderComponent.render({ title: 'Splitifyd' })}
        
        <main class="dashboard-main">
            <div class="dashboard-container">
                <div class="expense-form-container">
                    ${NavHeaderComponent.render({ title: 'Add Expense' })}

                    <form class="expense-form" id="expenseForm" novalidate>
                        <div class="form-group">
                            <label for="description" class="form-label">
                                Description
                                <span class="form-label__required" aria-label="required">*</span>
                            </label>
                            <input 
                                type="text" 
                                id="description" 
                                name="description" 
                                class="form-input"
                                required
                                placeholder="What was this expense for?"
                                aria-describedby="description-error"
                                maxlength="100"
                            >
                            <div id="description-error" class="form-error" role="alert"></div>
                        </div>

                        <div class="form-group">
                            <label for="amount" class="form-label">
                                Amount
                                <span class="form-label__required" aria-label="required">*</span>
                            </label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input 
                                    type="number" 
                                    id="amount" 
                                    name="amount" 
                                    class="form-input"
                                    required
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0.01"
                                    aria-describedby="amount-error"
                                >
                            </div>
                            <div id="amount-error" class="form-error" role="alert"></div>
                        </div>

                        <div class="form-group">
                            <label for="category" class="form-label">Category</label>
                            <select id="category" name="category" class="form-select">
                                <option value="food">🍽️ Food & Dining</option>
                                <option value="transport">🚗 Transportation</option>
                                <option value="utilities">💡 Utilities</option>
                                <option value="entertainment">🎮 Entertainment</option>
                                <option value="shopping">🛍️ Shopping</option>
                                <option value="accommodation">🏠 Accommodation</option>
                                <option value="healthcare">🏥 Healthcare</option>
                                <option value="education">📚 Education</option>
                                <option value="other">📌 Other</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="paidBy" class="form-label">
                                Paid by
                                <span class="form-label__required" aria-label="required">*</span>
                            </label>
                            <select id="paidBy" name="paidBy" class="form-select" required aria-describedby="paidBy-error">
                                <option value="">Select who paid</option>
                            </select>
                            <div id="paidBy-error" class="form-error" role="alert"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Split Method</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input type="radio" name="splitMethod" value="equal" checked>
                                    <span class="radio-custom"></span>
                                    Split equally
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="splitMethod" value="custom">
                                    <span class="radio-custom"></span>
                                    Custom amounts
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">
                                Split between
                                <span class="form-label__required" aria-label="required">*</span>
                            </label>
                            <div id="membersList" class="members-list">
                                <!-- Members will be populated here -->
                            </div>
                            <div id="members-error" class="form-error" role="alert"></div>
                        </div>

                        <div id="customSplitSection" class="form-group hidden">
                            <label class="form-label">Custom Split Amounts</label>
                            <div id="customSplitInputs" class="custom-split-inputs">
                                <!-- Custom split inputs will be populated here -->
                            </div>
                            <div class="split-total">
                                <span>Total: $<span id="splitTotal">0.00</span></span>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="button button--secondary" id="cancelButton">Cancel</button>
                            <button type="submit" class="button button--primary" id="submitButton">
                                <i class="fas fa-save"></i>
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
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
        <script src="js/add-expense.js"></script>
        <script src="js/logout-handler.js"></script>
    `;

    TemplateEngine.loadAndRenderPage({
        layout: baseLayout,
        data: {
            title: 'Add Expense - Splitifyd',
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

renderAddExpense();
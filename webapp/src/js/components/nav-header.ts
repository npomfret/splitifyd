import type { NavHeaderConfig } from '../types/business-logic.js';

export const NavHeaderComponent = {
  render: (config: NavHeaderConfig): string => {
    const { title, backUrl = null, actions = null } = config;
    
    return `
      <nav class="nav-header">
        ${backUrl ? `
          <button class="back-button" id="backButton" data-back-url="${backUrl}">
            <i class="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
        ` : ''}
        <h1 class="page-title">${title}</h1>
        ${actions ? `
          <div class="header-actions">
            ${actions}
          </div>
        ` : ''}
      </nav>
    `;
  },

  attachEventListeners: (): void => {
    const backButton = document.getElementById('backButton') as HTMLButtonElement;
    if (backButton) {
      backButton.addEventListener('click', () => {
        const backUrl = backButton.dataset.backUrl;
        if (backUrl) {
          window.location.href = backUrl;
        } else {
          window.history.back();
        }
      });
    }
  }
};
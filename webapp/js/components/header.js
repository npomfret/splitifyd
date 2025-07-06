export class HeaderComponent {
  static render(config = {}) {
    const { 
      title = 'Dashboard',
      showLogout = true,
      titleLink = '/dashboard.html'
    } = config;

    return `
      <header class="header">
        <div class="container header-container">
          <h1 class="header-title">
            <a href="${titleLink}" class="header-link">${title}</a>
          </h1>
          ${showLogout ? `
            <button class="button button--secondary" id="logoutBtn">
              <i class="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          ` : ''}
        </div>
      </header>
    `;
  }

  static attachEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.authManager.logout();
      });
    }
  }
}
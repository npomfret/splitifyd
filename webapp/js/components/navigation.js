export class NavigationComponent {
  static render(config = {}) {
    const {
      title,
      backUrl = null,
      backText = 'Back',
      actions = []
    } = config;

    return `
      <div class="nav-header">
        ${backUrl ? `
          <a href="${backUrl}" class="back-link">
            <i class="fas fa-arrow-left"></i> ${backText}
          </a>
        ` : ''}
        <h2>${title}</h2>
        ${actions.length > 0 ? `
          <div class="nav-actions">
            ${actions.map(action => {
              if (action.type === 'button') {
                return `
                  <button class="btn ${action.class || 'btn-secondary'}" id="${action.id}" ${action.disabled ? 'disabled' : ''}>
                    ${action.icon ? `<i class="${action.icon}"></i>` : ''}
                    ${action.text || ''}
                  </button>
                `;
              } else if (action.type === 'link') {
                return `
                  <a href="${action.href}" class="btn ${action.class || 'btn-secondary'}" id="${action.id || ''}">
                    ${action.icon ? `<i class="${action.icon}"></i>` : ''}
                    ${action.text || ''}
                  </a>
                `;
              }
              return '';
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  static attachEventListeners(actions = []) {
    actions.forEach(action => {
      if (action.type === 'button' && action.id && action.handler) {
        const button = document.getElementById(action.id);
        if (button) {
          button.addEventListener('click', action.handler);
        }
      }
    });
  }
}
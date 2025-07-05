import { TemplateEngine } from './template-engine.js';
import { baseLayout } from './base-layout.js';
import { HeaderComponent } from '../components/header.js';
import { NavigationComponent } from '../components/navigation.js';
import { FormComponents } from '../components/form-components.js';
import { ListComponents } from '../components/list-components.js';
import { ModalComponent } from '../components/modal.js';
import { AppInit } from '../app-init.js';

export class PageBuilder {
  static async buildAuthenticatedPage(config) {
    const {
      title,
      pageId,
      renderContent,
      onReady,
      additionalScripts = '',
      additionalStyles = ''
    } = config;

    await AppInit.initialize({
      requireAuth: true,
      onReady: async () => {
        try {
          const user = await AppInit.requireUser();
          const content = await renderContent(user);
          
          const bodyContent = `
            ${HeaderComponent.render({ title })}
            <main class="main-content" id="${pageId}">
              ${content}
            </main>
          `;

          await TemplateEngine.loadAndRenderPage({
            layout: baseLayout,
            data: {
              title: `${title} - Splitifyd`,
              bodyContent,
              additionalScripts,
              additionalStyles
            },
            afterRender: () => {
              HeaderComponent.attachEventListeners();
              if (onReady) onReady(user);
            }
          });
        } catch (error) {
          console.error(`Failed to build ${pageId}:`, error);
          AppInit.handleError(error);
        }
      }
    });
  }

  static renderPageWithNavigation(config) {
    const {
      navigationTitle,
      backUrl,
      backText = 'Back',
      actions = [],
      content
    } = config;

    return `
      <div class="container">
        ${NavigationComponent.render({
          title: navigationTitle,
          backUrl,
          backText,
          actions
        })}
        ${content}
      </div>
    `;
  }

  static renderForm(config) {
    const { formId, fields, submitButton, onSubmit } = config;
    
    const formFields = fields.map(field => 
      FormComponents.formGroup(field)
    ).join('');

    const formHtml = `
      <form id="${formId}" class="form">
        ${formFields}
        ${FormComponents.formActions([
          FormComponents.submitButton(submitButton)
        ])}
      </form>
    `;

    if (onSubmit) {
      setTimeout(() => {
        const form = document.getElementById(formId);
        if (form) {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = FormComponents.getFormData(formId);
            await onSubmit(data);
          });
        }
      }, 0);
    }

    return formHtml;
  }

  static renderList(config) {
    const {
      items,
      renderItem,
      emptyState,
      containerId,
      containerClass = 'list-container'
    } = config;

    if (!items || items.length === 0) {
      return emptyState || ListComponents.renderEmptyState({
        icon: 'fas fa-inbox',
        title: 'No items found',
        message: 'There are no items to display.'
      });
    }

    const listItems = items.map(item => renderItem(item)).join('');
    
    return `
      <div id="${containerId}" class="${containerClass}">
        ${listItems}
      </div>
    `;
  }

  static async renderModal(config) {
    const modalHtml = ModalComponent.render(config);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
    
    if (config.show) {
      ModalComponent.show(config.id);
    }
    
    return config.id;
  }

  static showConfirmDialog(config) {
    return new Promise((resolve) => {
      ModalComponent.confirm({
        ...config,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }
}
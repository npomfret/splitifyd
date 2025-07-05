export class TemplateEngine {
  static async loadTemplate(templatePath) {
    try {
      const module = await import(templatePath);
      return module;
    } catch (error) {
      console.error(`Failed to load template: ${templatePath}`, error);
      throw error;
    }
  }

  static renderToElement(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    } else {
      console.error(`Element with id '${elementId}' not found`);
    }
  }

  static createElement(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild;
  }

  static async renderPage(config) {
    const { layout, components = [], data = {} } = config;
    
    const componentHTML = await Promise.all(
      components.map(async (comp) => {
        if (typeof comp === 'function') {
          return comp(data);
        } else if (typeof comp === 'object' && comp.render) {
          return comp.render(data);
        }
        return comp;
      })
    );

    return layout.render({
      ...data,
      bodyContent: componentHTML.join('')
    });
  }

  static replaceDocumentContent(html) {
    document.open();
    document.write(html);
    document.close();
  }

  static async loadAndRenderPage(config) {
    try {
      const html = await this.renderPage(config);
      this.replaceDocumentContent(html);
      
      if (config.afterRender) {
        setTimeout(() => {
          config.afterRender();
        }, 0);
      }
    } catch (error) {
      console.error('Failed to render page:', error);
      throw error;
    }
  }
}
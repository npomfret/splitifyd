import { BaseComponent } from './base-component.js';

interface PageLayoutConfig {
  type?: 'default' | 'container' | 'full-width' | 'auth' | 'dashboard';
  header?: boolean;
  footer?: boolean;
  navigation?: boolean;
  containerClass?: string;
  mainClass?: string;
  attributes?: Record<string, string>;
}

export class PageLayoutComponent extends BaseComponent<HTMLDivElement> {
  private config: PageLayoutConfig;
  private contentContainer: HTMLElement | null = null;
  private componentId: string;

  constructor(config: PageLayoutConfig = {}) {
    super();
    this.config = {
      type: 'default',
      header: true,
      footer: true,
      navigation: false,
      containerClass: '',
      mainClass: '',
      attributes: {},
      ...config
    };
    this.componentId = this.generateUniqueId('page-layout');
  }

  protected render(): HTMLDivElement {
    const { type, containerClass, mainClass, attributes } = this.config;
    
    const layoutClass = this.getLayoutClass(type);
    const containerClasses = `${layoutClass} ${containerClass || ''}`.trim();
    const mainClasses = `main-content ${mainClass || ''}`.trim();

    const container = document.createElement('div');
    container.className = containerClasses;
    
    Object.entries(attributes || {}).forEach(([key, value]) => {
      container.setAttribute(key, value);
    });

    if (this.config.header) {
      const headerPlaceholder = this.createHeaderElement();
      if (headerPlaceholder) container.appendChild(headerPlaceholder);
    }
    
    if (this.config.navigation) {
      const navPlaceholder = this.createNavigationElement();
      if (navPlaceholder) container.appendChild(navPlaceholder);
    }

    const main = document.createElement('main');
    main.className = mainClasses;
    main.id = `${this.componentId}-content`;
    container.appendChild(main);

    if (this.config.footer) {
      const footerPlaceholder = this.createFooterElement();
      if (footerPlaceholder) container.appendChild(footerPlaceholder);
    }

    return container;
  }

  protected setupEventListeners(): void {
    if (this.element) {
      this.contentContainer = this.element.querySelector(`#${this.componentId}-content`);
    }
  }

  setContent(content: string | HTMLElement): void {
    if (!this.contentContainer) return;

    this.contentContainer.textContent = '';
    
    if (typeof content === 'string') {
      this.contentContainer.textContent = content;
    } else {
      this.contentContainer.appendChild(content);
    }
  }

  appendContent(content: string | HTMLElement): void {
    if (!this.contentContainer) return;

    if (typeof content === 'string') {
      const textNode = document.createTextNode(content);
      this.contentContainer.appendChild(textNode);
    } else {
      this.contentContainer.appendChild(content);
    }
  }

  clearContent(): void {
    if (this.contentContainer) {
      this.contentContainer.textContent = '';
    }
  }

  getContentContainer(): HTMLElement | null {
    return this.contentContainer;
  }

  protected cleanup(): void {
    this.contentContainer = null;
  }

  private getLayoutClass(type?: string): string {
    const layoutMap: Record<string, string> = {
      'default': 'page-layout',
      'container': 'container',
      'full-width': 'page-layout--full',
      'auth': 'auth-layout',
      'dashboard': 'dashboard-layout'
    };
    return layoutMap[type || 'default'] || 'page-layout';
  }

  private createHeaderElement(): HTMLDivElement | null {
    if (!this.config.header || this.config.type === 'auth') {
      return null;
    }
    
    const header = document.createElement('div');
    header.id = 'header-placeholder';
    return header;
  }

  private createNavigationElement(): HTMLDivElement | null {
    if (!this.config.navigation) {
      return null;
    }
    
    const nav = document.createElement('div');
    nav.id = 'navigation-placeholder';
    return nav;
  }

  private createFooterElement(): HTMLDivElement | null {
    if (!this.config.footer || this.config.type === 'auth') {
      return null;
    }
    
    const footer = document.createElement('div');
    footer.id = 'footer-placeholder';
    return footer;
  }

  updateLayout(config: Partial<PageLayoutConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.element && this.element.parentElement) {
      const parent = this.element.parentElement;
      const currentContent = this.contentContainer?.cloneNode(true) as HTMLElement;
      
      this.unmount();
      this.mount(parent);
      
      if (this.contentContainer && currentContent) {
        this.contentContainer.textContent = '';
        while (currentContent.firstChild) {
          this.contentContainer.appendChild(currentContent.firstChild);
        }
      }
    }
  }
}
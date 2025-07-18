import { BaseComponent } from './base-component.js';
import { createElementSafe } from '../utils/safe-dom.js';
import { updatePageTitle } from '../utils/page-title.js';
import { WarningBannerComponent } from './warning-banner.js';

export interface PolicyPageConfig {
  title: string;
  content: string;
}

export class PolicyPageComponent extends BaseComponent<HTMLDivElement> {
  constructor(private config: PolicyPageConfig) {
    super();
  }

  async mount(container: HTMLElement): Promise<void> {
    await updatePageTitle(this.config.title);
    super.mount(container);
  }

  protected render(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'policy-page-wrapper';
    
    const mainContent = createElementSafe('div', {
      className: 'main-content'
    });

    const container = createElementSafe('div', {
      className: 'policy-container'
    });

    const header = createElementSafe('header', {
      className: 'static-page-header'
    });

    const logoLink = createElementSafe('a', {
      href: '/',
      className: 'logo'
    });

    const logoImg = createElementSafe('img', {
      src: '/images/logo.svg',
      alt: 'Logo',
      className: 'logo-img'
    }) as HTMLImageElement;

    logoLink.appendChild(logoImg);

    const h1 = createElementSafe('h1', {
      textContent: this.config.title
    });

    header.appendChild(logoLink);
    header.appendChild(h1);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'static-page-content';
    contentDiv.innerHTML = this.config.content;

    const footer = createElementSafe('footer', {
      className: 'static-page-footer'
    });

    const footerText = createElementSafe('p', {
      textContent: '© 2025 Pomo Corp ltd. All rights reserved.'
    });

    footer.appendChild(footerText);

    // Structure with proper containers
    container.appendChild(header);
    container.appendChild(contentDiv);
    
    mainContent.appendChild(container);
    wrapper.appendChild(mainContent);
    wrapper.appendChild(footer);

    return wrapper;
  }
}
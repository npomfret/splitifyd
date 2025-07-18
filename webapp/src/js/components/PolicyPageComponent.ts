import { BaseComponent } from './base-component.js';
import { createElementSafe } from '../utils/safe-dom.js';
import { updatePageTitle } from '../utils/page-title.js';

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
    const container = document.createElement('div');
    container.className = 'main-content';

    const main = createElementSafe('main', {
      className: 'container'
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

    const contentDiv = createElementSafe('div', {
      className: 'static-page-content',
      innerHTML: this.config.content
    });

    const footer = createElementSafe('footer', {
      className: 'static-page-footer'
    });

    const footerText = createElementSafe('p', {
      textContent: '© 2025 Pomo Corp ltd. All rights reserved.'
    });

    footer.appendChild(footerText);

    main.appendChild(header);
    main.appendChild(contentDiv);
    main.appendChild(footer);
    container.appendChild(main);

    return container;
  }
}
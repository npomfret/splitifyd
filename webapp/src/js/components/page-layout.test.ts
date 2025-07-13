import { PageLayoutComponent } from './page-layout';

describe('PageLayoutComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Basic Rendering', () => {
    it('should render with default configuration', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();

      const main = element?.querySelector('main.main-content');
      expect(main).toBeTruthy();
      expect(main?.id).toContain('page-layout-');
      expect(main?.id).toContain('-content');

      const header = element?.querySelector('#header-placeholder');
      expect(header).toBeTruthy();

      const footer = element?.querySelector('#footer-placeholder');
      expect(footer).toBeTruthy();

      const nav = element?.querySelector('#navigation-placeholder');
      expect(nav).toBeFalsy();
    });

    it('should render without header and footer when disabled', () => {
      const layout = new PageLayoutComponent({
        header: false,
        footer: false
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();

      expect(element?.querySelector('#header-placeholder')).toBeFalsy();
      expect(element?.querySelector('#footer-placeholder')).toBeFalsy();
    });

    it('should render with navigation when enabled', () => {
      const layout = new PageLayoutComponent({
        navigation: true
      });
      layout.mount(container);

      const nav = container.querySelector('#navigation-placeholder');
      expect(nav).toBeTruthy();
    });

    it('should apply custom classes', () => {
      const layout = new PageLayoutComponent({
        containerClass: 'custom-container',
        mainClass: 'custom-main'
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element?.className).toContain('custom-container');

      const main = element?.querySelector('main');
      expect(main?.className).toContain('custom-main');
    });

    it('should apply custom attributes', () => {
      const layout = new PageLayoutComponent({
        attributes: {
          'data-testid': 'page-layout',
          'aria-label': 'Main page layout'
        }
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element?.getAttribute('data-testid')).toBe('page-layout');
      expect(element?.getAttribute('aria-label')).toBe('Main page layout');
    });
  });

  describe('Layout Types', () => {
    it('should apply default layout class', () => {
      const layout = new PageLayoutComponent({
        type: 'default'
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();
    });

    it('should apply container layout class', () => {
      const layout = new PageLayoutComponent({
        type: 'container'
      });
      layout.mount(container);

      const element = container.querySelector('.container');
      expect(element).toBeTruthy();
    });

    it('should apply full-width layout class', () => {
      const layout = new PageLayoutComponent({
        type: 'full-width'
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout--full');
      expect(element).toBeTruthy();
    });

    it('should apply auth layout class and hide header/footer', () => {
      const layout = new PageLayoutComponent({
        type: 'auth',
        header: true,
        footer: true
      });
      layout.mount(container);

      const element = container.querySelector('.auth-layout');
      expect(element).toBeTruthy();

      expect(element?.querySelector('#header-placeholder')).toBeFalsy();
      expect(element?.querySelector('#footer-placeholder')).toBeFalsy();
    });

    it('should apply dashboard layout class', () => {
      const layout = new PageLayoutComponent({
        type: 'dashboard'
      });
      layout.mount(container);

      const element = container.querySelector('.dashboard-layout');
      expect(element).toBeTruthy();
    });

    it('should fallback to default layout for unknown type', () => {
      const layout = new PageLayoutComponent({
        type: 'unknown' as any
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();
    });
  });

  describe('Content Management', () => {
    it('should set text content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      layout.setContent('Hello, World!');

      const main = container.querySelector('main');
      expect(main?.textContent).toBe('Hello, World!');
    });

    it('should set HTML element content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const div = document.createElement('div');
      div.className = 'test-content';
      div.textContent = 'Test Element';

      layout.setContent(div);

      const main = container.querySelector('main');
      const testElement = main?.querySelector('.test-content');
      expect(testElement?.textContent).toBe('Test Element');
    });

    it('should replace existing content when setting new content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      layout.setContent('First content');
      expect(container.querySelector('main')?.textContent).toBe('First content');

      layout.setContent('Second content');
      expect(container.querySelector('main')?.textContent).toBe('Second content');
    });

    it('should append text content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      layout.setContent('Initial content');
      layout.appendContent(' - Additional content');

      const main = container.querySelector('main');
      expect(main?.textContent).toBe('Initial content - Additional content');
    });

    it('should append HTML element content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const div1 = document.createElement('div');
      div1.textContent = 'First element';
      
      const div2 = document.createElement('div');
      div2.textContent = 'Second element';

      layout.setContent(div1);
      layout.appendContent(div2);

      const main = container.querySelector('main');
      expect(main?.children.length).toBe(2);
      expect(main?.children[0].textContent).toBe('First element');
      expect(main?.children[1].textContent).toBe('Second element');
    });

    it('should clear content', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      layout.setContent('Content to clear');
      expect(container.querySelector('main')?.textContent).toBe('Content to clear');

      layout.clearContent();
      expect(container.querySelector('main')?.textContent).toBe('');
    });

    it('should handle content operations when not mounted', () => {
      const layout = new PageLayoutComponent();

      expect(() => {
        layout.setContent('Test');
        layout.appendContent('More');
        layout.clearContent();
      }).not.toThrow();
    });

    it('should return content container', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const contentContainer = layout.getContentContainer();
      const main = container.querySelector('main');
      expect(contentContainer).toBe(main);
    });

    it('should return null for content container when not mounted', () => {
      const layout = new PageLayoutComponent();

      const contentContainer = layout.getContentContainer();
      expect(contentContainer).toBeNull();
    });
  });

  describe('Layout Updates', () => {
    it('should update layout configuration', () => {
      const layout = new PageLayoutComponent({
        type: 'default',
        navigation: false
      });
      layout.mount(container);

      expect(container.querySelector('.dashboard-layout')).toBeFalsy();
      expect(container.querySelector('#navigation-placeholder')).toBeFalsy();

      layout.updateLayout({
        type: 'dashboard',
        navigation: true
      });

      expect(container.querySelector('.dashboard-layout')).toBeTruthy();
      expect(container.querySelector('#navigation-placeholder')).toBeTruthy();
    });

    it('should preserve content during layout update', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const testDiv = document.createElement('div');
      testDiv.className = 'preserved-content';
      testDiv.textContent = 'Content to preserve';

      layout.setContent(testDiv);
      
      layout.updateLayout({ type: 'dashboard' });

      const preservedContent = container.querySelector('.preserved-content');
      expect(preservedContent?.textContent).toBe('Content to preserve');
    });

    it('should handle layout update when not mounted', () => {
      const layout = new PageLayoutComponent();

      expect(() => {
        layout.updateLayout({ type: 'dashboard' });
      }).not.toThrow();
    });

    it('should update multiple configuration options', () => {
      const layout = new PageLayoutComponent({
        type: 'default',
        header: true,
        footer: true,
        navigation: false,
        containerClass: 'old-class'
      });
      layout.mount(container);

      layout.updateLayout({
        type: 'auth',
        navigation: true,
        containerClass: 'new-class'
      });

      const element = container.querySelector('.auth-layout');
      expect(element).toBeTruthy();
      expect(element?.className).toContain('new-class');
      expect(container.querySelector('#navigation-placeholder')).toBeTruthy();
      expect(container.querySelector('#header-placeholder')).toBeFalsy();
      expect(container.querySelector('#footer-placeholder')).toBeFalsy();
    });
  });

  describe('Component ID Generation', () => {
    it('should generate unique component IDs', () => {
      const layout1 = new PageLayoutComponent();
      layout1.mount(container);

      const layout2 = new PageLayoutComponent();
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);
      layout2.mount(tempContainer);

      const main1 = container.querySelector('main');
      const main2 = tempContainer.querySelector('main');

      expect(main1?.id).not.toBe(main2?.id);
      expect(main1?.id).toContain('page-layout-');
      expect(main2?.id).toContain('page-layout-');

      document.body.removeChild(tempContainer);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty attributes object', () => {
      const layout = new PageLayoutComponent({
        attributes: {}
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();
    });

    it('should handle null/undefined configuration values', () => {
      const layout = new PageLayoutComponent({
        containerClass: undefined,
        mainClass: undefined,
        attributes: undefined
      });
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element).toBeTruthy();

      const main = element?.querySelector('main');
      expect(main?.className).toBe('main-content');
    });

    it('should apply default values when no config provided', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      const element = container.querySelector('.page-layout');
      expect(element?.classList.contains('page-layout')).toBe(true);
      expect(element?.querySelector('#header-placeholder')).toBeTruthy();
      expect(element?.querySelector('#footer-placeholder')).toBeTruthy();
      expect(element?.querySelector('nav')).toBeFalsy();
      expect(element?.querySelector('.main-content')).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      expect(container.querySelector('.page-layout')).toBeTruthy();

      layout.unmount();

      expect(container.querySelector('.page-layout')).toBeFalsy();
    });

    it('should reset content container reference on unmount', () => {
      const layout = new PageLayoutComponent();
      layout.mount(container);

      expect(layout.getContentContainer()).toBeTruthy();

      layout.unmount();

      expect(layout.getContentContainer()).toBeFalsy();
    });
  });
});
import { LoadingSpinnerComponent } from './loading-spinner';

describe('LoadingSpinnerComponent', () => {
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
      const spinner = new LoadingSpinnerComponent();
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element).toBeTruthy();
      expect(element?.className).toBe('loading-spinner loading-spinner--default loading-spinner--medium');
      expect(element?.getAttribute('role')).toBe('status');
      expect(element?.getAttribute('aria-live')).toBe('polite');

      const icon = element?.querySelector('i.fas.fa-spinner.fa-spin');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');

      const message = element?.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Loading...');
    });

    it('should render without message when showMessage is false', () => {
      const spinner = new LoadingSpinnerComponent({
        showMessage: false
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.querySelector('.loading-spinner__message')).toBeFalsy();
    });

    it('should render with custom message', () => {
      const spinner = new LoadingSpinnerComponent({
        message: 'Please wait...'
      });
      spinner.mount(container);

      const message = container.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Please wait...');
    });

    it('should render with custom class', () => {
      const spinner = new LoadingSpinnerComponent({
        customClass: 'custom-spinner'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain('custom-spinner');
    });
  });

  describe('Size Variants', () => {
    it.each(['small', 'medium', 'large'])('should apply %s size class', (size) => {
      const spinner = new LoadingSpinnerComponent({
        size: size as any
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain(`loading-spinner--${size}`);
    });
  });

  describe('Display Variants', () => {
    it('should render default variant', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'default'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner') as HTMLElement;
      expect(element?.className).toContain('loading-spinner--default');
      expect(element?.style.position).toBe('');
    });

    it('should render inline variant', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'inline'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain('loading-spinner--inline');
    });

    it('should render overlay variant with styles', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'overlay',
        message: 'Processing...'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner') as HTMLElement;
      expect(element?.className).toContain('loading-spinner--overlay');
      expect(element?.getAttribute('aria-label')).toBe('Processing...');
      
      expect(element?.style.position).toBe('fixed');
      expect(element?.style.top).toBe('0px');
      expect(element?.style.left).toBe('0px');
      expect(element?.style.width).toBe('100%');
      expect(element?.style.height).toBe('100%');
      expect(element?.style.backgroundColor).toBe('rgba(255, 255, 255, 0.9)');
      expect(element?.style.display).toBe('flex');
      expect(element?.style.flexDirection).toBe('column');
      expect(element?.style.alignItems).toBe('center');
      expect(element?.style.justifyContent).toBe('center');
      expect(element?.style.zIndex).toBe('9999');
    });
  });

  describe('Message Updates', () => {
    it('should update existing message', () => {
      const spinner = new LoadingSpinnerComponent({
        message: 'Initial message'
      });
      spinner.mount(container);

      let message = container.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Initial message');

      spinner.updateMessage('Updated message');
      message = container.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Updated message');
    });

    it('should add message if initially not shown but showMessage is true', () => {
      const spinner = new LoadingSpinnerComponent({
        showMessage: true
      });
      spinner.mount(container);

      expect(container.querySelector('.loading-spinner__message')).toBeTruthy();

      spinner.updateMessage('New message');
      const message = container.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('New message');
    });

    it('should not create message element when showMessage is false', () => {
      const spinner = new LoadingSpinnerComponent({
        showMessage: false
      });
      spinner.mount(container);

      expect(container.querySelector('.loading-spinner__message')).toBeFalsy();

      // Update message, but since showMessage is false, no element should be created
      spinner.updateMessage('New message');

      const message = container.querySelector('.loading-spinner__message');
      expect(message).toBeFalsy();
    });

    it('should update aria-label for overlay variant', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'overlay',
        message: 'Loading data...'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.getAttribute('aria-label')).toBe('Loading data...');

      spinner.updateMessage('Saving changes...');
      expect(element?.getAttribute('aria-label')).toBe('Saving changes...');
    });
  });

  describe('Show/Hide Functionality', () => {
    it('should show spinner with correct display style for default variant', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'default'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner') as HTMLElement;
      element.style.display = 'none';

      spinner.show();
      expect(element.style.display).toBe('block');
      expect(element.getAttribute('aria-hidden')).toBe('false');
    });

    it('should show spinner with flex display for overlay variant', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'overlay'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner') as HTMLElement;
      element.style.display = 'none';

      spinner.show();
      expect(element.style.display).toBe('flex');
      expect(element.getAttribute('aria-hidden')).toBe('false');
    });

    it('should hide spinner', () => {
      const spinner = new LoadingSpinnerComponent();
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner') as HTMLElement;
      
      spinner.hide();
      expect(element.style.display).toBe('none');
      expect(element.getAttribute('aria-hidden')).toBe('true');
    });

    it('should handle show/hide when element is not mounted', () => {
      const spinner = new LoadingSpinnerComponent();
      
      expect(() => {
        spinner.show();
        spinner.hide();
      }).not.toThrow();
    });
  });

  describe('Static Factory Methods', () => {
    it('should create overlay spinner with createOverlay', () => {
      const spinner = LoadingSpinnerComponent.createOverlay('Custom loading...');
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain('loading-spinner--overlay');
      expect(element?.className).toContain('loading-spinner--large');
      expect(element?.getAttribute('aria-label')).toBe('Custom loading...');
      
      const message = element?.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Custom loading...');
    });

    it('should create overlay spinner with default message', () => {
      const spinner = LoadingSpinnerComponent.createOverlay();
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.getAttribute('aria-label')).toBe('Loading...');
    });

    it('should create inline spinner with message', () => {
      const spinner = LoadingSpinnerComponent.createInline('Inline loading...');
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain('loading-spinner--inline');
      expect(element?.className).toContain('loading-spinner--small');
      
      const message = element?.querySelector('.loading-spinner__message');
      expect(message?.textContent).toBe('Inline loading...');
    });

    it('should create inline spinner without message when none provided', () => {
      const spinner = LoadingSpinnerComponent.createInline();
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.className).toContain('loading-spinner--inline');
      expect(element?.querySelector('.loading-spinner__message')).toBeFalsy();
    });
  });

  describe('Component Structure', () => {
    it('should have correct DOM structure', () => {
      const spinner = new LoadingSpinnerComponent({
        message: 'Test message'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element).toBeTruthy();

      const iconContainer = element?.querySelector('.loading-spinner__icon');
      expect(iconContainer).toBeTruthy();

      const icon = iconContainer?.querySelector('i.fas.fa-spinner.fa-spin');
      expect(icon).toBeTruthy();

      const message = element?.querySelector('.loading-spinner__message');
      expect(message).toBeTruthy();
    });

    it('should maintain proper accessibility attributes', () => {
      const spinner = new LoadingSpinnerComponent({
        variant: 'overlay',
        message: 'Loading content...'
      });
      spinner.mount(container);

      const element = container.querySelector('.loading-spinner');
      expect(element?.getAttribute('role')).toBe('status');
      expect(element?.getAttribute('aria-live')).toBe('polite');
      expect(element?.getAttribute('aria-label')).toBe('Loading content...');

      const icon = element?.querySelector('i');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const spinner = new LoadingSpinnerComponent();
      spinner.mount(container);

      expect(container.querySelector('.loading-spinner')).toBeTruthy();

      spinner.unmount();

      expect(container.querySelector('.loading-spinner')).toBeFalsy();
    });
  });
});
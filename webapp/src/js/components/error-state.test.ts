import { ErrorStateComponent } from './error-state';

describe('ErrorStateComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render with required configuration', () => {
      const errorState = new ErrorStateComponent({
        id: 'test-error'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element).toBeTruthy();
      expect(element?.id).toBe('test-error');
      expect(element?.className).toBe('error-state error-state--inline');
      expect(element?.getAttribute('role')).toBe('alert');
      expect(element?.style.display).toBe('none');

      const content = element?.querySelector('.error-state__content');
      expect(content).toBeTruthy();

      const icon = content?.querySelector('.error-state__icon');
      expect(icon).toBeTruthy();
      expect(icon?.className).toBe('error-state__icon fas fa-exclamation-circle');

      const message = content?.querySelector('.error-state__message');
      expect(message).toBeTruthy();
      expect(message?.textContent).toBe('');
    });

    it('should render with initial message', () => {
      const errorState = new ErrorStateComponent({
        id: 'message-error',
        message: 'Initial error message'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element?.style.display).not.toBe('none');

      const message = element?.querySelector('.error-state__message');
      expect(message?.textContent).toBe('Initial error message');
    });

    it('should render without icon when disabled', () => {
      const errorState = new ErrorStateComponent({
        id: 'no-icon-error',
        icon: false
      });
      errorState.mount(container);

      const icon = container.querySelector('.error-state__icon');
      expect(icon).toBeFalsy();
    });
  });

  describe('Error Types', () => {
    it.each(['inline', 'page', 'toast'])('should apply %s type class', (type) => {
      const errorState = new ErrorStateComponent({
        id: `${type}-error`,
        type: type as any
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state');
      expect(element?.className).toContain(`error-state--${type}`);
    });

    it('should change type dynamically', () => {
      const errorState = new ErrorStateComponent({
        id: 'dynamic-type-error',
        type: 'inline'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state');
      expect(element?.className).toContain('error-state--inline');

      errorState.setType('toast');
      expect(element?.className).toContain('error-state--toast');
      expect(element?.className).not.toContain('error-state--inline');
    });
  });

  describe('Dismissible Functionality', () => {
    it('should render dismiss button when dismissible', () => {
      const errorState = new ErrorStateComponent({
        id: 'dismissible-error',
        dismissible: true
      });
      errorState.mount(container);

      const dismissButton = container.querySelector('.error-state__dismiss');
      expect(dismissButton).toBeTruthy();
      expect(dismissButton?.getAttribute('aria-label')).toBe('Dismiss error');

      const dismissIcon = dismissButton?.querySelector('i.fas.fa-times');
      expect(dismissIcon).toBeTruthy();
    });

    it('should not render dismiss button when not dismissible', () => {
      const errorState = new ErrorStateComponent({
        id: 'non-dismissible-error',
        dismissible: false
      });
      errorState.mount(container);

      const dismissButton = container.querySelector('.error-state__dismiss');
      expect(dismissButton).toBeFalsy();
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = jest.fn();
      const errorState = new ErrorStateComponent({
        id: 'dismiss-callback-error',
        message: 'Error to dismiss',
        dismissible: true,
        onDismiss
      });
      errorState.mount(container);

      const dismissButton = container.querySelector('.error-state__dismiss') as HTMLButtonElement;
      dismissButton.click();

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should hide error when dismiss button is clicked', () => {
      const errorState = new ErrorStateComponent({
        id: 'hide-on-dismiss-error',
        message: 'Error to hide',
        dismissible: true
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element.style.display).not.toBe('none');

      const dismissButton = container.querySelector('.error-state__dismiss') as HTMLButtonElement;
      dismissButton.click();

      expect(element.style.display).toBe('none');
    });

    it('should toggle dismissible state dynamically', () => {
      const onDismiss = jest.fn();
      const errorState = new ErrorStateComponent({
        id: 'toggle-dismissible-error',
        dismissible: false,
        onDismiss
      });
      errorState.mount(container);

      expect(container.querySelector('.error-state__dismiss')).toBeFalsy();

      errorState.setDismissible(true);
      expect(container.querySelector('.error-state__dismiss')).toBeTruthy();

      const dismissButton = container.querySelector('.error-state__dismiss') as HTMLButtonElement;
      dismissButton.click();
      expect(onDismiss).toHaveBeenCalled();

      errorState.setDismissible(false);
      expect(container.querySelector('.error-state__dismiss')).toBeFalsy();
    });
  });

  describe('Error Display', () => {
    it('should show error with message', () => {
      const errorState = new ErrorStateComponent({
        id: 'show-error'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element.style.display).toBe('none');

      errorState.showError('Something went wrong');

      expect(element.style.display).toBe('block');
      const message = element.querySelector('.error-state__message');
      expect(message?.textContent).toBe('Something went wrong');
    });

    it('should add visible class for toast type', () => {
      const errorState = new ErrorStateComponent({
        id: 'toast-error',
        type: 'toast'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state');
      expect(element?.classList.contains('error-state--visible')).toBe(false);

      errorState.showError('Toast error');
      expect(element?.classList.contains('error-state--visible')).toBe(true);
    });

    it('should hide error', () => {
      const errorState = new ErrorStateComponent({
        id: 'hide-error',
        message: 'Visible error'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element.style.display).not.toBe('none');

      errorState.hide();
      expect(element.style.display).toBe('none');
    });

    it('should handle toast hide with animation delay', () => {
      const errorState = new ErrorStateComponent({
        id: 'toast-hide-error',
        type: 'toast',
        message: 'Toast error'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      errorState.showError('Toast error to hide');
      expect(element.classList.contains('error-state--visible')).toBe(true);

      errorState.hide();
      expect(element.classList.contains('error-state--visible')).toBe(false);
      expect(element.style.display).not.toBe('none');

      jest.advanceTimersByTime(300);
      expect(element.style.display).toBe('none');
    });
  });

  describe('Auto Hide Functionality', () => {
    it('should auto hide after specified duration', () => {
      const errorState = new ErrorStateComponent({
        id: 'auto-hide-error',
        autoHideAfter: 3000
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      
      errorState.showError('Auto hide error');
      expect(element.style.display).toBe('block');

      jest.advanceTimersByTime(2999);
      expect(element.style.display).toBe('block');

      jest.advanceTimersByTime(1);
      expect(element.style.display).toBe('none');
    });

    it('should reset auto hide timer when showing new error', () => {
      const errorState = new ErrorStateComponent({
        id: 'reset-timer-error',
        autoHideAfter: 3000
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      
      errorState.showError('First error');
      jest.advanceTimersByTime(2000);

      errorState.showError('Second error');
      jest.advanceTimersByTime(2000);
      expect(element.style.display).toBe('block');

      jest.advanceTimersByTime(1000);
      expect(element.style.display).toBe('none');
    });

    it('should clear auto hide timer when manually hidden', () => {
      const errorState = new ErrorStateComponent({
        id: 'manual-hide-error',
        autoHideAfter: 3000
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      
      errorState.showError('Manual hide error');
      jest.advanceTimersByTime(1000);
      
      errorState.hide();
      expect(element.style.display).toBe('none');

      jest.advanceTimersByTime(5000);
      expect(element.style.display).toBe('none');
    });

    it('should auto hide on initial message with autoHideAfter', () => {
      const errorState = new ErrorStateComponent({
        id: 'init-auto-hide-error',
        message: 'Initial auto hide message',
        autoHideAfter: 2000
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state') as HTMLElement;
      expect(element.style.display).not.toBe('none');

      jest.advanceTimersByTime(2000);
      expect(element.style.display).toBe('none');
    });
  });

  describe('Event Listener Setup', () => {
    it('should set initial message during setup', () => {
      const errorState = new ErrorStateComponent({
        id: 'setup-message-error',
        message: 'Setup message'
      });
      errorState.mount(container);

      const message = container.querySelector('.error-state__message');
      expect(message?.textContent).toBe('Setup message');
    });

    it('should handle missing elements gracefully', () => {
      const errorState = new ErrorStateComponent({
        id: 'graceful-error'
      });

      expect(() => {
        errorState.showError('Test error');
        errorState.hide();
        errorState.setType('toast');
        errorState.setDismissible(true);
      }).not.toThrow();
    });
  });

  describe('Configuration Defaults', () => {
    it('should apply default configuration values', () => {
      const errorState = new ErrorStateComponent({
        id: 'defaults-error'
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state');
      // Default type is 'inline'
      expect(element?.classList.contains('error-state--inline')).toBe(true);
      // Default icon is true
      expect(element?.querySelector('.error-state__icon')).toBeTruthy();
      // Default dismissible is false
      expect(element?.querySelector('.error-state__dismiss')).toBeFalsy();
    });

    it('should override defaults with provided values', () => {
      const errorState = new ErrorStateComponent({
        id: 'override-error',
        type: 'toast',
        icon: false,
        dismissible: true
      });
      errorState.mount(container);

      const element = container.querySelector('.error-state');
      // Type should be 'toast'
      expect(element?.classList.contains('error-state--toast')).toBe(true);
      // Icon should be false
      expect(element?.querySelector('.error-state__icon')).toBeFalsy();
      // Dismissible should be true
      expect(element?.querySelector('.error-state__dismiss')).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should clear auto hide timeout on cleanup', () => {
      const errorState = new ErrorStateComponent({
        id: 'cleanup-timeout-error',
        autoHideAfter: 5000
      });
      errorState.mount(container);

      errorState.showError('Cleanup test error');
      
      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
      errorState.unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should cleanup properly on unmount', () => {
      const errorState = new ErrorStateComponent({
        id: 'cleanup-error',
        message: 'Cleanup error'
      });
      errorState.mount(container);

      expect(container.querySelector('.error-state')).toBeTruthy();

      errorState.unmount();

      expect(container.querySelector('.error-state')).toBeFalsy();
    });
  });
});
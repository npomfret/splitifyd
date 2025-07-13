import { ButtonComponent } from './button';

describe('ButtonComponent', () => {
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
      const button = new ButtonComponent({});
      button.mount(container);

      const element = container.querySelector('button');
      expect(element).toBeTruthy();
      expect(element?.type).toBe('button');
      expect(element?.className).toBe('button button--primary');
      expect(element?.disabled).toBe(false);
    });

    it('should render with text', () => {
      const button = new ButtonComponent({
        text: 'Click me'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.textContent).toBe('Click me');
    });

    it('should render with different button types', () => {
      const submitButton = new ButtonComponent({ type: 'submit' });
      submitButton.mount(container);
      expect(container.querySelector('button')?.type).toBe('submit');

      container.innerHTML = '';
      const resetButton = new ButtonComponent({ type: 'reset' });
      resetButton.mount(container);
      expect(container.querySelector('button')?.type).toBe('reset');
    });

    it('should render with custom id', () => {
      const button = new ButtonComponent({
        id: 'custom-button-id'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.id).toBe('custom-button-id');
    });

    it('should render with title attribute', () => {
      const button = new ButtonComponent({
        title: 'Button tooltip'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.title).toBe('Button tooltip');
    });
  });

  describe('Button Variants', () => {
    it.each([
      'primary', 'secondary', 'danger', 'success', 'link', 'logout', 'icon'
    ])('should apply %s variant class', (variant) => {
      const button = new ButtonComponent({
        variant: variant as any
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).toContain(`button--${variant}`);
    });
  });

  describe('Button Sizes', () => {
    it('should apply small size class', () => {
      const button = new ButtonComponent({
        size: 'small'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).toContain('button--small');
    });

    it('should apply large size class', () => {
      const button = new ButtonComponent({
        size: 'large'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).toContain('button--large');
    });

    it('should not add size class for medium (default)', () => {
      const button = new ButtonComponent({
        size: 'medium'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).not.toContain('button--medium');
    });
  });

  describe('Disabled State', () => {
    it('should render disabled button', () => {
      const button = new ButtonComponent({
        disabled: true
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.disabled).toBe(true);
      expect(element?.className).toContain('button--disabled');
    });

    it('should allow changing disabled state', () => {
      const button = new ButtonComponent({});
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.disabled).toBe(false);

      button.setDisabled(true);
      expect(element?.disabled).toBe(true);
      expect(element?.className).toContain('button--disabled');

      button.setDisabled(false);
      expect(element?.disabled).toBe(false);
      expect(element?.className).not.toContain('button--disabled');
    });
  });

  describe('Loading State', () => {
    it('should render loading button', () => {
      const button = new ButtonComponent({
        loading: true,
        text: 'Loading...'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.disabled).toBe(true);
      expect(element?.className).toContain('button--loading');
      expect(element?.getAttribute('aria-busy')).toBe('true');

      const spinner = element?.querySelector('i.fas.fa-spinner.fa-spin');
      expect(spinner).toBeTruthy();
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should allow changing loading state', () => {
      const button = new ButtonComponent({
        text: 'Submit'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.disabled).toBe(false);
      expect(element?.getAttribute('aria-busy')).toBeFalsy();

      button.setLoading(true);
      expect(element?.disabled).toBe(true);
      expect(element?.className).toContain('button--loading');
      expect(element?.getAttribute('aria-busy')).toBe('true');
      expect(element?.querySelector('.fa-spinner')).toBeTruthy();

      button.setLoading(false);
      expect(element?.disabled).toBe(false);
      expect(element?.className).not.toContain('button--loading');
      expect(element?.getAttribute('aria-busy')).toBeFalsy();
      expect(element?.querySelector('.fa-spinner')).toBeFalsy();
    });

    it('should remain disabled when loading is disabled but disabled state is true', () => {
      const button = new ButtonComponent({
        disabled: true
      });
      button.mount(container);

      button.setLoading(true);
      button.setLoading(false);

      const element = container.querySelector('button');
      expect(element?.disabled).toBe(true);
    });
  });

  describe('Icon Support', () => {
    it('should render icon with text (left position)', () => {
      const button = new ButtonComponent({
        text: 'Save',
        icon: 'fas fa-save',
        iconPosition: 'left'
      });
      button.mount(container);

      const element = container.querySelector('button');
      const icon = element?.querySelector('i.fas.fa-save');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(element?.textContent).toContain('Save');
    });

    it('should render icon with text (right position)', () => {
      const button = new ButtonComponent({
        text: 'Next',
        icon: 'fas fa-arrow-right',
        iconPosition: 'right'
      });
      button.mount(container);

      const element = container.querySelector('button');
      const icon = element?.querySelector('i.fas.fa-arrow-right');
      expect(icon).toBeTruthy();
      expect(element?.textContent).toContain('Next');
    });

    it('should render icon-only button with iconOnly=true', () => {
      const button = new ButtonComponent({
        text: 'Close',
        icon: 'fas fa-times',
        iconOnly: true,
        ariaLabel: 'Close dialog'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).toContain('button--icon');
      expect(element?.textContent?.trim()).toBe('');
      expect(element?.querySelector('i.fas.fa-times')).toBeTruthy();
      expect(element?.getAttribute('aria-label')).toBe('Close dialog');
    });

    it('should render icon-only button when no text provided', () => {
      const button = new ButtonComponent({
        icon: 'fas fa-edit'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.className).toContain('button--icon');
      expect(element?.querySelector('i.fas.fa-edit')).toBeTruthy();
    });

    it('should auto-add aria-label for icon-only when text is provided', () => {
      const button = new ButtonComponent({
        text: 'Edit item',
        icon: 'fas fa-edit',
        iconOnly: true
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.getAttribute('aria-label')).toBe('Edit item');
    });

    it('should allow changing icon', () => {
      const button = new ButtonComponent({
        icon: 'fas fa-save'
      });
      button.mount(container);

      let element = container.querySelector('button');
      expect(element?.querySelector('i.fas.fa-save')).toBeTruthy();

      button.setIcon('fas fa-edit');
      element = container.querySelector('button');
      expect(element?.querySelector('i.fas.fa-edit')).toBeTruthy();
      expect(element?.querySelector('i.fas.fa-save')).toBeFalsy();
    });
  });

  describe('Text Updates', () => {
    it('should allow changing text', () => {
      const button = new ButtonComponent({
        text: 'Original'
      });
      button.mount(container);

      let element = container.querySelector('button');
      expect(element?.textContent).toBe('Original');

      button.setText('Updated');
      element = container.querySelector('button');
      expect(element?.textContent).toBe('Updated');
    });

    it('should update button classes when text changes affect icon-only state', () => {
      const button = new ButtonComponent({
        icon: 'fas fa-save'
      });
      button.mount(container);

      let element = container.querySelector('button');
      expect(element?.className).toContain('button--icon');

      button.setText('Save');
      element = container.querySelector('button');
      expect(element?.className).not.toContain('button--icon');
      expect(element?.textContent).toContain('Save');
    });
  });

  describe('Variant Updates', () => {
    it('should allow changing variant', () => {
      const button = new ButtonComponent({
        variant: 'primary'
      });
      button.mount(container);

      let element = container.querySelector('button');
      expect(element?.className).toContain('button--primary');

      button.setVariant('danger');
      element = container.querySelector('button');
      expect(element?.className).toContain('button--danger');
      expect(element?.className).not.toContain('button--primary');
    });
  });

  describe('Accessibility', () => {
    it('should set aria-label when provided', () => {
      const button = new ButtonComponent({
        ariaLabel: 'Custom aria label'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.getAttribute('aria-label')).toBe('Custom aria label');
    });

    it('should set aria-describedby when provided', () => {
      const button = new ButtonComponent({
        ariaDescribedBy: 'help-text-id'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.getAttribute('aria-describedby')).toBe('help-text-id');
    });

    it('should set aria-busy when loading', () => {
      const button = new ButtonComponent({
        loading: true
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(element?.getAttribute('aria-busy')).toBe('true');
    });

    it('should ensure icons have aria-hidden', () => {
      const button = new ButtonComponent({
        icon: 'fas fa-save',
        text: 'Save'
      });
      button.mount(container);

      const icon = container.querySelector('i');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Click Events', () => {
    it('should call onClick handler when clicked', () => {
      const onClick = jest.fn();
      const button = new ButtonComponent({
        text: 'Click me',
        onClick
      });
      button.mount(container);

      const element = container.querySelector('button');
      element?.click();

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should not set up event listener when onClick is not provided', () => {
      const button = new ButtonComponent({
        text: 'No handler'
      });
      button.mount(container);

      const element = container.querySelector('button');
      expect(() => element?.click()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      const onClick = jest.fn();
      const button = new ButtonComponent({
        text: 'Click me',
        onClick
      });
      button.mount(container);

      const element = container.querySelector('button');
      element?.click();
      expect(onClick).toHaveBeenCalledTimes(1);

      button.unmount();

      element?.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not error when cleaning up without onClick handler', () => {
      const button = new ButtonComponent({
        text: 'No handler'
      });
      button.mount(container);

      expect(() => button.unmount()).not.toThrow();
    });
  });
});
import { FormHelpTextComponent } from './form-help-text';

describe('FormHelpTextComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Basic Rendering', () => {
    it('should render with required configuration', () => {
      const helpText = new FormHelpTextComponent({
        id: 'test-help',
        text: 'This is help text'
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help');
      expect(element).toBeTruthy();
      expect(element?.id).toBe('test-help');
      expect(element?.className).toBe('form-help');

      const textSpan = element?.querySelector('.form-help__text');
      expect(textSpan?.textContent).toBe('This is help text');
    });

    it('should render with default type', () => {
      const helpText = new FormHelpTextComponent({
        id: 'default-help',
        text: 'Default help text'
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help');
      expect(element?.className).toBe('form-help');
    });

    it('should render with specific type classes', () => {
      const types = ['info', 'success', 'warning'] as const;
      
      types.forEach(type => {
        const tempContainer = document.createElement('div');
        document.body.appendChild(tempContainer);
        
        const helpText = new FormHelpTextComponent({
          id: `${type}-help`,
          text: `${type} help text`,
          type
        });
        helpText.mount(tempContainer);

        const element = tempContainer.querySelector('.form-help');
        expect(element?.className).toBe(`form-help form-help--${type}`);
        
        document.body.removeChild(tempContainer);
      });
    });

    it('should render hidden when visible is false', () => {
      const helpText = new FormHelpTextComponent({
        id: 'hidden-help',
        text: 'Hidden help text',
        visible: false
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help') as HTMLElement;
      expect((element as HTMLElement)?.style.display).toBe('none');
    });
  });

  describe('Icon Support', () => {
    it('should render without icon by default', () => {
      const helpText = new FormHelpTextComponent({
        id: 'no-icon-help',
        text: 'No icon help text'
      });
      helpText.mount(container);

      const icon = container.querySelector('.form-help__icon');
      expect(icon).toBeFalsy();
    });

    it('should render with icon when specified', () => {
      const helpText = new FormHelpTextComponent({
        id: 'icon-help',
        text: 'Icon help text',
        icon: true
      });
      helpText.mount(container);

      const icon = container.querySelector('.form-help__icon');
      expect(icon).toBeTruthy();
      expect(icon?.className).toContain('fas');
      expect(icon?.className).toContain('fa-info-circle');
    });

    it('should render correct icons for different types', () => {
      const iconTests = [
        { type: 'default' as const, expectedIcon: 'fa-info-circle' },
        { type: 'info' as const, expectedIcon: 'fa-info-circle' },
        { type: 'success' as const, expectedIcon: 'fa-check-circle' },
        { type: 'warning' as const, expectedIcon: 'fa-exclamation-triangle' }
      ];

      iconTests.forEach(({ type, expectedIcon }) => {
        const tempContainer = document.createElement('div');
        document.body.appendChild(tempContainer);
        
        const helpText = new FormHelpTextComponent({
          id: `${type}-icon-help`,
          text: `${type} help text`,
          type,
          icon: true
        });
        helpText.mount(tempContainer);

        const icon = tempContainer.querySelector('.form-help__icon');
        expect(icon?.className).toContain(expectedIcon);
        
        document.body.removeChild(tempContainer);
      });
    });
  });

  describe('Text Updates', () => {
    it('should update text content', () => {
      const helpText = new FormHelpTextComponent({
        id: 'update-text-help',
        text: 'Original text'
      });
      helpText.mount(container);

      const textSpan = container.querySelector('.form-help__text');
      expect(textSpan?.textContent).toBe('Original text');

      helpText.setText('Updated text');
      expect(textSpan?.textContent).toBe('Updated text');
    });

    it('should handle setText when not mounted', () => {
      const helpText = new FormHelpTextComponent({
        id: 'unmounted-help',
        text: 'Original text'
      });

      expect(() => {
        helpText.setText('New text');
      }).not.toThrow();
    });
  });

  describe('Type Updates', () => {
    it('should update type class', () => {
      const helpText = new FormHelpTextComponent({
        id: 'update-type-help',
        text: 'Type update help',
        type: 'default'
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help');
      expect(element?.className).toBe('form-help');

      helpText.setType('warning');
      expect(element?.className).toBe('form-help form-help--warning');

      helpText.setType('default');
      expect(element?.className).toBe('form-help');
    });

    it('should update icon when type changes and icon is enabled', () => {
      const helpText = new FormHelpTextComponent({
        id: 'update-icon-help',
        text: 'Icon update help',
        type: 'info',
        icon: true
      });
      helpText.mount(container);

      let icon = container.querySelector('.form-help__icon');
      expect(icon?.className).toContain('fa-info-circle');

      helpText.setType('warning');
      icon = container.querySelector('.form-help__icon');
      expect(icon?.className).toContain('fa-exclamation-triangle');

      helpText.setType('success');
      icon = container.querySelector('.form-help__icon');
      expect(icon?.className).toContain('fa-check-circle');
    });

    it('should not affect icons when icon is disabled', () => {
      const helpText = new FormHelpTextComponent({
        id: 'no-icon-update-help',
        text: 'No icon update help',
        type: 'info',
        icon: false
      });
      helpText.mount(container);

      expect(container.querySelector('.form-help__icon')).toBeFalsy();

      helpText.setType('warning');
      expect(container.querySelector('.form-help__icon')).toBeFalsy();
    });

    it('should handle setType when not mounted', () => {
      const helpText = new FormHelpTextComponent({
        id: 'unmounted-type-help',
        text: 'Unmounted type help'
      });

      expect(() => {
        helpText.setType('warning');
      }).not.toThrow();
    });
  });

  describe('Visibility Controls', () => {
    it('should show help text', () => {
      const helpText = new FormHelpTextComponent({
        id: 'show-help',
        text: 'Show help text',
        visible: false
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help') as HTMLElement;
      expect((element as HTMLElement)?.style.display).toBe('none');

      helpText.show();
      expect((element as HTMLElement)?.style.display).toBe('block');
    });

    it('should hide help text', () => {
      const helpText = new FormHelpTextComponent({
        id: 'hide-help',
        text: 'Hide help text',
        visible: true
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help') as HTMLElement;
      expect((element as HTMLElement)?.style.display).not.toBe('none');

      helpText.hide();
      expect((element as HTMLElement)?.style.display).toBe('none');
    });

    it('should toggle visibility', () => {
      const helpText = new FormHelpTextComponent({
        id: 'toggle-help',
        text: 'Toggle help text',
        visible: true
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help') as HTMLElement;

      helpText.toggle();
      expect((element as HTMLElement)?.style.display).toBe('none');

      helpText.toggle();
      expect((element as HTMLElement)?.style.display).toBe('block');
    });

    it('should handle visibility methods when not mounted', () => {
      const helpText = new FormHelpTextComponent({
        id: 'unmounted-visibility-help',
        text: 'Unmounted visibility help'
      });

      expect(() => {
        helpText.show();
        helpText.hide();
        helpText.toggle();
      }).not.toThrow();
    });
  });

  describe('Icon Positioning', () => {
    it('should position icon before text', () => {
      const helpText = new FormHelpTextComponent({
        id: 'icon-position-help',
        text: 'Icon position help',
        icon: true
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help');
      const children = Array.from(element?.children || []);
      
      expect(children[0]?.classList.contains('form-help__icon')).toBe(true);
      expect(children[1]?.classList.contains('form-help__text')).toBe(true);
    });

    it('should maintain icon position when type is updated', () => {
      const helpText = new FormHelpTextComponent({
        id: 'icon-type-position-help',
        text: 'Icon type position help',
        type: 'info',
        icon: true
      });
      helpText.mount(container);

      helpText.setType('warning');

      const element = container.querySelector('.form-help');
      const children = Array.from(element?.children || []);
      
      expect(children[0]?.classList.contains('form-help__icon')).toBe(true);
      expect(children[1]?.classList.contains('form-help__text')).toBe(true);
    });
  });

  describe('Configuration Defaults', () => {
    it('should apply default configuration values', () => {
      const helpText = new FormHelpTextComponent({
        id: 'defaults-help',
        text: 'Defaults help text'
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help');
      expect(element?.classList.contains('form-help--info')).toBe(false);
      expect(element?.classList.contains('form-help--warning')).toBe(false);
      expect(element?.classList.contains('form-help--success')).toBe(false);
      expect(element?.querySelector('.form-help__icon')).toBeFalsy();
      expect((element as HTMLElement)?.style.display).not.toBe('none');
    });

    it('should override defaults with provided values', () => {
      const helpText = new FormHelpTextComponent({
        id: 'override-help',
        text: 'Override help text',
        type: 'warning',
        icon: true,
        visible: false
      });
      helpText.mount(container);

      const element = container.querySelector('.form-help') as HTMLElement;
      expect(element?.classList.contains('form-help--warning')).toBe(true);
      expect(element?.querySelector('.form-help__icon')).toBeTruthy();
      expect((element as HTMLElement)?.style.display).toBe('none');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const helpText = new FormHelpTextComponent({
        id: 'cleanup-help',
        text: 'Cleanup help text'
      });
      helpText.mount(container);

      expect(container.querySelector('.form-help')).toBeTruthy();

      helpText.unmount();

      expect(container.querySelector('.form-help')).toBeFalsy();
    });
  });
});
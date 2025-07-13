import { CheckboxComponent } from './checkbox';

describe('CheckboxComponent', () => {
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
      const checkbox = new CheckboxComponent({
        id: 'test-checkbox',
        name: 'test',
        label: 'Test Checkbox'
      });
      checkbox.mount(container);

      const wrapper = container.querySelector('.form-checkbox-wrapper');
      expect(wrapper).toBeTruthy();
      expect(wrapper?.id).toContain('checkbox-test-checkbox-');

      const checkboxDiv = wrapper?.querySelector('.form-checkbox');
      expect(checkboxDiv).toBeTruthy();

      const input = checkboxDiv?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.id).toBe('test-checkbox');
      expect(input.name).toBe('test');
      expect(input.checked).toBe(false);

      const label = checkboxDiv?.querySelector('label') as HTMLLabelElement;
      expect(label).toBeTruthy();
      expect(label.htmlFor).toBe('test-checkbox');
      expect(label.textContent).toBe('Test Checkbox');
      expect(label.className).toBe('checkbox-label');

      const errorDiv = wrapper?.querySelector('.form-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv?.getAttribute('role')).toBe('alert');
      expect(errorDiv?.id).toBe('test-checkbox-error');
    });

    it('should render with value attribute', () => {
      const checkbox = new CheckboxComponent({
        id: 'valued-checkbox',
        name: 'valued',
        label: 'Valued Checkbox',
        value: 'checkbox-value'
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('checkbox-value');
    });

    it('should render checked when specified', () => {
      const checkbox = new CheckboxComponent({
        id: 'checked-checkbox',
        name: 'checked',
        label: 'Checked Checkbox',
        checked: true
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.checked).toBe(true);
    });

    it('should render disabled when specified', () => {
      const checkbox = new CheckboxComponent({
        id: 'disabled-checkbox',
        name: 'disabled',
        label: 'Disabled Checkbox',
        disabled: true
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should render as required when specified', () => {
      const checkbox = new CheckboxComponent({
        id: 'required-checkbox',
        name: 'required',
        label: 'Required Checkbox',
        required: true
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.required).toBe(true);

      const label = container.querySelector('label');
      const requiredSpan = label?.querySelector('.form-label__required');
      expect(requiredSpan).toBeTruthy();
      expect(requiredSpan?.textContent).toBe('*');
      expect(requiredSpan?.getAttribute('aria-label')).toBe('required');
    });
  });

  describe('Label Rendering', () => {
    it('should render label as text content by default', () => {
      const checkbox = new CheckboxComponent({
        id: 'text-label',
        name: 'text',
        label: 'Text <strong>Label</strong>'
      });
      checkbox.mount(container);

      const label = container.querySelector('label');
      expect(label?.textContent).toBe('Text <strong>Label</strong>');
      expect(label?.innerHTML).not.toContain('<strong>');
    });

    it('should render label as HTML when labelHtml is true', () => {
      const checkbox = new CheckboxComponent({
        id: 'html-label',
        name: 'html',
        label: 'HTML <strong>Label</strong>',
        labelHtml: true
      });
      checkbox.mount(container);

      const label = container.querySelector('label');
      expect(label?.innerHTML).toContain('<strong>Label</strong>');
      expect(label?.querySelector('strong')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should set aria-describedby for error association', () => {
      const checkbox = new CheckboxComponent({
        id: 'accessible-checkbox',
        name: 'accessible',
        label: 'Accessible Checkbox'
      });
      checkbox.mount(container);

      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-describedby')).toBe('accessible-checkbox-error');
    });

    it('should set aria-invalid when error is shown', () => {
      const checkbox = new CheckboxComponent({
        id: 'error-checkbox',
        name: 'error',
        label: 'Error Checkbox'
      });
      checkbox.mount(container);

      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBeFalsy();

      checkbox.showError('This field is required');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
    });

    it('should remove aria-invalid when error is hidden', () => {
      const checkbox = new CheckboxComponent({
        id: 'hide-error-checkbox',
        name: 'hideError',
        label: 'Hide Error Checkbox'
      });
      checkbox.mount(container);

      checkbox.showError('Error message');
      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBe('true');

      checkbox.hideError();
      expect(input?.getAttribute('aria-invalid')).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should show error message on initialization', () => {
      const checkbox = new CheckboxComponent({
        id: 'init-error-checkbox',
        name: 'initError',
        label: 'Init Error Checkbox',
        errorMessage: 'Initial error message'
      });
      checkbox.mount(container);

      const errorDiv = container.querySelector('.form-error') as HTMLElement;
      expect(errorDiv?.textContent).toBe('Initial error message');
      expect(errorDiv?.style.display).toBe('block');
    });

    it('should show error message when called', () => {
      const checkbox = new CheckboxComponent({
        id: 'show-error-checkbox',
        name: 'showError',
        label: 'Show Error Checkbox'
      });
      checkbox.mount(container);

      const errorDiv = container.querySelector('.form-error');
      expect(errorDiv?.textContent).toBe('');

      checkbox.showError('Validation failed');
      expect(errorDiv?.textContent).toBe('Validation failed');
      expect((errorDiv as HTMLElement)?.style.display).toBe('block');
    });

    it('should hide error message when called', () => {
      const checkbox = new CheckboxComponent({
        id: 'hide-error-checkbox',
        name: 'hideError',
        label: 'Hide Error Checkbox'
      });
      checkbox.mount(container);

      checkbox.showError('Error to hide');
      const errorDiv = container.querySelector('.form-error') as HTMLElement;
      expect(errorDiv?.style.display).toBe('block');

      checkbox.hideError();
      expect(errorDiv?.textContent).toBe('');
      expect(errorDiv?.style.display).toBe('none');
    });
  });

  describe('State Management', () => {
    it('should get checked state', () => {
      const checkbox = new CheckboxComponent({
        id: 'state-checkbox',
        name: 'state',
        label: 'State Checkbox',
        checked: true
      });
      checkbox.mount(container);

      expect(checkbox.isChecked()).toBe(true);
      expect(checkbox.getValue()).toBe(true);
    });

    it('should set checked state', () => {
      const checkbox = new CheckboxComponent({
        id: 'set-state-checkbox',
        name: 'setState',
        label: 'Set State Checkbox'
      });
      checkbox.mount(container);

      expect(checkbox.isChecked()).toBe(false);

      checkbox.setChecked(true);
      expect(checkbox.isChecked()).toBe(true);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.checked).toBe(true);
    });

    it('should set disabled state', () => {
      const checkbox = new CheckboxComponent({
        id: 'disable-checkbox',
        name: 'disable',
        label: 'Disable Checkbox'
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(false);

      checkbox.setDisabled(true);
      expect(input.disabled).toBe(true);

      checkbox.setDisabled(false);
      expect(input.disabled).toBe(false);
    });

    it('should return false for isChecked when not mounted', () => {
      const checkbox = new CheckboxComponent({
        id: 'unmounted-checkbox',
        name: 'unmounted',
        label: 'Unmounted Checkbox'
      });

      expect(checkbox.isChecked()).toBe(false);
      expect(checkbox.getValue()).toBe(false);
    });
  });

  describe('Change Events', () => {
    it('should call onChange when checkbox state changes', () => {
      const onChange = jest.fn();
      const checkbox = new CheckboxComponent({
        id: 'change-checkbox',
        name: 'change',
        label: 'Change Checkbox',
        onChange
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(true);

      input.checked = false;
      input.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(false);

      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('should not error when onChange is not provided', () => {
      const checkbox = new CheckboxComponent({
        id: 'no-change-checkbox',
        name: 'noChange',
        label: 'No Change Checkbox'
      });
      checkbox.mount(container);

      const input = container.querySelector('input') as HTMLInputElement;
      
      expect(() => {
        input.checked = true;
        input.dispatchEvent(new Event('change'));
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle methods when not mounted gracefully', () => {
      const checkbox = new CheckboxComponent({
        id: 'not-mounted',
        name: 'notMounted',
        label: 'Not Mounted Checkbox'
      });

      expect(() => {
        checkbox.setChecked(true);
        checkbox.setDisabled(true);
        checkbox.showError('Error');
        checkbox.hideError();
      }).not.toThrow();
    });

    it('should generate unique component IDs', () => {
      const checkbox1 = new CheckboxComponent({
        id: 'same-id',
        name: 'same',
        label: 'Same ID 1'
      });
      checkbox1.mount(container);

      const checkbox2 = new CheckboxComponent({
        id: 'same-id',
        name: 'same',
        label: 'Same ID 2'
      });
      
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);
      checkbox2.mount(tempContainer);

      const wrapper1 = container.querySelector('.form-checkbox-wrapper');
      const wrapper2 = tempContainer.querySelector('.form-checkbox-wrapper');

      expect(wrapper1?.id).not.toBe(wrapper2?.id);
      expect(wrapper1?.id).toContain('checkbox-same-id-');
      expect(wrapper2?.id).toContain('checkbox-same-id-');

      document.body.removeChild(tempContainer);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const onChange = jest.fn();
      const checkbox = new CheckboxComponent({
        id: 'cleanup-checkbox',
        name: 'cleanup',
        label: 'Cleanup Checkbox',
        onChange
      });
      checkbox.mount(container);

      expect(container.querySelector('.form-checkbox-wrapper')).toBeTruthy();

      checkbox.unmount();

      expect(container.querySelector('.form-checkbox-wrapper')).toBeFalsy();
    });
  });
});
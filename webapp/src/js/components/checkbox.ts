import { BaseComponent } from './base-component.js';

interface CheckboxConfig {
  id: string;
  name: string;
  label: string;
  checked?: boolean;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  labelHtml?: boolean;
  errorMessage?: string;
  onChange?: (checked: boolean) => void;
}

export class CheckboxComponent extends BaseComponent<HTMLDivElement> {
  private config: CheckboxConfig;
  private inputElement: HTMLInputElement | null = null;
  private errorElement: HTMLDivElement | null = null;
  private componentId: string;

  constructor(config: CheckboxConfig) {
    super();
    this.config = config;
    this.componentId = `checkbox-${config.id}-${Date.now()}`;
  }

  protected render(): HTMLDivElement {
    const { id, name, label, checked = false, required = false, disabled = false, value = '', labelHtml = false } = this.config;
    const errorElementId = `${id}-error`;

    const wrapper = document.createElement('div');
    wrapper.className = 'form-checkbox-wrapper';
    wrapper.id = this.componentId;

    const checkboxDiv = document.createElement('div');
    checkboxDiv.className = 'form-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.name = name;
    if (value) input.value = value;
    if (checked) input.checked = checked;
    if (required) input.required = required;
    if (disabled) input.disabled = disabled;
    input.setAttribute('aria-describedby', errorElementId);

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.className = 'checkbox-label';
    
    if (labelHtml) {
      labelEl.innerHTML = label;
    } else {
      labelEl.textContent = label;
    }
    
    if (required) {
      const requiredSpan = document.createElement('span');
      requiredSpan.className = 'form-label__required';
      requiredSpan.setAttribute('aria-label', 'required');
      requiredSpan.textContent = '*';
      labelEl.appendChild(document.createTextNode(' '));
      labelEl.appendChild(requiredSpan);
    }

    const errorDiv = document.createElement('div');
    errorDiv.id = errorElementId;
    errorDiv.className = 'form-error';
    errorDiv.setAttribute('role', 'alert');

    checkboxDiv.appendChild(input);
    checkboxDiv.appendChild(labelEl);
    wrapper.appendChild(checkboxDiv);
    wrapper.appendChild(errorDiv);

    return wrapper;
  }

  protected setupEventListeners(): void {
    if (!this.element) return;
    
    this.inputElement = this.element.querySelector(`#${this.config.id}`);
    this.errorElement = this.element.querySelector(`#${this.config.id}-error`);

    if (this.inputElement && this.config.onChange) {
      this.inputElement.addEventListener('change', () => {
        if (this.inputElement) {
          this.config.onChange!(this.inputElement.checked);
        }
      });
    }

    if (this.config.errorMessage) {
      this.showError(this.config.errorMessage);
    }
  }

  isChecked(): boolean {
    return this.inputElement?.checked || false;
  }

  setChecked(checked: boolean): void {
    if (this.inputElement) {
      this.inputElement.checked = checked;
    }
  }

  setDisabled(disabled: boolean): void {
    if (this.inputElement) {
      this.inputElement.disabled = disabled;
    }
  }

  showError(message: string): void {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.style.display = 'block';
      
      if (this.inputElement) {
        this.inputElement.setAttribute('aria-invalid', 'true');
      }
    }
  }

  hideError(): void {
    if (this.errorElement) {
      this.errorElement.textContent = '';
      this.errorElement.style.display = 'none';
      
      if (this.inputElement) {
        this.inputElement.removeAttribute('aria-invalid');
      }
    }
  }

  getValue(): boolean {
    return this.isChecked();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
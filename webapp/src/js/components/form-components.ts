import type { FormFieldConfig, FormActionButton } from '../types/business-logic.js';
import { hideElement, showElement } from '../utils/ui-visibility.js';

export class FormComponents {
  static formGroup(config: FormFieldConfig): string {
    const { 
      label, 
      id, 
      type = 'text', 
      value = '', 
      required = false, 
      placeholder = '',
      options = null,
      step = null,
      readonly = false,
      errorId = null
    } = config;

    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
    const errorElementId = errorId || `${inputId}Error`;

    if (type === 'select' && options) {
      return `
        <div class="form-group">
          <label for="${inputId}">${label}${required ? ' <span class="required">*</span>' : ''}</label>
          <select id="${inputId}" ${required ? 'required' : ''} ${readonly ? 'disabled' : ''}>
            ${options.map(opt => {
              if (typeof opt === 'object') {
                return `<option value="${opt.value}"${value === opt.value ? ' selected' : ''}>${opt.label}</option>`;
              }
              return `<option value="${opt}"${value === opt ? ' selected' : ''}>${opt}</option>`;
            }).join('')}
          </select>
          <div class="error-message" id="${errorElementId}"></div>
        </div>
      `;
    }

    if (type === 'textarea') {
      return `
        <div class="form-group">
          <label for="${inputId}">${label}${required ? ' <span class="required">*</span>' : ''}</label>
          <textarea id="${inputId}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} placeholder="${placeholder}">${value}</textarea>
          <div class="error-message" id="${errorElementId}"></div>
        </div>
      `;
    }

    return `
      <div class="form-group">
        <label for="${inputId}">${label}${required ? ' <span class="required">*</span>' : ''}</label>
        <input type="${type}" id="${inputId}" value="${value}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} placeholder="${placeholder}" ${step ? `step="${step}"` : ''}>
        <div class="error-message" id="${errorElementId}"></div>
      </div>
    `;
  }

  static submitButton(config: FormActionButton = { text: 'Submit' }): string {
    const { text = 'Submit', id = 'submitBtn', disabled = false } = config;
    return `
      <button type="submit" class="button button--primary" id="${id}" ${disabled ? 'disabled' : ''}>
        ${text}
      </button>
    `;
  }

  static formActions(buttons: string[] = []): string {
    return `
      <div class="form-actions">
        ${buttons.join('')}
      </div>
    `;
  }

  static showError(elementId: string, message: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      showElement(element);
    }
  }

  static hideError(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = '';
      hideElement(element);
    }
  }

  static clearAllErrors(formId: string): void {
    const form = document.getElementById(formId);
    if (form) {
      const errorElements = form.querySelectorAll('.error-message');
      errorElements.forEach(el => {
        el.textContent = '';
        hideElement(el as HTMLElement);
      });
    }
  }

  static getFormData(formId: string): Record<string, any> {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return {};

    const formData: Record<string, any> = {};
    const inputs = form.querySelectorAll('input, select, textarea') as NodeListOf<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
    
    inputs.forEach(input => {
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        formData[input.id] = input.checked;
      } else if (input instanceof HTMLInputElement && input.type === 'number') {
        formData[input.id] = input.value ? parseFloat(input.value) : null;
      } else {
        formData[input.id] = input.value;
      }
    });

    return formData;
  }

  static setFormData(formId: string, data: Record<string, any>): void {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;

    Object.entries(data).forEach(([key, value]) => {
      const input = form.querySelector(`#${key}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (input) {
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          input.checked = !!value;
        } else {
          input.value = value || '';
        }
      }
    });
  }
}
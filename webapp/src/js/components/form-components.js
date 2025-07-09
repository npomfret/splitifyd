export class FormComponents {
  static formGroup({ 
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
  }) {
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

  static submitButton({ text = 'Submit', id = 'submitBtn', disabled = false }) {
    return `
      <button type="submit" class="button button--primary" id="${id}" ${disabled ? 'disabled' : ''}>
        ${text}
      </button>
    `;
  }

  static formActions(buttons = []) {
    return `
      <div class="form-actions">
        ${buttons.join('')}
      </div>
    `;
  }

  static showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      element.classList.remove('hidden');
    }
  }

  static hideError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = '';
      element.classList.add('hidden');
    }
  }

  static clearAllErrors(formId) {
    const form = document.getElementById(formId);
    if (form) {
      const errorElements = form.querySelectorAll('.error-message');
      errorElements.forEach(el => {
        el.textContent = '';
        el.classList.add('hidden');
      });
    }
  }

  static getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        formData[input.id] = input.checked;
      } else if (input.type === 'number') {
        formData[input.id] = input.value ? parseFloat(input.value) : null;
      } else {
        formData[input.id] = input.value;
      }
    });

    return formData;
  }

  static setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;

    Object.entries(data).forEach(([key, value]) => {
      const input = form.querySelector(`#${key}`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = !!value;
        } else {
          input.value = value || '';
        }
      }
    });
  }
}
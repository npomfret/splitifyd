/**
 * UI Builder Module
 * 
 * Provides standardized functions for creating UI elements programmatically.
 * Ensures consistent styling and behavior across the application.
 */

export interface ButtonOptions {
  text?: string;
  html?: string; // For buttons with HTML content (e.g., icons)
  variant?: 'primary' | 'secondary' | 'danger' | 'logout' | 'icon';
  size?: 'large' | 'small';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  ariaDescribedBy?: string;
  ariaLabel?: string; // For accessibility when using HTML/icons
  className?: string; // Additional custom classes
}

export interface FormFieldOptions {
  label: string;
  id: string;
  name: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'tel';
  required?: boolean;
  placeholder?: string;
  value?: string;
  className?: string;
  error?: string;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  ariaDescribedBy?: string;
}

export interface SelectFieldOptions {
  label: string;
  id: string;
  name: string;
  required?: boolean;
  options: Array<{ value: string; text: string }>;
  value?: string;
  className?: string;
  error?: string;
  placeholder?: string;
  ariaDescribedBy?: string;
}

export interface CardOptions {
  className?: string;
  children?: HTMLElement[];
  padding?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Creates a standardized button element with consistent styling and behavior.
 * 
 * @param options - Button configuration options
 * @returns HTMLButtonElement with applied styles and event listeners
 * 
 * @example
 * ```typescript
 * import { createButton } from './ui-builders.js';
 * 
 * const saveButton = createButton({
 *   text: 'Save',
 *   variant: 'primary',
 *   size: 'large',
 *   onClick: handleSave
 * });
 * container.appendChild(saveButton);
 * ```
 */
export function createButton(options: ButtonOptions): HTMLButtonElement {
  const {
    text,
    html,
    variant = 'primary',
    size,
    type = 'button',
    onClick,
    disabled = false,
    ariaDescribedBy,
    ariaLabel,
    className
  } = options;

  if (!text && !html) {
    throw new Error('createButton requires either text or html content');
  }

  const button = document.createElement('button');
  
  // Set button attributes
  button.type = type;
  button.disabled = disabled;
  
  // Set content (text or HTML)
  if (html) {
    button.innerHTML = html;
  } else if (text) {
    button.textContent = text;
  }
  
  // Build CSS classes using BEM convention
  const classes = ['button'];
  
  // Add variant class
  if (variant) {
    classes.push(`button--${variant}`);
  }
  
  // Add size class
  if (size) {
    classes.push(`button--${size}`);
  }
  
  // Add any additional custom classes
  if (className) {
    classes.push(className);
  }
  
  button.className = classes.join(' ');
  
  // Set accessibility attributes
  if (ariaDescribedBy) {
    button.setAttribute('aria-describedby', ariaDescribedBy);
  }
  
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }
  
  // Attach event listener
  if (onClick) {
    button.addEventListener('click', onClick);
  }
  
  return button;
}

/**
 * Creates a form field group with label and input element
 */
export function createFormField(options: FormFieldOptions): HTMLDivElement {
  const {
    label,
    id,
    name,
    type = 'text',
    required = false,
    placeholder,
    value = '',
    className,
    error,
    maxLength,
    min,
    max,
    step,
    ariaDescribedBy
  } = options;

  const formGroup = document.createElement('div');
  formGroup.className = 'form-group';

  // Create label
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.className = 'form-label';
  labelEl.textContent = label;
  
  if (required) {
    const requiredSpan = document.createElement('span');
    requiredSpan.className = 'form-label__required';
    requiredSpan.setAttribute('aria-label', 'required');
    requiredSpan.textContent = '*';
    labelEl.appendChild(requiredSpan);
  }

  // Create input
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.name = name;
  input.className = `form-input${className ? ' ' + className : ''}${error ? ' form-input--error' : ''}`;
  input.required = required;
  
  if (placeholder) input.placeholder = placeholder;
  if (value) input.value = value;
  if (maxLength) input.maxLength = maxLength;
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (step !== undefined) input.step = String(step);
  if (ariaDescribedBy) input.setAttribute('aria-describedby', ariaDescribedBy);

  // Create error div
  const errorDiv = document.createElement('div');
  errorDiv.id = `${id}-error`;
  errorDiv.className = 'form-error';
  errorDiv.setAttribute('role', 'alert');
  if (error) errorDiv.textContent = error;

  // Assemble form group
  formGroup.appendChild(labelEl);
  formGroup.appendChild(input);
  formGroup.appendChild(errorDiv);

  return formGroup;
}

/**
 * Creates a select field group with label and select element
 */
export function createSelectField(options: SelectFieldOptions): HTMLDivElement {
  const {
    label,
    id,
    name,
    required = false,
    options: selectOptions,
    value = '',
    className,
    error,
    placeholder,
    ariaDescribedBy
  } = options;

  const formGroup = document.createElement('div');
  formGroup.className = 'form-group';

  // Create label
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.className = 'form-label';
  labelEl.textContent = label;
  
  if (required) {
    const requiredSpan = document.createElement('span');
    requiredSpan.className = 'form-label__required';
    requiredSpan.setAttribute('aria-label', 'required');
    requiredSpan.textContent = '*';
    labelEl.appendChild(requiredSpan);
  }

  // Create select
  const select = document.createElement('select');
  select.id = id;
  select.name = name;
  select.className = `form-select${className ? ' ' + className : ''}${error ? ' form-select--error' : ''}`;
  select.required = required;
  if (ariaDescribedBy) select.setAttribute('aria-describedby', ariaDescribedBy);

  // Add placeholder option if provided
  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
  }

  // Add options
  selectOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.text;
    select.appendChild(option);
  });

  if (value) select.value = value;

  // Create error div
  const errorDiv = document.createElement('div');
  errorDiv.id = `${id}-error`;
  errorDiv.className = 'form-error';
  errorDiv.setAttribute('role', 'alert');
  if (error) errorDiv.textContent = error;

  // Assemble form group
  formGroup.appendChild(labelEl);
  formGroup.appendChild(select);
  formGroup.appendChild(errorDiv);

  return formGroup;
}

/**
 * Creates a card container with modern styling
 */
export function createCard(options: CardOptions = {}): HTMLDivElement {
  const {
    className,
    children = [],
    padding = 'xl'
  } = options;

  const card = document.createElement('div');
  card.className = `card card--padding-${padding}${className ? ' ' + className : ''}`;

  children.forEach(child => card.appendChild(child));

  return card;
}

/**
 * Creates a form section with title
 */
export function createFormSection(title: string, children: HTMLElement[]): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'form-section';

  const titleEl = document.createElement('h3');
  titleEl.className = 'form-section-title';
  titleEl.textContent = title;

  section.appendChild(titleEl);
  children.forEach(child => section.appendChild(child));

  return section;
}

/**
 * Creates a member item with checkbox for selection
 */
export function createMemberCheckbox(member: { uid: string; name: string }, isCurrentUser: boolean, checked: boolean = true): HTMLDivElement {
  const memberItem = document.createElement('div');
  memberItem.className = 'member-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `member-${member.uid}`;
  checkbox.value = member.uid;
  checkbox.className = 'member-checkbox';
  checkbox.checked = checked;

  const label = document.createElement('label');
  label.htmlFor = `member-${member.uid}`;
  label.className = 'member-label';

  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'member-avatar-container';

  const avatar = document.createElement('div');
  avatar.className = 'member-avatar';
  avatar.textContent = member.name.charAt(0).toUpperCase();

  const name = document.createElement('span');
  name.className = 'member-name';
  name.textContent = isCurrentUser ? 'You' : member.name;

  avatarContainer.appendChild(avatar);
  label.appendChild(checkbox);
  label.appendChild(avatarContainer);
  label.appendChild(name);
  memberItem.appendChild(label);

  return memberItem;
}
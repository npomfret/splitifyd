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

export interface LoadingSpinnerOptions {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ErrorMessageOptions {
  message: string;
  type?: 'inline' | 'form' | 'page';
  className?: string;
  duration?: number; // For auto-dismiss (milliseconds)
}

export interface ModalOptions {
  title: string;
  body: HTMLElement | HTMLElement[];
  footer?: HTMLElement | HTMLElement[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onClose?: () => void;
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

/**
 * Creates a standardized loading spinner element
 * 
 * @param options - Loading spinner configuration options
 * @returns HTMLDivElement containing the loading spinner
 * 
 * @example
 * ```typescript
 * import { createLoadingSpinner } from './ui-builders.js';
 * 
 * const spinner = createLoadingSpinner({
 *   text: 'Loading your groups...',
 *   size: 'lg'
 * });
 * container.appendChild(spinner);
 * ```
 */
export function createLoadingSpinner(options: LoadingSpinnerOptions = {}): HTMLDivElement {
  const {
    text,
    size = 'md',
    className
  } = options;

  const container = document.createElement('div');
  container.className = `loading-state${className ? ' ' + className : ''}`;

  const spinner = document.createElement('div');
  spinner.className = `loading-spinner loading-spinner--${size}`;
  
  // Add Font Awesome spinner icon
  const icon = document.createElement('i');
  icon.className = 'fas fa-spinner fa-spin';
  spinner.appendChild(icon);
  
  container.appendChild(spinner);

  // Add loading text if provided
  if (text) {
    const loadingText = document.createElement('p');
    loadingText.className = 'loading-text';
    loadingText.textContent = text;
    container.appendChild(loadingText);
  }

  return container;
}

/**
 * Creates a standardized error message element
 * 
 * @param options - Error message configuration options
 * @returns HTMLDivElement containing the error message
 * 
 * @example
 * ```typescript
 * import { createErrorMessage } from './ui-builders.js';
 * 
 * const error = createErrorMessage({
 *   message: 'Failed to load data. Please try again.',
 *   type: 'page'
 * });
 * container.appendChild(error);
 * ```
 */
export function createErrorMessage(options: ErrorMessageOptions): HTMLDivElement {
  const {
    message,
    type = 'inline',
    className,
    duration
  } = options;

  const errorContainer = document.createElement('div');
  
  // Build CSS classes based on type
  const classes = [];
  switch (type) {
    case 'form':
      classes.push('form-error', 'form-error--general');
      break;
    case 'page':
      classes.push('error-state');
      break;
    case 'inline':
    default:
      classes.push('error-message');
      break;
  }
  
  if (className) {
    classes.push(className);
  }
  
  errorContainer.className = classes.join(' ');
  errorContainer.setAttribute('role', 'alert');
  
  if (type === 'page') {
    // For page-level errors, add icon and styling
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-circle error-icon';
    
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    
    errorContainer.appendChild(icon);
    errorContainer.appendChild(messageEl);
  } else {
    // For inline and form errors, just set text
    errorContainer.textContent = message;
  }
  
  // Auto-dismiss if duration is specified
  if (duration && duration > 0) {
    setTimeout(() => {
      errorContainer.style.opacity = '0';
      setTimeout(() => errorContainer.remove(), 300);
    }, duration);
  }
  
  return errorContainer;
}

/**
 * Creates a standardized modal dialog
 * 
 * @param options - Modal configuration options
 * @returns HTMLDivElement containing the modal
 * 
 * @example
 * ```typescript
 * import { createModal, createButton } from './ui-builders.js';
 * 
 * const modalBody = document.createElement('p');
 * modalBody.textContent = 'Are you sure you want to proceed?';
 * 
 * const confirmBtn = createButton({
 *   text: 'Confirm',
 *   variant: 'primary',
 *   onClick: handleConfirm
 * });
 * 
 * const modal = createModal({
 *   title: 'Confirm Action',
 *   body: modalBody,
 *   footer: confirmBtn,
 *   onClose: handleClose
 * });
 * 
 * document.body.appendChild(modal);
 * modal.style.display = 'block';
 * ```
 */
export function createModal(options: ModalOptions): HTMLDivElement {
  const {
    title,
    body,
    footer,
    className,
    size = 'md',
    onClose
  } = options;

  const modal = document.createElement('div');
  modal.className = `modal${className ? ' ' + className : ''}`;
  modal.style.display = 'none';
  
  const modalContent = document.createElement('div');
  modalContent.className = `modal-content modal-content--${size}`;
  
  // Create header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';
  
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  modalHeader.appendChild(titleEl);
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close modal');
  closeButton.onclick = () => {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (onClose) onClose();
  };
  modalHeader.appendChild(closeButton);
  
  // Create body
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  
  // Add body content
  if (Array.isArray(body)) {
    body.forEach(element => modalBody.appendChild(element));
  } else {
    modalBody.appendChild(body);
  }
  
  // Create footer if provided
  let modalFooter: HTMLDivElement | null = null;
  if (footer) {
    modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    if (Array.isArray(footer)) {
      footer.forEach(element => modalFooter!.appendChild(element));
    } else {
      modalFooter.appendChild(footer);
    }
  }
  
  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  if (modalFooter) {
    modalContent.appendChild(modalFooter);
  }
  
  modal.appendChild(modalContent);
  
  // Close modal when clicking outside
  modal.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      if (onClose) onClose();
    }
  };
  
  return modal;
}

export interface LinkOptions {
  href: string;
  text: string;
  id?: string;
  className?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  ariaLabel?: string;
}

/**
 * Creates a standardized link element
 * 
 * @param options - Link configuration options
 * @returns HTMLAnchorElement
 */
export function createLink(options: LinkOptions): HTMLAnchorElement {
  const { href, text, id, className, target, ariaLabel } = options;
  
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  
  if (id) link.id = id;
  if (className) link.className = className;
  if (target) link.target = target;
  if (ariaLabel) link.setAttribute('aria-label', ariaLabel);
  
  return link;
}

export interface AuthHeaderOptions {
  logoHref?: string;
  logoSrc?: string;
  logoAlt?: string;
  subtitle?: string;
}

/**
 * Creates an auth card header with logo and subtitle
 * 
 * @param options - Auth header configuration options
 * @returns HTMLElement containing the auth header
 */
export function createAuthHeader(options: AuthHeaderOptions = {}): HTMLElement {
  const {
    logoHref = '/index.html',
    logoSrc = '/images/logo.svg',
    logoAlt = 'Logo',
    subtitle = 'Split bills with friends'
  } = options;
  
  const header = document.createElement('header');
  header.className = 'auth-card__header';
  
  const title = document.createElement('h1');
  title.className = 'auth-card__title';
  
  const logoLink = document.createElement('a');
  logoLink.href = logoHref;
  logoLink.className = 'auth-card__title-link';
  
  const logo = document.createElement('img');
  logo.src = logoSrc;
  logo.alt = logoAlt;
  logo.className = 'auth-card__logo';
  
  logoLink.appendChild(logo);
  title.appendChild(logoLink);
  header.appendChild(title);
  
  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'auth-card__subtitle';
    subtitleEl.textContent = subtitle;
    header.appendChild(subtitleEl);
  }
  
  return header;
}

export interface AuthFooterLink {
  href: string;
  text: string;
  id?: string;
  variant?: 'primary' | 'secondary';
}

export interface AuthFooterOptions {
  links: Array<{
    text?: string;
    link: AuthFooterLink;
  }>;
}

/**
 * Creates an auth card footer with navigation links
 * 
 * @param options - Auth footer configuration options
 * @returns HTMLElement containing the auth footer
 */
export function createAuthFooter(options: AuthFooterOptions): HTMLElement {
  const { links } = options;
  
  const footer = document.createElement('footer');
  footer.className = 'auth-card__footer';
  
  const nav = document.createElement('nav');
  nav.className = 'auth-nav';
  nav.setAttribute('aria-label', 'Authentication navigation');
  
  links.forEach(({ text, link }) => {
    const p = document.createElement('p');
    
    if (text) {
      p.textContent = text + ' ';
    }
    
    const anchor = createLink({
      href: link.href,
      text: link.text,
      id: link.id,
      className: `auth-link${link.variant ? ' auth-link--' + link.variant : ''}`
    });
    
    p.appendChild(anchor);
    nav.appendChild(p);
  });
  
  footer.appendChild(nav);
  return footer;
}

export interface AuthCardOptions {
  variant: 'login' | 'register';
  header: HTMLElement;
  form: HTMLFormElement;
  footer: HTMLElement;
}

/**
 * Creates a complete auth card container
 * 
 * @param options - Auth card configuration options
 * @returns HTMLElement containing the complete auth card
 */
export function createAuthCard(options: AuthCardOptions): HTMLElement {
  const { variant, header, form, footer } = options;
  
  const article = document.createElement('article');
  article.className = `auth-card auth-card--${variant}`;
  
  article.appendChild(header);
  article.appendChild(form);
  article.appendChild(footer);
  
  return article;
}

export interface WarningBannerOptions {
  message: string;
  isVisible?: boolean;
  onClose?: () => void;
}

/**
 * Creates a warning banner element
 * 
 * @param options - Warning banner configuration options
 * @returns HTMLDivElement containing the warning banner
 */
export function createWarningBanner(options: WarningBannerOptions): HTMLDivElement {
  const { message, isVisible = false, onClose } = options;
  
  const banner = document.createElement('div');
  banner.id = 'warningBanner';
  banner.className = `warning-banner${isVisible ? '' : ' hidden'}`;
  
  const content = document.createElement('span');
  content.className = 'warning-banner__content';
  content.textContent = message;
  
  const closeContainer = document.createElement('div');
  closeContainer.className = 'warning-banner__close-container';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'warning-banner__close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close warning');
  closeButton.onclick = () => {
    banner.classList.add('hidden');
    if (onClose) onClose();
  };
  
  closeContainer.appendChild(closeButton);
  banner.appendChild(content);
  banner.appendChild(closeContainer);
  
  return banner;
}
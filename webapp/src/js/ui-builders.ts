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
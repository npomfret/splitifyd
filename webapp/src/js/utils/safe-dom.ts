import type { ValidationOptions, ValidationResult } from '../types/global';

interface ElementAttributes {
  textContent?: string;
  className?: string;
  id?: string;
  [key: string]: string | boolean | undefined;
}

type ChildElement = string | Node;

export function createElementSafe(
  tag: string, 
  attributes: ElementAttributes = {}, 
  children: ChildElement[] = []
): HTMLElement {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined) return;
    
    if (key === 'textContent') {
      element.textContent = String(value);
    } else if (key === 'className') {
      element.className = String(value);
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, String(value));
    } else if (key === 'id') {
      element.id = String(value);
    } else if (typeof value === 'boolean') {
      if (value) {
        element.setAttribute(key, ''); // Set as a boolean attribute (e.g., <input disabled>)
      } else {
        element.removeAttribute(key); // Remove if false
      }
    } else {
      element.setAttribute(key, String(value)); // Default to string conversion
    }
  });
  
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });
  
  return element;
}

export function setTextContentSafe(element: HTMLElement | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function appendChildren(parent: HTMLElement, children: Node[]): void {
  children.forEach(child => {
    if (child instanceof Node) {
      parent.appendChild(child);
    }
  });
}

export function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text.trim().replace(/[<>&"']/g, function(match: string): string {
    switch (match) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      default: return match;
    }
  });
}

export function isSafeString(text: unknown, maxLength: number = 255): boolean {
  if (typeof text !== 'string') {
    return false;
  }
  
  if (text.length > maxLength) {
    return false;
  }
  
  const dangerousPatterns: RegExp[] = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(text));
}

export function validateInput(input: string | undefined | null, options: ValidationOptions = {}): ValidationResult {
  const {
    required = false,
    maxLength = 255,
    minLength = 0,
    allowedPattern = null
  } = options;
  
  const trimmedInput = input?.trim() || '';
  
  if (required && !trimmedInput) {
    return { valid: false, error: 'This field is required' };
  }
  
  if (input && input.length > maxLength) {
    return { valid: false, error: `Maximum length is ${maxLength} characters` };
  }
  
  if (input && input.length < minLength) {
    return { valid: false, error: `Minimum length is ${minLength} characters` };
  }
  
  if (input && !isSafeString(input, maxLength)) {
    return { valid: false, error: 'Invalid characters detected' };
  }
  
  if (allowedPattern && input && !allowedPattern.test(input)) {
    return { valid: false, error: 'Invalid format' };
  }
  
  return { valid: true, value: trimmedInput };
}
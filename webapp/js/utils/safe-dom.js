export function createElementSafe(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'className') {
            element.className = value;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else if (key === 'id') {
            element.id = value;
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

export function setTextContentSafe(element, text) {
    if (element) {
        element.textContent = text;
    }
}

export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

export function appendChildren(parent, children) {
    children.forEach(child => {
        if (child instanceof Node) {
            parent.appendChild(child);
        }
    });
}

export function sanitizeText(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    return text.trim().replace(/[<>&"']/g, function(match) {
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

export function isSafeString(text, maxLength = 255) {
    if (typeof text !== 'string') {
        return false;
    }
    
    if (text.length > maxLength) {
        return false;
    }
    
    const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /data:text\/html/gi,
        /vbscript:/gi
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(text));
}

export function validateInput(input, options = {}) {
    const {
        required = false,
        maxLength = 255,
        minLength = 0,
        allowedPattern = null
    } = options;
    
    if (required && (!input || input.trim() === '')) {
        return { valid: false, error: 'This field is required' };
    }
    
    if (input && input.length > maxLength) {
        return { valid: false, error: `Maximum length is ${maxLength} characters` };
    }
    
    if (input && input.length < minLength) {
        return { valid: false, error: `Minimum length is ${minLength} characters` };
    }
    
    if (!isSafeString(input, maxLength)) {
        return { valid: false, error: 'Invalid characters detected' };
    }
    
    if (allowedPattern && input && !allowedPattern.test(input)) {
        return { valid: false, error: 'Invalid format' };
    }
    
    return { valid: true, value: input ? input.trim() : '' };
}
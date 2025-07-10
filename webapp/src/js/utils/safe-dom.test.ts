import {
    createElementSafe,
    setTextContentSafe,
    clearElement,
    appendChildren,
    sanitizeText,
    isSafeString,
    validateInput
} from './safe-dom';
import type { ValidationOptions } from '../types/global.js';

// Mock DOM environment
interface MockNode {
    textContent: string;
    nodeType?: number;
}

interface MockElement extends MockNode {
    className: string;
    id: string;
    setAttribute: jest.Mock;
    appendChild: jest.Mock;
    removeChild: jest.Mock;
    firstChild: MockNode | null;
    childNodes: MockNode[];
}

const mockElement: MockElement = {
    textContent: '',
    className: '',
    id: '',
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    firstChild: null,
    childNodes: []
};

const mockNode: MockNode = {
    textContent: 'test',
    nodeType: 3 // TEXT_NODE
};

const mockDocument = {
    createElement: jest.fn().mockReturnValue(mockElement),
    createTextNode: jest.fn().mockReturnValue(mockNode)
};

Object.defineProperty(global, 'document', { value: mockDocument });

// Mock Node constructor for instanceof checks
global.Node = class Node {
    textContent: string = '';
    nodeType: number = 1;
    constructor() {}
} as any;

describe('safe-dom utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockElement.textContent = '';
        mockElement.className = '';
        mockElement.id = '';
        mockElement.firstChild = null;
        mockElement.childNodes = [];
    });

    describe('createElementSafe', () => {
        it('should create element with basic attributes', () => {
            const element = createElementSafe('div', {
                textContent: 'Hello World',
                className: 'test-class',
                id: 'test-id'
            });

            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
            expect(element.textContent).toBe('Hello World');
            expect(element.className).toBe('test-class');
            expect(element.id).toBe('test-id');
        });

        it('should handle data attributes', () => {
            createElementSafe('div', {
                'data-testid': 'test-element',
                'data-value': '123'
            });

            expect(mockElement.setAttribute).toHaveBeenCalledWith('data-testid', 'test-element');
            expect(mockElement.setAttribute).toHaveBeenCalledWith('data-value', '123');
        });

        it('should ignore undefined attributes', () => {
            createElementSafe('div', {
                textContent: 'test',
                className: undefined,
                id: undefined
            });

            expect(mockElement.textContent).toBe('test');
            expect(mockElement.className).toBe('');
            expect(mockElement.id).toBe('');
        });

        it('should append string children as text nodes', () => {
            createElementSafe('div', {}, ['Hello', 'World']);

            expect(mockDocument.createTextNode).toHaveBeenCalledWith('Hello');
            expect(mockDocument.createTextNode).toHaveBeenCalledWith('World');
            expect(mockElement.appendChild).toHaveBeenCalledTimes(2);
        });

        it('should append Node children directly', () => {
            const childNode = new global.Node();
            createElementSafe('div', {}, [childNode as any]);

            expect(mockElement.appendChild).toHaveBeenCalledWith(childNode);
        });

        it('should create element with no attributes or children', () => {
            const element = createElementSafe('div');

            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
            expect(element).toBe(mockElement);
        });
    });

    describe('setTextContentSafe', () => {
        it('should set text content when element exists', () => {
            const element = mockElement as any;
            setTextContentSafe(element, 'New content');

            expect(element.textContent).toBe('New content');
        });

        it('should do nothing when element is null', () => {
            expect(() => setTextContentSafe(null, 'New content')).not.toThrow();
        });
    });

    describe('clearElement', () => {
        it('should remove all child nodes', () => {
            const child1 = { textContent: 'child1' };
            const child2 = { textContent: 'child2' };
            
            mockElement.firstChild = child1 as any;
            let callCount = 0;
            mockElement.removeChild = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    mockElement.firstChild = child2 as any;
                } else {
                    mockElement.firstChild = null;
                }
            });

            clearElement(mockElement as any);

            expect(mockElement.removeChild).toHaveBeenCalledTimes(2);
            expect(mockElement.removeChild).toHaveBeenCalledWith(child1);
            expect(mockElement.removeChild).toHaveBeenCalledWith(child2);
        });

        it('should handle empty element', () => {
            mockElement.firstChild = null;

            expect(() => clearElement(mockElement as any)).not.toThrow();
            expect(mockElement.removeChild).not.toHaveBeenCalled();
        });
    });

    describe('appendChildren', () => {
        it('should append all Node children', () => {
            const child1 = new global.Node();
            const child2 = new global.Node();
            
            appendChildren(mockElement as any, [child1 as any, child2 as any]);

            expect(mockElement.appendChild).toHaveBeenCalledWith(child1);
            expect(mockElement.appendChild).toHaveBeenCalledWith(child2);
        });

        it('should skip non-Node children', () => {
            const child1 = new global.Node();
            const notANode = { textContent: 'not a node' };
            
            appendChildren(mockElement as any, [child1 as any, notANode as any]);

            expect(mockElement.appendChild).toHaveBeenCalledWith(child1);
            expect(mockElement.appendChild).toHaveBeenCalledTimes(1);
        });

        it('should handle empty children array', () => {
            appendChildren(mockElement as any, []);

            expect(mockElement.appendChild).not.toHaveBeenCalled();
        });
    });

    describe('sanitizeText', () => {
        it('should sanitize HTML special characters', () => {
            const input = '<script>alert("xss")</script>';
            const result = sanitizeText(input);

            expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should sanitize all dangerous characters', () => {
            const input = `<>&"'`;
            const result = sanitizeText(input);

            expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;');
        });

        it('should trim whitespace', () => {
            const input = '  hello world  ';
            const result = sanitizeText(input);

            expect(result).toBe('hello world');
        });

        it('should return empty string for non-string input', () => {
            expect(sanitizeText(123)).toBe('');
            expect(sanitizeText(null)).toBe('');
            expect(sanitizeText(undefined)).toBe('');
            expect(sanitizeText({})).toBe('');
        });

        it('should preserve safe text', () => {
            const input = 'Hello, World! This is safe text.';
            const result = sanitizeText(input);

            expect(result).toBe('Hello, World! This is safe text.');
        });
    });

    describe('isSafeString', () => {
        it('should return true for safe strings', () => {
            expect(isSafeString('Hello World')).toBe(true);
            expect(isSafeString('123')).toBe(true);
            expect(isSafeString('email@example.com')).toBe(true);
        });

        it('should return false for non-string input', () => {
            expect(isSafeString(123)).toBe(false);
            expect(isSafeString(null)).toBe(false);
            expect(isSafeString(undefined)).toBe(false);
            expect(isSafeString({})).toBe(false);
        });

        it('should return false for strings exceeding max length', () => {
            const longString = 'a'.repeat(300);
            expect(isSafeString(longString)).toBe(false);
            expect(isSafeString(longString, 500)).toBe(true);
        });

        it('should detect dangerous script tags', () => {
            expect(isSafeString('<script>alert("xss")</script>')).toBe(false);
            expect(isSafeString('<SCRIPT>alert("xss")</SCRIPT>')).toBe(false);
        });

        it('should detect javascript: protocol', () => {
            expect(isSafeString('javascript:alert("xss")')).toBe(false);
            expect(isSafeString('JAVASCRIPT:alert("xss")')).toBe(false);
        });

        it('should detect event handlers', () => {
            expect(isSafeString('onclick=alert("xss")')).toBe(false);
            expect(isSafeString('onload=alert("xss")')).toBe(false);
            expect(isSafeString('ONCLICK=alert("xss")')).toBe(false);
        });

        it('should detect data URLs', () => {
            expect(isSafeString('data:text/html,<script>alert("xss")</script>')).toBe(false);
            expect(isSafeString('DATA:TEXT/HTML,<script>alert("xss")</script>')).toBe(false);
        });

        it('should detect VBScript', () => {
            expect(isSafeString('vbscript:MsgBox("xss")')).toBe(false);
            expect(isSafeString('VBSCRIPT:MsgBox("xss")')).toBe(false);
        });
    });

    describe('validateInput', () => {
        it('should validate required fields', () => {
            const options: ValidationOptions = { required: true };
            
            expect(validateInput('', options)).toEqual({
                valid: false,
                error: 'This field is required'
            });
            
            expect(validateInput('  ', options)).toEqual({
                valid: false,
                error: 'This field is required'
            });
            
            expect(validateInput('valid input', options)).toEqual({
                valid: true,
                value: 'valid input'
            });
        });

        it('should validate max length', () => {
            const options: ValidationOptions = { maxLength: 10 };
            
            expect(validateInput('short', options)).toEqual({
                valid: true,
                value: 'short'
            });
            
            expect(validateInput('this is too long', options)).toEqual({
                valid: false,
                error: 'Maximum length is 10 characters'
            });
        });

        it('should validate min length', () => {
            const options: ValidationOptions = { minLength: 5 };
            
            expect(validateInput('hi', options)).toEqual({
                valid: false,
                error: 'Minimum length is 5 characters'
            });
            
            expect(validateInput('hello', options)).toEqual({
                valid: true,
                value: 'hello'
            });
        });

        it('should validate against allowed pattern', () => {
            const options: ValidationOptions = { allowedPattern: /^[a-zA-Z]+$/ };
            
            expect(validateInput('letters', options)).toEqual({
                valid: true,
                value: 'letters'
            });
            
            expect(validateInput('letters123', options)).toEqual({
                valid: false,
                error: 'Invalid format'
            });
        });

        it('should detect unsafe strings', () => {
            const result = validateInput('<script>alert("xss")</script>');
            
            expect(result).toEqual({
                valid: false,
                error: 'Invalid characters detected'
            });
        });

        it('should trim input and return trimmed value', () => {
            const result = validateInput('  trimmed  ');
            
            expect(result).toEqual({
                valid: true,
                value: 'trimmed'
            });
        });

        it('should handle null and undefined input', () => {
            expect(validateInput(null)).toEqual({
                valid: true,
                value: ''
            });
            
            expect(validateInput(undefined)).toEqual({
                valid: true,
                value: ''
            });
        });

        it('should combine multiple validation rules', () => {
            const options: ValidationOptions = {
                required: true,
                minLength: 3,
                maxLength: 10,
                allowedPattern: /^[a-zA-Z]+$/
            };
            
            expect(validateInput('ab', options)).toEqual({
                valid: false,
                error: 'Minimum length is 3 characters'
            });
            
            expect(validateInput('abc123', options)).toEqual({
                valid: false,
                error: 'Invalid format'
            });
            
            expect(validateInput('valid', options)).toEqual({
                valid: true,
                value: 'valid'
            });
        });
    });
});
import { FormComponents } from './form-components';
import type { FormFieldConfig, FormActionButton } from '../types/business-logic';

// Mock Node constructor for instanceof checks
class MockNode {
    textContent: string = '';
    nodeType: number = 1;
    constructor() {}
}

global.Node = MockNode as any;

// Mock HTMLInputElement and other DOM elements
class MockHTMLInputElement extends MockNode {
    id: string = '';
    checked: boolean = false;
    value: string = '';
    type: string = 'text';
    constructor() {
        super();
    }
}

class MockHTMLSelectElement extends MockNode {
    id: string = '';
    value: string = '';
    constructor() {
        super();
    }
}

class MockHTMLTextAreaElement extends MockNode {
    id: string = '';
    value: string = '';
    constructor() {
        super();
    }
}

global.HTMLInputElement = MockHTMLInputElement as any;
global.HTMLSelectElement = MockHTMLSelectElement as any;
global.HTMLTextAreaElement = MockHTMLTextAreaElement as any;

// Mock DOM environment
interface MockElement extends MockNode {
    id: string;
    checked: boolean;
    value: string;
    disabled: boolean;
    type: string;
    querySelector: jest.Mock;
    querySelectorAll: jest.Mock;
    appendChild: jest.Mock;
    style: { display: string };
}

const createMockElement = (tagName: string = 'div'): MockElement => {
    const element = Object.create(MockNode.prototype);
    Object.assign(element, {
        textContent: '',
        nodeType: 1,
        id: '',
        checked: false,
        value: '',
        disabled: false,
        type: 'text',
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(),
        appendChild: jest.fn(),
        style: { display: 'block' }
    });
    return element;
};

// Mock UI visibility functions
jest.mock('../utils/ui-visibility.js', () => ({
    hideElement: jest.fn(),
    showElement: jest.fn()
}));

import { hideElement, showElement } from '../utils/ui-visibility.js';

describe('FormComponents', () => {
    beforeEach(() => {
        // Mock getElementById
        global.document = {
            getElementById: jest.fn()
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('formGroup', () => {
        it('should render basic text input', () => {
            const config: FormFieldConfig = {
                label: 'Test Field',
                id: 'test-field'
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('<input type="text"');
            expect(result).toContain('id="test-field"');
            expect(result).toContain('<label for="test-field">Test Field</label>');
            expect(result).toContain('class="error-message"');
        });

        it('should render required field with asterisk', () => {
            const config: FormFieldConfig = {
                label: 'Required Field',
                required: true
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('<span class="required">*</span>');
            expect(result).toContain('required');
        });

        it('should render select dropdown with options', () => {
            const config: FormFieldConfig = {
                label: 'Category',
                type: 'select',
                value: 'food',
                options: ['food', 'travel', 'entertainment']
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('<select');
            expect(result).toContain('<option value="food" selected>food</option>');
            expect(result).toContain('<option value="travel">travel</option>');
        });

        it('should render select with object options', () => {
            const config: FormFieldConfig = {
                label: 'Category',
                type: 'select',
                value: 'food',
                options: [
                    { value: 'food', label: 'Food & Drink' },
                    { value: 'travel', label: 'Travel' }
                ]
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('<option value="food" selected>Food & Drink</option>');
            expect(result).toContain('<option value="travel">Travel</option>');
        });

        it('should render textarea', () => {
            const config: FormFieldConfig = {
                label: 'Description',
                type: 'textarea',
                value: 'Initial text',
                placeholder: 'Enter description'
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('<textarea');
            expect(result).toContain('placeholder="Enter description"');
            expect(result).toContain('>Initial text</textarea>');
        });

        it('should render readonly field', () => {
            const config: FormFieldConfig = {
                label: 'Readonly Field',
                readonly: true
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('readonly');
        });

        it('should generate id from label when not provided', () => {
            const config: FormFieldConfig = {
                label: 'My Test Field'
            };

            const result = FormComponents.formGroup(config);

            expect(result).toContain('id="my-test-field"');
            expect(result).toContain('for="my-test-field"');
        });
    });

    describe('submitButton', () => {
        it('should render default submit button', () => {
            const result = FormComponents.submitButton();

            expect(result).toContain('<button type="submit"');
            expect(result).toContain('class="button button--primary"');
            expect(result).toContain('id="submitBtn"');
            expect(result).toContain('Submit');
            expect(result).toContain('</button>');
        });

        it('should render custom submit button', () => {
            const config: FormActionButton = {
                text: 'Save Changes',
                id: 'saveBtn',
                disabled: true
            };

            const result = FormComponents.submitButton(config);

            expect(result).toContain('id="saveBtn"');
            expect(result).toContain('Save Changes');
            expect(result).toContain('</button>');
            expect(result).toContain('disabled');
        });
    });

    describe('formActions', () => {
        it('should render form actions container', () => {
            const buttons = ['<button>Cancel</button>', '<button>Submit</button>'];
            
            const result = FormComponents.formActions(buttons);

            expect(result).toContain('<div class="form-actions">');
            expect(result).toContain('<button>Cancel</button>');
            expect(result).toContain('<button>Submit</button>');
        });

        it('should render empty form actions', () => {
            const result = FormComponents.formActions();

            expect(result).toContain('<div class="form-actions">');
        });
    });

    describe('showError', () => {
        it('should show error message on element', () => {
            const mockElement = createMockElement();
            (document.getElementById as jest.Mock).mockReturnValue(mockElement);

            FormComponents.showError('test-error', 'Invalid input');

            expect(document.getElementById).toHaveBeenCalledWith('test-error');
            expect(mockElement.textContent).toBe('Invalid input');
            expect(showElement).toHaveBeenCalledWith(mockElement);
        });

        it('should handle missing element gracefully', () => {
            (document.getElementById as jest.Mock).mockReturnValue(null);

            expect(() => {
                FormComponents.showError('missing-element', 'Error message');
            }).not.toThrow();
        });
    });

    describe('hideError', () => {
        it('should hide error message', () => {
            const mockElement = createMockElement();
            (document.getElementById as jest.Mock).mockReturnValue(mockElement);

            FormComponents.hideError('test-error');

            expect(document.getElementById).toHaveBeenCalledWith('test-error');
            expect(mockElement.textContent).toBe('');
            expect(hideElement).toHaveBeenCalledWith(mockElement);
        });
    });

    describe('clearAllErrors', () => {
        it('should clear all error messages in form', () => {
            const errorElement1 = createMockElement();
            const errorElement2 = createMockElement();
            const mockForm = createMockElement();
            
            mockForm.querySelectorAll.mockReturnValue([errorElement1, errorElement2]);
            (document.getElementById as jest.Mock).mockReturnValue(mockForm);

            FormComponents.clearAllErrors('test-form');

            expect(mockForm.querySelectorAll).toHaveBeenCalledWith('.error-message');
            expect(errorElement1.textContent).toBe('');
            expect(errorElement2.textContent).toBe('');
            expect(hideElement).toHaveBeenCalledWith(errorElement1);
            expect(hideElement).toHaveBeenCalledWith(errorElement2);
        });
    });

    describe('getFormData', () => {
        it('should extract form data from inputs', () => {
            const textInput = new MockHTMLInputElement();
            textInput.id = 'name';
            textInput.value = 'John Doe';
            
            const checkboxInput = new MockHTMLInputElement();
            checkboxInput.id = 'subscribe';
            checkboxInput.checked = true;
            checkboxInput.type = 'checkbox';
            
            const numberInput = new MockHTMLInputElement();
            numberInput.id = 'amount';
            numberInput.value = '25.50';
            numberInput.type = 'number';

            const mockForm = createMockElement();
            mockForm.querySelectorAll.mockReturnValue([textInput, checkboxInput, numberInput]);
            (document.getElementById as jest.Mock).mockReturnValue(mockForm);

            const result = FormComponents.getFormData('test-form');

            expect(result).toEqual({
                name: 'John Doe',
                subscribe: true,
                amount: 25.50
            });
        });

        it('should handle missing form', () => {
            (document.getElementById as jest.Mock).mockReturnValue(null);

            const result = FormComponents.getFormData('missing-form');

            expect(result).toEqual({});
        });
    });

    describe('setFormData', () => {
        it('should set form data values', () => {
            const textInput = new MockHTMLInputElement();
            const checkboxInput = new MockHTMLInputElement();
            checkboxInput.type = 'checkbox';
            const mockForm = createMockElement();
            
            mockForm.querySelector
                .mockReturnValueOnce(textInput)
                .mockReturnValueOnce(checkboxInput);
            
            (document.getElementById as jest.Mock).mockReturnValue(mockForm);

            const data = {
                name: 'Jane Doe',
                subscribe: true
            };

            FormComponents.setFormData('test-form', data);

            expect(mockForm.querySelector).toHaveBeenCalledWith('#name');
            expect(mockForm.querySelector).toHaveBeenCalledWith('#subscribe');
            expect(textInput.value).toBe('Jane Doe');
            expect(checkboxInput.checked).toBe(true);
        });
    });
});
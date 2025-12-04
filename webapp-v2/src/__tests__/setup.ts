import '@testing-library/jest-dom/vitest';
import { h } from 'preact';
import { vi } from 'vitest';

// Mock heroicons to avoid SVG namespacing issues in jsdom
const createMockIcon = (testId: string) => () => h('svg', { 'data-testid': testId });

vi.mock('@heroicons/react/24/outline', () => ({
    ClockIcon: createMockIcon('mock-clock-icon'),
    ArchiveBoxIcon: createMockIcon('mock-archive-icon'),
    ExclamationTriangleIcon: createMockIcon('mock-warning-icon'),
    CheckCircleIcon: createMockIcon('mock-check-icon'),
    ChatBubbleLeftRightIcon: createMockIcon('mock-chat-icon'),
    BanknotesIcon: createMockIcon('mock-banknotes-icon'),
    ReceiptPercentIcon: createMockIcon('mock-receipt-icon'),
    PencilIcon: createMockIcon('mock-pencil-icon'),
    TrashIcon: createMockIcon('mock-trash-icon'),
    ChevronDownIcon: createMockIcon('mock-chevron-icon'),
    UserMinusIcon: createMockIcon('mock-user-minus-icon'),
    UserPlusIcon: createMockIcon('mock-user-plus-icon'),
    CogIcon: createMockIcon('mock-cog-icon'),
    PlusIcon: createMockIcon('mock-plus-icon'),
    ArrowLeftStartOnRectangleIcon: createMockIcon('mock-arrow-icon'),
    ArrowPathIcon: createMockIcon('mock-refresh-icon'),
    ArchiveBoxArrowDownIcon: createMockIcon('mock-archive-down-icon'),
    ScaleIcon: createMockIcon('mock-scale-icon'),
    ChatBubbleLeftIcon: createMockIcon('mock-chat-left-icon'),
}));

const matchMediaMock = () => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
});

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaMock,
    });
}

if (typeof global !== 'undefined' && typeof (global as any).matchMedia !== 'function') {
    (global as any).matchMedia = matchMediaMock;
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserNotificationDetector } from '@/utils/user-notification-detector.ts';
import type { FirebaseService } from '@/app/firebase';

// Mock Firebase
vi.mock('@/app/firebase', () => ({
    getDb: vi.fn(() => ({
        // Mock Firestore instance
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({})),
        })),
    })),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({
        id: 'mocked-doc-ref',
    })),
    onSnapshot: vi.fn(() => {
        // Return a mock unsubscribe function
        return vi.fn();
    }),
}));

describe('UserNotificationDetector', () => {
    let detector: UserNotificationDetector;
    let mockFirebaseService: FirebaseService;

    beforeEach(() => {
        // Create a mock FirebaseService
        mockFirebaseService = {
            initialize: vi.fn(),
            getAuth: vi.fn(),
            getFirestore: vi.fn(),
            signInWithEmailAndPassword: vi.fn(),
            sendPasswordResetEmail: vi.fn(),
            signOut: vi.fn(),
            onAuthStateChanged: vi.fn(),
            onDocumentSnapshot: vi.fn(() => vi.fn()), // Return mock unsubscribe function
        };

        detector = new UserNotificationDetector(mockFirebaseService);
        vi.clearAllMocks();
    });

    it('should create instance without error', () => {
        expect(detector).toBeInstanceOf(UserNotificationDetector);
    });

    it('should have subscribe method', () => {
        expect(typeof detector.subscribe).toBe('function');
    });

    it('should have dispose method', () => {
        expect(typeof detector.dispose).toBe('function');
    });

    it('should return unsubscribe function from subscribe', () => {
        const unsubscribe = detector.subscribe('test-user', {});
        expect(typeof unsubscribe).toBe('function');
    });

    it('should accept callback functions', () => {
        const callbacks = {
            onGroupChange: vi.fn(),
            onTransactionChange: vi.fn(),
            onBalanceChange: vi.fn(),
        };

        const unsubscribe = detector.subscribe('test-user-123', callbacks);
        expect(typeof unsubscribe).toBe('function');
    });

    it('should handle subscription with minimal callbacks', () => {
        const unsubscribe = detector.subscribe('test-user', {});
        expect(typeof unsubscribe).toBe('function');
    });

    it('should be disposable', () => {
        expect(() => detector.dispose()).not.toThrow();
    });

    it('should dispose subscription when unsubscribe is called', () => {
        const unsubscribe = detector.subscribe('test-user', {});

        // Calling unsubscribe should dispose the detector
        expect(() => unsubscribe()).not.toThrow();
    });

    it('should provide debug info', () => {
        const debugInfo = detector.getDebugInfo();

        expect(debugInfo).toEqual({
            userId: null,
            isDisposed: false,
            hasListener: false,
            lastVersion: 0,
            trackedGroups: [],
            retryCount: 0,
        });
    });

    it('should update debug info after subscription', () => {
        detector.subscribe('test-user-456', {});

        const debugInfo = detector.getDebugInfo();

        expect(debugInfo.userId).toBe('test-user-456');
        expect(debugInfo.hasListener).toBe(true);
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '../connection-manager';

describe('ConnectionManager', () => {
    let manager: ConnectionManager;
    let onlineHandler: (() => void) | null = null;
    let offlineHandler: (() => void) | null = null;
    
    beforeEach(() => {
        // Reset singleton
        (ConnectionManager as any).instance = undefined;
        
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            configurable: true,
            value: true
        });

        // Capture event listeners
        vi.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
            if (event === 'online') onlineHandler = handler;
            if (event === 'offline') offlineHandler = handler;
        });

        vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
        
        manager = ConnectionManager.getInstance();
    });

    afterEach(() => {
        manager.dispose();
        vi.clearAllMocks();
        vi.clearAllTimers();
    });

    describe('initialization', () => {
        it('should initialize with online state from navigator', () => {
            expect(manager.isOnline.value).toBe(true);
            expect(manager.connectionQuality.value).toBe('good');
            expect(manager.reconnectAttempts.value).toBe(0);
        });

        it('should be a singleton', () => {
            const instance1 = ConnectionManager.getInstance();
            const instance2 = ConnectionManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should register online/offline event listeners', () => {
            expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
        });
    });

    describe('connection state changes', () => {
        it('should update state when going offline', () => {
            if (offlineHandler) {
                offlineHandler();
            }
            
            expect(manager.isOnline.value).toBe(false);
            expect(manager.connectionQuality.value).toBe('offline');
        });

        it('should update state when going online', () => {
            // First go offline
            if (offlineHandler) {
                offlineHandler();
            }
            manager.reconnectAttempts.value = 3;
            
            // Then go online
            if (onlineHandler) {
                onlineHandler();
            }
            
            expect(manager.isOnline.value).toBe(true);
            expect(manager.connectionQuality.value).toBe('good');
            expect(manager.reconnectAttempts.value).toBe(0);
        });
    });

    describe('reconnectWithBackoff', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should call callback after delay', async () => {
            const callback = vi.fn().mockResolvedValue(undefined);
            
            manager.reconnectWithBackoff('test', callback, { baseDelay: 1000 });
            
            expect(callback).not.toHaveBeenCalled();
            
            await vi.advanceTimersByTimeAsync(1000);
            
            expect(callback).toHaveBeenCalledTimes(1);
            expect(manager.reconnectAttempts.value).toBe(0);
        });

        it('should retry with exponential backoff on failure', async () => {
            const callback = vi.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce(undefined);
            
            manager.reconnectWithBackoff('test', callback, { 
                baseDelay: 1000,
                maxAttempts: 5 
            });
            
            // First attempt after 1000ms
            await vi.advanceTimersByTimeAsync(1000);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(manager.reconnectAttempts.value).toBe(1);
            
            // Second attempt after 2000ms (exponential backoff)
            await vi.advanceTimersByTimeAsync(2000);
            expect(callback).toHaveBeenCalledTimes(2);
            expect(manager.reconnectAttempts.value).toBe(2);
            
            // Third attempt after 4000ms (successful)
            await vi.advanceTimersByTimeAsync(4000);
            expect(callback).toHaveBeenCalledTimes(3);
            expect(manager.reconnectAttempts.value).toBe(0); // Reset on success
        });

        it('should respect maxAttempts', async () => {
            const callback = vi.fn().mockRejectedValue(new Error('fail'));
            
            manager.reconnectWithBackoff('test', callback, { 
                baseDelay: 100,
                maxAttempts: 2 
            });
            
            // First attempt
            await vi.advanceTimersByTimeAsync(100);
            expect(callback).toHaveBeenCalledTimes(1);
            
            // Second attempt
            await vi.advanceTimersByTimeAsync(200);
            expect(callback).toHaveBeenCalledTimes(2);
            
            // No more attempts
            await vi.advanceTimersByTimeAsync(10000);
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should clear previous timeout for same key', async () => {
            const callback1 = vi.fn().mockResolvedValue(undefined);
            const callback2 = vi.fn().mockResolvedValue(undefined);
            
            manager.reconnectWithBackoff('test', callback1, { baseDelay: 2000 });
            manager.reconnectWithBackoff('test', callback2, { baseDelay: 1000 });
            
            await vi.advanceTimersByTimeAsync(1000);
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });
    });

    describe('getState', () => {
        it('should return current connection state', () => {
            const state = manager.getState();
            
            expect(state).toEqual({
                isOnline: true,
                quality: 'good',
                reconnectAttempts: 0
            });
        });

        it('should reflect state changes', () => {
            manager.isOnline.value = false;
            manager.connectionQuality.value = 'offline';
            manager.reconnectAttempts.value = 3;
            
            const state = manager.getState();
            
            expect(state).toEqual({
                isOnline: false,
                quality: 'offline',
                reconnectAttempts: 3
            });
        });
    });

    describe('Network Information API', () => {
        it('should handle browsers without Network Information API', () => {
            // Default navigator doesn't have connection property
            expect(() => ConnectionManager.getInstance()).not.toThrow();
        });

        it('should monitor connection quality when API is available', () => {
            const mockConnection = {
                rtt: 50,
                effectiveType: '4g' as const,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            };
            
            Object.defineProperty(navigator, 'connection', {
                writable: true,
                configurable: true,
                value: mockConnection
            });
            
            // Create new instance with mocked connection
            (ConnectionManager as any).instance = undefined;
            const newManager = ConnectionManager.getInstance();
            
            expect(newManager.connectionQuality.value).toBe('good');
            expect(mockConnection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
            
            newManager.dispose();
        });
    });

    describe('dispose', () => {
        it('should clean up all resources', () => {
            vi.useFakeTimers();
            
            // Set up some reconnect timeouts
            const callback = vi.fn().mockRejectedValue(new Error('fail'));
            manager.reconnectWithBackoff('test1', callback);
            manager.reconnectWithBackoff('test2', callback);
            
            manager.dispose();
            
            // Advance time - callbacks should not be called
            vi.advanceTimersByTime(10000);
            expect(callback).not.toHaveBeenCalled();
            
            // Event listeners should be removed
            expect(window.removeEventListener).toHaveBeenCalled();
            
            vi.useRealTimers();
        });
    });
});
import { render, waitFor } from '@testing-library/preact';
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';

// Create mock signals outside of the mock factory
const mockIsOnline = signal(true);
const mockConnectionQuality = signal<'good' | 'poor' | 'offline'>('good');
const mockReconnectAttempts = signal(0);

// Mock the ConnectionManager
vi.mock('@/utils/connection-manager', () => {
    return {
        ConnectionManager: {
            getInstance: () => ({
                isOnline: mockIsOnline,
                connectionQuality: mockConnectionQuality,
                reconnectAttempts: mockReconnectAttempts,
            }),
        },
    };
});

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
    WifiIcon: () => null,
    NoSymbolIcon: () => null,
}));

import { RealTimeIndicator } from '../RealTimeIndicator';
import { ConnectionManager } from '@/utils/connection-manager';

describe('RealTimeIndicator', () => {
    let connectionManager: any;

    beforeEach(() => {
        connectionManager = ConnectionManager.getInstance();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should show online indicator with good connection', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container } = render(<RealTimeIndicator />);
        
        // Check for green status dot with pulse animation
        const statusDot = container.querySelector('[class*="bg-green-500"]');
        expect(statusDot).toBeTruthy();
        
        // Check for pulse animation
        const pulseAnimation = container.querySelector('[class*="animate-ping"]');
        expect(pulseAnimation).toBeTruthy();
    });

    it('should show online indicator with poor connection', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'poor';

        const { container } = render(<RealTimeIndicator />);
        
        // Check for yellow status dot
        const statusDot = container.querySelector('[class*="bg-yellow-500"]');
        expect(statusDot).toBeTruthy();
        
        // Should not have pulse animation for poor connection
        const pulseAnimation = container.querySelector('[class*="animate-ping"]');
        expect(pulseAnimation).toBeFalsy();
    });

    it('should show offline indicator', () => {
        connectionManager.isOnline.value = false;
        connectionManager.connectionQuality.value = 'offline';

        const { container } = render(<RealTimeIndicator />);
        
        // Check for red status dot
        const statusDot = container.querySelector('[class*="bg-red-500"]');
        expect(statusDot).toBeTruthy();
        
        // Should not have pulse animation when offline
        const pulseAnimation = container.querySelector('[class*="animate-ping"]');
        expect(pulseAnimation).toBeFalsy();
    });

    it('should update when connection status changes', async () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container, rerender } = render(<RealTimeIndicator />);
        
        // Initially online with good connection
        let statusDot = container.querySelector('[class*="bg-green-500"]');
        expect(statusDot).toBeTruthy();
        
        // Change to offline
        connectionManager.isOnline.value = false;
        connectionManager.connectionQuality.value = 'offline';
        
        // Re-render to trigger update
        rerender(<RealTimeIndicator />);
        
        await waitFor(() => {
            // Now should show red status
            statusDot = container.querySelector('[class*="bg-red-500"]');
            expect(statusDot).toBeTruthy();
        });
    });

    it('should have proper accessibility attributes', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container } = render(<RealTimeIndicator />);
        
        // Check for title attribute (tooltip)
        const indicatorWithTitle = container.querySelector('[title="Connected"]');
        expect(indicatorWithTitle).toBeTruthy();
    });

    it('should display correct title for different states', () => {
        // Test offline state
        connectionManager.isOnline.value = false;
        const { container: offlineContainer } = render(<RealTimeIndicator />);
        const offlineTitle = offlineContainer.querySelector('[title="Offline"]');
        expect(offlineTitle).toBeTruthy();
        
        // Test poor connection state
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'poor';
        const { container: poorContainer } = render(<RealTimeIndicator />);
        const poorTitle = poorContainer.querySelector('[title="Poor Connection"]');
        expect(poorTitle).toBeTruthy();
    });
});
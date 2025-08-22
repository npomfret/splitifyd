import { render, waitFor } from '@testing-library/preact';
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';

// Create mock signals outside of the mock factory
const mockIsOnline = signal(true);
const mockConnectionQuality = signal<'good' | 'poor' | 'offline' | 'server-unavailable'>('good');
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

// No heroicons needed anymore

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

    it('should show two dots when online with good server connection', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container } = render(<RealTimeIndicator />);
        
        // Should have two green dots
        const greenDots = container.querySelectorAll('[class*="bg-green-500"]');
        expect(greenDots).toHaveLength(2);
    });

    it('should show red network dot when offline', () => {
        connectionManager.isOnline.value = false;
        connectionManager.connectionQuality.value = 'offline';

        const { container } = render(<RealTimeIndicator />);
        
        // Network dot should be red
        const networkDot = container.querySelector('[title*="Network:"]');
        expect(networkDot?.className).toContain('bg-red-500');
        
        // Server dot should be gray (unknown when offline)
        const serverDot = container.querySelector('[title*="Server:"]');
        expect(serverDot?.className).toContain('bg-gray-400');
    });

    it('should show server unavailable with red server dot', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'server-unavailable';

        const { container } = render(<RealTimeIndicator />);
        
        // Network dot should be green (online)
        const networkDot = container.querySelector('[title*="Network:"]');
        expect(networkDot?.className).toContain('bg-green-500');
        
        // Server dot should be red (unavailable)
        const serverDot = container.querySelector('[title*="Server:"]');
        expect(serverDot?.className).toContain('bg-red-500');
    });

    it('should show poor server connection with yellow server dot', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'poor';

        const { container } = render(<RealTimeIndicator />);
        
        // Network dot should be green (online)
        const networkDot = container.querySelector('[title*="Network:"]');
        expect(networkDot?.className).toContain('bg-green-500');
        
        // Server dot should be yellow (poor connection)
        const serverDot = container.querySelector('[title*="Server:"]');
        expect(serverDot?.className).toContain('bg-yellow-500');
    });

    it('should display correct tooltips for network status', () => {
        // Test online
        connectionManager.isOnline.value = true;
        const { container: onlineContainer } = render(<RealTimeIndicator />);
        const networkOnline = onlineContainer.querySelector('[title="Network: Connected"]');
        expect(networkOnline).toBeTruthy();
        
        // Test offline
        connectionManager.isOnline.value = false;
        const { container: offlineContainer } = render(<RealTimeIndicator />);
        const networkOffline = offlineContainer.querySelector('[title="Network: Offline"]');
        expect(networkOffline).toBeTruthy();
    });

    it('should display correct tooltips for server status', () => {
        connectionManager.isOnline.value = true;
        
        // Test good server connection
        connectionManager.connectionQuality.value = 'good';
        const { container: goodContainer } = render(<RealTimeIndicator />);
        const serverGood = goodContainer.querySelector('[title="Server: Connected"]');
        expect(serverGood).toBeTruthy();
        
        // Test poor server connection
        connectionManager.connectionQuality.value = 'poor';
        const { container: poorContainer } = render(<RealTimeIndicator />);
        const serverPoor = poorContainer.querySelector('[title="Server: Poor connection"]');
        expect(serverPoor).toBeTruthy();
        
        // Test server unavailable
        connectionManager.connectionQuality.value = 'server-unavailable';
        const { container: unavailableContainer } = render(<RealTimeIndicator />);
        const serverUnavailable = unavailableContainer.querySelector('[title="Server: Unavailable"]');
        expect(serverUnavailable).toBeTruthy();
    });

    it('should update when connection status changes', async () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container, rerender } = render(<RealTimeIndicator />);
        
        // Initially both dots should be green
        let greenDots = container.querySelectorAll('[class*="bg-green-500"]');
        expect(greenDots).toHaveLength(2);
        
        // Change to server unavailable
        connectionManager.connectionQuality.value = 'server-unavailable';
        
        rerender(<RealTimeIndicator />);
        
        await waitFor(() => {
            // Network should still be green, server should be red
            const networkDot = container.querySelector('[title*="Network:"]');
            expect(networkDot?.className).toContain('bg-green-500');
            
            const serverDot = container.querySelector('[title*="Server:"]');
            expect(serverDot?.className).toContain('bg-red-500');
        });
    });

    it('should stack dots vertically', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container } = render(<RealTimeIndicator />);
        
        // Should have flex-col class for vertical stacking
        const wrapper = container.querySelector('.flex.flex-col');
        expect(wrapper).toBeTruthy();
    });
});
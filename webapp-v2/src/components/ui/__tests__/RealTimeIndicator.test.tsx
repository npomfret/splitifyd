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

        // Should have two green dots (on the inner div elements)
        const greenDots = container.querySelectorAll('.bg-green-500');
        expect(greenDots).toHaveLength(2);
    });

    it('should show red network dot when offline', () => {
        connectionManager.isOnline.value = false;
        connectionManager.connectionQuality.value = 'offline';

        const { container } = render(<RealTimeIndicator />);

        // Network dot wrapper should have title, inner dot should be red
        const networkWrapper = container.querySelector('[title*="Network:"]');
        expect(networkWrapper).toBeTruthy();
        const networkDot = networkWrapper?.querySelector('.bg-red-500');
        expect(networkDot).toBeTruthy();

        // Server dot wrapper should have title, inner dot should be gray
        const serverWrapper = container.querySelector('[title*="Server:"]');
        expect(serverWrapper).toBeTruthy();
        const serverDot = serverWrapper?.querySelector('.bg-gray-400');
        expect(serverDot).toBeTruthy();
    });

    it('should show server unavailable with red server dot', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'server-unavailable';

        const { container } = render(<RealTimeIndicator />);

        // Network wrapper should have title, inner dot should be green
        const networkWrapper = container.querySelector('[title*="Network:"]');
        expect(networkWrapper).toBeTruthy();
        const networkDot = networkWrapper?.querySelector('.bg-green-500');
        expect(networkDot).toBeTruthy();

        // Server wrapper should have title, inner dot should be red
        const serverWrapper = container.querySelector('[title*="Server:"]');
        expect(serverWrapper).toBeTruthy();
        const serverDot = serverWrapper?.querySelector('.bg-red-500');
        expect(serverDot).toBeTruthy();
    });

    it('should show poor server connection with yellow server dot', () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'poor';

        const { container } = render(<RealTimeIndicator />);

        // Network wrapper should have title, inner dot should be green
        const networkWrapper = container.querySelector('[title*="Network:"]');
        expect(networkWrapper).toBeTruthy();
        const networkDot = networkWrapper?.querySelector('.bg-green-500');
        expect(networkDot).toBeTruthy();

        // Server wrapper should have title, inner dot should be yellow
        const serverWrapper = container.querySelector('[title*="Server:"]');
        expect(serverWrapper).toBeTruthy();
        const serverDot = serverWrapper?.querySelector('.bg-yellow-500');
        expect(serverDot).toBeTruthy();
    });

    it('should display correct tooltips for network status', () => {
        // Test online
        connectionManager.isOnline.value = true;
        const { container: onlineContainer } = render(<RealTimeIndicator />);
        const networkOnline = onlineContainer.querySelector('[title="Network: Connected (Green)"]');
        expect(networkOnline).toBeTruthy();

        // Test offline
        connectionManager.isOnline.value = false;
        const { container: offlineContainer } = render(<RealTimeIndicator />);
        const networkOffline = offlineContainer.querySelector('[title="Network: Offline (Red)"]');
        expect(networkOffline).toBeTruthy();
    });

    it('should display correct tooltips for server status', () => {
        connectionManager.isOnline.value = true;

        // Test good server connection
        connectionManager.connectionQuality.value = 'good';
        const { container: goodContainer } = render(<RealTimeIndicator />);
        const serverGood = goodContainer.querySelector('[title="Server: Connected (Green)"]');
        expect(serverGood).toBeTruthy();

        // Test poor server connection
        connectionManager.connectionQuality.value = 'poor';
        const { container: poorContainer } = render(<RealTimeIndicator />);
        const serverPoor = poorContainer.querySelector('[title="Server: Poor connection (Yellow)"]');
        expect(serverPoor).toBeTruthy();

        // Test server unavailable
        connectionManager.connectionQuality.value = 'server-unavailable';
        const { container: unavailableContainer } = render(<RealTimeIndicator />);
        const serverUnavailable = unavailableContainer.querySelector('[title="Server: Unavailable (Red)"]');
        expect(serverUnavailable).toBeTruthy();
    });

    it('should update when connection status changes', async () => {
        connectionManager.isOnline.value = true;
        connectionManager.connectionQuality.value = 'good';

        const { container, rerender } = render(<RealTimeIndicator />);

        // Initially both inner dots should be green
        let greenDots = container.querySelectorAll('.bg-green-500');
        expect(greenDots).toHaveLength(2);

        // Change to server unavailable
        connectionManager.connectionQuality.value = 'server-unavailable';

        rerender(<RealTimeIndicator />);

        await waitFor(() => {
            // Network wrapper should still have network title, inner dot should be green
            const networkWrapper = container.querySelector('[title*="Network:"]');
            expect(networkWrapper).toBeTruthy();
            const networkDot = networkWrapper?.querySelector('.bg-green-500');
            expect(networkDot).toBeTruthy();

            // Server wrapper should have server title, inner dot should be red
            const serverWrapper = container.querySelector('[title*="Server:"]');
            expect(serverWrapper).toBeTruthy();
            const serverDot = serverWrapper?.querySelector('.bg-red-500');
            expect(serverDot).toBeTruthy();
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

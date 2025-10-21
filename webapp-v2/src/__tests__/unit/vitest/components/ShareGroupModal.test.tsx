import { ShareGroupModal } from '@/components/group/ShareGroupModal';
import { render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient.ts', () => ({
    apiClient: {
        generateShareLink: vi.fn(),
    },
}));

vi.mock('@/utils/browser-logger.ts', () => ({
    logError: vi.fn(),
}));

vi.mock('qrcode.react', () => ({
    QRCodeCanvas: () => <div data-testid='qr-code' />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

import { apiClient } from '@/app/apiClient';

const mockedApiClient = apiClient as unknown as {
    generateShareLink: Mock;
};

describe('ShareGroupModal', () => {
    beforeEach(() => {
        mockedApiClient.generateShareLink.mockReset();
    });

    it('fetches a link when opened and displays the current group name', async () => {
        mockedApiClient.generateShareLink.mockResolvedValue({ shareablePath: '/share/group-1' });

        render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Design Guild'
            />
        );

        await waitFor(() => expect(mockedApiClient.generateShareLink).toHaveBeenCalledWith('group-1'));
        const linkInput = await screen.findByTestId('share-link-input') as HTMLInputElement;
        const origin = window.location.origin;
        await waitFor(() => expect(linkInput).toHaveValue(`${origin}/share/group-1`));
        expect(screen.getByTestId('share-group-name')).toHaveTextContent('Design Guild');
    });

    it('regenerates the share link when the group changes while open', async () => {
        mockedApiClient.generateShareLink
            .mockResolvedValueOnce({ shareablePath: '/share/group-1' })
            .mockResolvedValueOnce({ shareablePath: '/share/group-2' });

        const { rerender } = render(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-1'
                groupName='Design Guild'
            />
        );

        const linkInput = await screen.findByTestId('share-link-input') as HTMLInputElement;
        const origin = window.location.origin;
        await waitFor(() => expect(linkInput).toHaveValue(`${origin}/share/group-1`));

        rerender(
            <ShareGroupModal
                isOpen={true}
                onClose={() => {}}
                groupId='group-2'
                groupName='Product Crew'
            />
        );

        await waitFor(() => expect(mockedApiClient.generateShareLink).toHaveBeenLastCalledWith('group-2'));
        const updatedInput = await screen.findByTestId('share-link-input') as HTMLInputElement;
        await waitFor(() => expect(updatedInput).toHaveValue(`${origin}/share/group-2`));
        expect(screen.getByTestId('share-group-name')).toHaveTextContent('Product Crew');
        expect(updatedInput).not.toHaveValue(`${origin}/share/group-1`);
    });
});

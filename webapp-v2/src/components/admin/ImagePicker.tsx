import { TenantImageLibrary } from '@/components/admin/TenantImageLibrary';
import { Button, Modal } from '@/components/ui';
import { XIcon } from '@/components/ui/icons';
import type { TenantImageDTO } from '@billsplit-wl/shared';
import { useCallback, useState } from 'preact/hooks';

interface ImagePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
    tenantId: string;
    currentImageUrl?: string;
    title?: string;
}

export function ImagePicker({
    isOpen,
    onClose,
    onSelect,
    tenantId,
    currentImageUrl,
    title = 'Select Image',
}: ImagePickerProps) {
    const [selectedImage, setSelectedImage] = useState<TenantImageDTO | null>(null);

    const handleImageSelect = useCallback((image: TenantImageDTO) => {
        setSelectedImage(image);
    }, []);

    const handleConfirm = useCallback(() => {
        if (selectedImage) {
            onSelect(selectedImage.url);
            setSelectedImage(null);
            onClose();
        }
    }, [selectedImage, onSelect, onClose]);

    const handleClose = useCallback(() => {
        setSelectedImage(null);
        onClose();
    }, [onClose]);

    return (
        <Modal open={isOpen} onClose={handleClose} size='lg'>
            <div className='flex flex-col h-[70vh] p-6'>
                {/* Header */}
                <div className='flex items-center justify-between pb-4 mb-4 border-b border-border-default'>
                    <h2 className='text-xl font-semibold text-text-primary'>{title}</h2>
                    <button
                        onClick={handleClose}
                        className='p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors'
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                {/* Image Library */}
                <div className='flex-1 overflow-y-auto -mx-6 px-6'>
                    <TenantImageLibrary
                        tenantId={tenantId}
                        onSelect={handleImageSelect}
                        selectedImageUrl={selectedImage?.url || currentImageUrl}
                        pickerMode
                    />
                </div>

                {/* Footer */}
                <div className='flex justify-end gap-3 pt-4 mt-4 border-t border-border-default'>
                    <Button variant='secondary' onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button variant='primary' onClick={handleConfirm} disabled={!selectedImage}>
                        Select Image
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

import { tenantImageLibraryStore } from '@/app/stores/tenant-image-library-store';
import { Button } from '@/components/ui';
import type { TenantImageDTO, TenantImageId } from '@billsplit-wl/shared';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

interface TenantImageLibraryProps {
    tenantId: string;
    onSelect?: (image: TenantImageDTO) => void;
    selectedImageUrl?: string;
}

export function TenantImageLibrary({ tenantId, onSelect, selectedImageUrl }: TenantImageLibraryProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<TenantImageId | null>(null);
    const [editName, setEditName] = useState('');
    const [deletingId, setDeletingId] = useState<TenantImageId | null>(null);

    const images = tenantImageLibraryStore.imagesSignal.value;
    const loading = tenantImageLibraryStore.loadingSignal.value;
    const error = tenantImageLibraryStore.errorSignal.value;

    useEffect(() => {
        if (tenantId) {
            tenantImageLibraryStore.loadImages(tenantId);
        }
        return () => {
            tenantImageLibraryStore.reset();
        };
    }, [tenantId]);

    const handleFileSelect = useCallback(
        async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];

            if (!file) return;

            // Validate file size (5MB max)
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > 5) {
                setUploadError('File size exceeds 5MB limit');
                return;
            }

            const name = uploadName.trim() || file.name.replace(/\.[^/.]+$/, '');

            setUploading(true);
            setUploadError(null);

            try {
                await tenantImageLibraryStore.uploadImage(tenantId, name, file);
                setUploadName('');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (err: unknown) {
                setUploadError('Failed to upload image');
            } finally {
                setUploading(false);
            }
        },
        [tenantId, uploadName],
    );

    const handleRename = useCallback(
        async (imageId: TenantImageId) => {
            if (!editName.trim()) return;

            try {
                await tenantImageLibraryStore.renameImage(tenantId, imageId, editName.trim());
                setEditingId(null);
                setEditName('');
            } catch {
                // Error handled by store
            }
        },
        [tenantId, editName],
    );

    const handleDelete = useCallback(
        async (imageId: TenantImageId) => {
            setDeletingId(imageId);
            try {
                await tenantImageLibraryStore.deleteImage(tenantId, imageId);
            } catch {
                // Error handled by store
            } finally {
                setDeletingId(null);
            }
        },
        [tenantId],
    );

    const startEditing = useCallback((image: TenantImageDTO) => {
        setEditingId(image.id);
        setEditName(image.name);
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingId(null);
        setEditName('');
    }, []);

    if (loading && images.length === 0) {
        return (
            <div className='flex items-center justify-center py-8'>
                <div className='text-text-muted'>Loading images...</div>
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            {/* Upload Section */}
            <div className='p-4 rounded-lg border border-border-default bg-surface-muted'>
                <div className='flex flex-col gap-3'>
                    <div className='flex gap-2'>
                        <input
                            type='text'
                            placeholder='Image name (optional)'
                            value={uploadName}
                            onChange={(e) => setUploadName((e.target as HTMLInputElement).value)}
                            className='flex-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-interactive-primary focus:outline-none focus:ring-2 focus:ring-interactive-primary/20'
                            disabled={uploading}
                        />
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/jpeg,image/png,image/gif,image/svg+xml,image/webp'
                            onChange={handleFileSelect}
                            className='hidden'
                            disabled={uploading}
                        />
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? 'Uploading...' : 'Upload Image'}
                        </Button>
                    </div>
                    {uploadError && <p className='text-sm text-semantic-error'>{uploadError}</p>}
                    <p className='text-xs text-text-muted'>Supported: JPEG, PNG, GIF, SVG, WebP (max 5MB)</p>
                </div>
            </div>

            {/* Error Display */}
            {error && <div className='p-3 rounded-lg bg-semantic-error/10 text-semantic-error text-sm'>{error}</div>}

            {/* Image Grid */}
            {images.length === 0 ? (
                <div className='text-center py-8 text-text-muted'>
                    No images in library. Upload one to get started.
                </div>
            ) : (
                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'>
                    {images.map((image) => (
                        <div
                            key={image.id}
                            className={`group relative rounded-lg border overflow-hidden transition-all ${
                                selectedImageUrl === image.url
                                    ? 'border-interactive-primary ring-2 ring-interactive-primary/20'
                                    : 'border-border-default hover:border-border-strong'
                            }`}
                        >
                            {/* Image Preview */}
                            <div
                                className='aspect-square bg-surface-muted flex items-center justify-center cursor-pointer'
                                onClick={() => onSelect?.(image)}
                            >
                                <img
                                    src={image.url}
                                    alt={image.name}
                                    className='max-w-full max-h-full object-contain'
                                    loading='lazy'
                                />
                            </div>

                            {/* Image Info */}
                            <div className='p-2 bg-surface-base'>
                                {editingId === image.id ? (
                                    <div className='flex gap-1'>
                                        <input
                                            type='text'
                                            value={editName}
                                            onChange={(e) => setEditName((e.target as HTMLInputElement).value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRename(image.id);
                                                if (e.key === 'Escape') cancelEditing();
                                            }}
                                            className='flex-1 rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-interactive-primary focus:outline-none'
                                            autoFocus
                                        />
                                        <Button variant='ghost' size='sm' onClick={() => handleRename(image.id)}>
                                            Save
                                        </Button>
                                        <Button variant='ghost' size='sm' onClick={cancelEditing}>
                                            X
                                        </Button>
                                    </div>
                                ) : (
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs text-text-primary truncate' title={image.name}>
                                            {image.name}
                                        </span>
                                        <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                            <button
                                                onClick={() => startEditing(image)}
                                                className='p-1 text-text-muted hover:text-text-primary text-xs'
                                                title='Rename'
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(image.id)}
                                                disabled={deletingId === image.id}
                                                className='p-1 text-text-muted hover:text-semantic-error text-xs disabled:opacity-50'
                                                title='Delete'
                                            >
                                                {deletingId === image.id ? '...' : 'Del'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selection Indicator */}
                            {selectedImageUrl === image.url && (
                                <div className='absolute top-2 right-2 w-5 h-5 rounded-full bg-interactive-primary flex items-center justify-center'>
                                    <span className='text-interactive-primary-foreground text-xs'>✓</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

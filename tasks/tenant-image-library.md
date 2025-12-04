# Tenant Image Library

## Status: COMPLETED ✓

All implementation steps have been completed. The feature is fully functional.

## Overview

Add an image library feature that allows tenant admins to upload, name, and manage image assets. These images can then be selected when configuring the tenant's logo and favicon.

## Current State

### Existing Image Upload Flow
- TenantEditorModal has `ImageUploadField` components for direct logo/favicon upload
- Images upload via `POST /api/admin/tenants/:tenantId/assets/:assetType`
- Storage uses content-hash-based immutable URLs in `tenant-assets/{tenantId}/{assetType}-{hash}.{ext}`
- Each upload replaces the previous asset (old one deleted automatically)

### Current Architecture Files
| Purpose | Location |
|---------|----------|
| API endpoint config | `firebase/functions/src/routes/route-config.ts` |
| HTTP handler | `firebase/functions/src/tenant/TenantAdminHandlers.ts` |
| Storage service | `firebase/functions/src/services/storage/TenantAssetStorage.ts` |
| Image validation | `firebase/functions/src/utils/validation/imageValidation.ts` |
| Admin modal UI | `webapp-v2/src/components/admin/TenantEditorModal.tsx` |
| Upload component | `webapp-v2/src/components/ui/ImageUploadField.tsx` |
| Client API method | `webapp-v2/src/app/apiClient.ts` |

## Proposed Feature

### User Flow
1. Tenant admin navigates to a new "Image Library" section in tenant settings
2. Uploads images with a display name (e.g., "Company Logo Dark", "Summer Favicon")
3. Images stored in library, visible in a gallery view
4. When editing tenant branding, logo/favicon fields show a picker that:
   - Displays images from the library as thumbnails
   - Allows direct upload as fallback
   - Shows currently selected image

### Data Model

#### New Firestore Collection: `tenants/{tenantId}/images`
```typescript
interface TenantImage {
    id: string;           // Auto-generated
    name: string;         // User-provided display name
    url: string;          // Storage URL
    contentType: string;  // MIME type
    sizeBytes: number;    // File size
    uploadedAt: string;   // ISO timestamp
    uploadedBy: string;   // User ID
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tenants/:tenantId/images` | List all images in library |
| POST | `/admin/tenants/:tenantId/images` | Upload new image with name |
| DELETE | `/admin/tenants/:tenantId/images/:imageId` | Delete image from library |
| PATCH | `/admin/tenants/:tenantId/images/:imageId` | Rename image |

### UI Components

1. **TenantImageLibrary** - Gallery view of uploaded images
   - Grid of image thumbnails with names
   - Upload button
   - Delete/rename actions per image

2. **ImagePicker** - Selection component for logo/favicon fields
   - Thumbnail grid from library
   - "Upload new" option
   - Current selection highlighted

### Storage Path Changes
Current: `tenant-assets/{tenantId}/{assetType}-{hash}.{ext}`
New: `tenant-assets/{tenantId}/library/{imageId}.{ext}`

The existing `logo` and `favicon` asset types would continue to work, but would reference library images by URL.

## Implementation Steps

1. ✓ Add Firestore collection schema and types
2. ✓ Create backend handlers for image library CRUD
3. ✓ Update TenantAssetStorage for library storage paths
4. ✓ Add API routes and client methods
5. ✓ Build TenantImageLibrary component
6. ✓ Build ImagePicker component
7. ✓ Update TenantEditorModal to use ImagePicker
8. ✓ Add tests for image library feature

## Files Created/Modified

### Backend
- `packages/shared/src/shared-types.ts` - Added TenantImageDTO, TenantImageId, and related types
- `firebase/functions/src/schemas/tenant.ts` - Added TenantImageDocumentSchema
- `firebase/functions/src/services/tenant/TenantImageLibraryService.ts` - NEW: Service for image CRUD
- `firebase/functions/src/tenant/TenantImageLibraryHandlers.ts` - NEW: HTTP handlers
- `firebase/functions/src/routes/route-config.ts` - Added image library routes
- `firebase/functions/src/errors/ErrorCode.ts` - Added IMAGE_NOT_FOUND and IMAGE_LIBRARY_FULL
- `firebase/functions/src/services/storage/TenantAssetStorage.ts` - Added library storage methods
- `packages/test-support/src/ApiDriver.ts` - Added test driver methods
- `firebase/functions/src/__tests__/unit/AppDriver.ts` - Added unit test driver methods
- `firebase/functions/src/__tests__/unit/api/tenant-image-library.test.ts` - NEW: API tests

### Frontend
- `webapp-v2/src/app/apiClient.ts` - Added tenant image library client methods
- `webapp-v2/src/app/stores/tenant-image-library-store.ts` - NEW: Preact signals store
- `webapp-v2/src/components/admin/TenantImageLibrary.tsx` - NEW: Gallery component
- `webapp-v2/src/components/admin/ImagePicker.tsx` - NEW: Modal picker component
- `webapp-v2/src/components/ui/ImageUploadField.tsx` - Added library support props
- `webapp-v2/src/components/admin/TenantEditorModal.tsx` - Integrated ImagePicker

## Authorization

- Only `tenant_admin` or `system_admin` roles can manage images
- Images are tenant-scoped (cannot access other tenants' libraries)

## Validation

- Same validation as current uploads (size limits, allowed formats, magic numbers)
- Name: 1-100 characters, trimmed
- Limit: Consider max images per tenant (e.g., 50)

## Migration

No migration needed - existing uploaded logos/favicons continue to work. The library is additive.

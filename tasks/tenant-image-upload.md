# Tenant Image Upload Feature

## Overview

Add image upload functionality to the Tenant Editor Modal, allowing system admins to upload logo and favicon images directly instead of requiring pre-hosted URLs.

## Current State

**Tenant Editor Modal** (`webapp-v2/src/components/admin/TenantEditorModal.tsx`):
- Logo URL: Text input requiring URL string (http://, https://, or path starting with /)
- Favicon URL: Text input (optional) for URL string
- No file upload capability
- Validation enforces URL format

**Firebase Storage**:
- ✅ Already configured and running (port 8006 in emulator)
- ✅ Storage rules exist (`firebase/storage.rules`)
- ✅ Storage wrapper and utilities exist (`firebase/functions/src/storage-wrapper.ts`)
- ✅ Theme artifacts already use Storage (see `ThemeArtifactStorage.ts`)
- ⚠️ Commented-out tenant-assets rules exist but not active (lines 16-20 in storage.rules)

## Requirements

### User Story
As a system admin, I want to upload logo and favicon images directly in the tenant editor, so I don't need to pre-host images elsewhere or manually copy file paths.

### Acceptance Criteria
1. Tenant editor displays file upload UI for logo and favicon
2. Users can drag-and-drop or click to browse for image files
3. Preview of uploaded image appears before saving
4. Images are validated (format, size, dimensions)
5. Images are uploaded to Firebase Storage on save
6. Uploaded image URLs are stored in tenant branding config
7. Old images are deleted when replaced (cleanup)
8. Works in both emulator (local dev) and production
9. All existing tests continue to pass
10. New tests verify upload functionality

## Architecture

### Storage Structure
```
/tenant-assets/{tenantId}/logo-{timestamp}.{ext}
/tenant-assets/{tenantId}/favicon-{timestamp}.{ext}
```

### Flow
1. **User selects file** → Preview shown in modal
2. **User clicks Save** → Image uploaded to Storage → URL returned → Tenant saved with URL
3. **On update** → New image uploaded → Old image deleted → Tenant updated

### Components Affected

#### Backend (Firebase Functions)
1. **New API Endpoint**: `POST /api/admin/tenants/{tenantId}/upload-image`
   - Request: multipart/form-data with image file
   - Query params: `type=logo|favicon`
   - Response: `{ url: string }` (public Storage URL)
   - Authorization: System Admin only
   - Validation: file type (png, jpg, svg, ico, webp), max size (2MB for logo, 512KB for favicon)

2. **New Service**: `TenantAssetStorage` (modeled after `ThemeArtifactStorage`)
   - `uploadLogo(tenantId, file)` → returns public URL
   - `uploadFavicon(tenantId, file)` → returns public URL
   - `deleteAsset(url)` → cleanup old assets
   - Uses Firebase Storage with proper path structure
   - Generates public URLs (same pattern as theme artifacts)

3. **Storage Rules Update**: Uncomment and activate tenant-assets rules
   ```
   match /tenant-assets/{tenantId}/{file} {
     allow read: if true;  // Public read for all tenant assets
     allow write: if false; // Only Cloud Functions can write
   }
   ```

4. **Schema Updates**: Add types to shared package
   - `UploadTenantImageRequest` (FormData wrapper type)
   - `UploadTenantImageResponse` (with URL)
   - Add to `AdminAPI` interface

#### Frontend (Webapp)
1. **New Component**: `ImageUploadField` (reusable)
   - Props: `label`, `value` (URL), `onChange`, `accept`, `maxSize`, `preview`
   - Features:
     - Drag-and-drop zone
     - Click to browse
     - Image preview (shows current URL or uploaded file)
     - Validation feedback (file type, size)
     - Remove/clear button
     - Loading state during upload
   - Located: `webapp-v2/src/components/ui/ImageUploadField.tsx`

2. **Update TenantEditorModal**:
   - Replace Logo URL text input with `ImageUploadField`
   - Replace Favicon URL text input with `ImageUploadField`
   - Keep "Use URL instead" toggle to allow manual URL entry (for external images)
   - Handle file upload on save (upload files first, then save tenant with URLs)
   - Show upload progress
   - Handle errors (upload failures, network issues)

3. **Update ApiClient**:
   - Add `uploadTenantImage(tenantId, file, type)` method
   - Uses `FormData` for multipart upload
   - Returns uploaded image URL

4. **UI/UX Considerations**:
   - Clear indication of which image is logo vs favicon
   - Preview dimensions hint (e.g., "Recommended: 200x200px")
   - Visual feedback during upload (progress bar or spinner)
   - Error messages for validation failures
   - Graceful fallback if upload fails (keep existing URL)

### File Validation

**Logo**:
- Formats: PNG, JPG, JPEG, SVG, WEBP
- Max size: 2MB
- Recommended dimensions: 200x200px to 512x512px
- Aspect ratio: preferably square

**Favicon**:
- Formats: ICO, PNG, SVG
- Max size: 512KB
- Recommended dimensions: 16x16, 32x32, 48x48 (ICO with multiple sizes ideal)

## Implementation Plan

### Phase 1: Backend Foundation
**Goal**: Create storage infrastructure and API endpoint

1. ✅ **Verify Storage Setup**
   - Confirm Storage emulator running
   - Check storage.rules for tenant-assets path
   - Test basic Storage operations

2. **Create TenantAssetStorage Service**
   - Location: `firebase/functions/src/services/storage/TenantAssetStorage.ts`
   - Implement upload methods (logo, favicon)
   - Implement delete method
   - Generate public URLs (handle emulator vs production)
   - Unit tests: `firebase/functions/src/__tests__/unit/services/storage/TenantAssetStorage.test.ts`

3. **Add Schema Types**
   - Location: `shared/src/api/admin.ts`
   - `UploadTenantImageRequest` type
   - `UploadTenantImageResponse` type
   - Add validation schemas

4. **Create Upload Endpoint**
   - Location: `firebase/functions/src/api/admin/tenants/upload-image.ts`
   - Route: `POST /api/admin/tenants/:tenantId/upload-image?type=logo|favicon`
   - Use `busboy` or `multer` for multipart parsing
   - Authorization: system admin only
   - File validation (type, size)
   - Unit tests: `firebase/functions/src/__tests__/unit/api/admin/upload-image.test.ts`
   - Integration tests: `firebase/functions/src/__tests__/integration/admin-upload-image.test.ts`

5. **Update Storage Rules**
   - Uncomment tenant-assets rules in `firebase/storage.rules`
   - Deploy/restart emulator to apply

### Phase 2: Frontend UI Components
**Goal**: Build reusable upload component

1. **Create ImageUploadField Component**
   - Location: `webapp-v2/src/components/ui/ImageUploadField.tsx`
   - Drag-and-drop support
   - File validation (client-side)
   - Image preview
   - Loading states
   - Error handling
   - Unit tests: `webapp-v2/src/components/ui/__tests__/ImageUploadField.test.tsx`

2. **Export from UI Index**
   - Add to `webapp-v2/src/components/ui/index.ts`

### Phase 3: Integrate into Tenant Editor
**Goal**: Replace URL inputs with upload fields

1. **Update ApiClient**
   - Location: `webapp-v2/src/app/apiClient.ts`
   - Add `uploadTenantImage(tenantId, file, type)` method
   - Add to `AdminAPI` interface implementation

2. **Update TenantEditorModal**
   - Location: `webapp-v2/src/components/admin/TenantEditorModal.tsx`
   - Add state for pending file uploads
   - Replace logo URL input with ImageUploadField
   - Replace favicon URL input with ImageUploadField
   - Add "Use URL instead" toggle (allow manual URL entry)
   - Update handleSave to upload files first
   - Show upload progress/errors
   - Handle mixed mode (file upload + manual URL)

3. **Update Existing Tests**
   - Update tests that interact with logo/favicon inputs
   - Location: `webapp-v2/src/__tests__/integration/playwright/tenant-editor-modal.test.ts`
   - Add tests for file upload scenarios

### Phase 4: Testing & Validation
**Goal**: Comprehensive test coverage

1. **Unit Tests**
   - TenantAssetStorage upload/delete logic
   - File validation functions
   - ImageUploadField component behavior
   - ApiClient upload method

2. **Integration Tests (Backend)**
   - Upload endpoint authorization
   - File type validation
   - File size validation
   - Storage operations (upload, URL generation)
   - Error scenarios (invalid file, missing auth, etc.)

3. **Playwright Tests (Frontend)**
   - Upload logo via drag-and-drop
   - Upload favicon via file picker
   - Preview uploaded image
   - Validation error messages
   - Save tenant with uploaded images
   - Toggle between upload and manual URL
   - Edit existing tenant (replace images)

4. **E2E Scenarios**
   - Create tenant with uploaded logo
   - Update tenant logo
   - Verify old logo is deleted
   - Verify public URL access to images
   - Test in emulator and staging

### Phase 5: Cleanup & Polish
**Goal**: Production-ready feature

1. **Image Cleanup**
   - Implement background job to clean orphaned images
   - Delete old images when tenant is deleted
   - Delete old images when new image replaces it

2. **Error Handling**
   - Network errors during upload
   - Storage quota exceeded
   - Invalid file types
   - Corrupt image files

3. **Performance**
   - Optimize image preview (use URL.createObjectURL)
   - Add upload progress indicator
   - Lazy load images in tenant list

4. **Documentation**
   - Update API documentation
   - Add developer guide for image uploads
   - User guide for admins (how to upload images)

## Technical Decisions

### Why Firebase Storage?
- Already configured and running
- Integrated with Firebase ecosystem
- Automatic public URL generation
- Works seamlessly with emulator
- No additional infrastructure needed

### Why Not Store Images in Firestore?
- Firestore has 1MB document limit
- Storage is designed for binary data
- Better performance for serving images
- Separate concerns (metadata vs binary)

### File Upload Library (Backend)
**Option 1: busboy** (Recommended)
- Low-level, streams-based
- Works well with Firebase Functions
- No dependencies
- Widely used

**Option 2: multer**
- Higher-level, easier API
- More memory-intensive
- May have issues with Cloud Functions

**Decision**: Use `busboy` for better control and lower memory footprint

### File Upload Library (Frontend)
**Native HTML5 File API**
- No dependencies needed
- Modern browser support
- Works with drag-and-drop
- Direct integration with FormData

**Decision**: Use native APIs, no additional libraries

### Image Preview Strategy
**Client-side with URL.createObjectURL()**
- Instant preview before upload
- No network request
- Memory-efficient
- Standard browser API

## Security Considerations

1. **Authentication**: Only system admins can upload
2. **Authorization**: Tenant ID validated against admin permissions
3. **File Validation**: Strict MIME type and size checks
4. **Storage Rules**: Cloud Functions only can write, public can read
5. **Path Isolation**: Each tenant's images in separate folder
6. **Filename Safety**: Sanitize filenames, use timestamps to avoid collisions
7. **Rate Limiting**: Consider adding upload rate limits (future)

## Rollback Plan

If issues arise:
1. Remove upload endpoint from API routes
2. Restore text input fields in TenantEditorModal
3. Comment out tenant-assets storage rules
4. Keep TenantAssetStorage service for future use

Old functionality (manual URL entry) remains available via toggle.

## Estimated Complexity

- **Backend**: Medium (new service, endpoint, storage rules)
- **Frontend**: Medium (reusable component, state management, preview)
- **Testing**: Medium (multiple test levels, file upload scenarios)
- **Overall**: Medium-Large (~2-3 days of focused work)

## Dependencies

### Backend
- `busboy` - multipart form parsing (install in functions package)
- Firebase Admin SDK Storage (already installed)

### Frontend
- No new dependencies (use native File API)
- Existing UI components (Button, Input, Modal)

## Success Metrics

1. System admins can upload images without external hosting
2. Image uploads complete in <5 seconds
3. All existing tests pass
4. New tests achieve >90% coverage for new code
5. No security vulnerabilities introduced
6. Zero impact on non-admin users

## Future Enhancements

1. **Image Optimization**: Resize/compress images server-side
2. **CDN Integration**: Serve images via CDN for better performance
3. **Batch Upload**: Upload multiple assets at once
4. **Asset Library**: Browse and reuse uploaded images across tenants
5. **Image Cropping**: Built-in crop tool before upload
6. **Format Conversion**: Auto-convert to optimal format (e.g., WebP)
7. **Lazy Loading**: Only load images when visible in tenant list

## References

- Firebase Storage Docs: https://firebase.google.com/docs/storage
- busboy: https://github.com/mscdex/busboy
- MDN File API: https://developer.mozilla.org/en-US/docs/Web/API/File
- MDN Drag and Drop: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

---

**Status**: ⏳ Planned (Not Started)
**Priority**: Medium
**Assigned**: TBD
**Estimated Time**: 2-3 days

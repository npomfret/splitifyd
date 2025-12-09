# Support uploading of receipts as images to expenses

This task is to allow users to upload an image of a receipt and attach it to an expense.

## Requirements

- Users should be able to upload an image file (JPEG, PNG, WebP) when creating or editing an expense
- The uploaded image should be stored securely with **authenticated access only** (group members only)
- The receipt image should be displayed on the expense details page
- There should be a way to delete the uploaded receipt image
- Max file size: 10 MB
- When editing an expense, the receipt should carry over to the new version automatically

## Existing Infrastructure

The codebase already has:
- `receiptUrl` field in `Expense` interface, `CreateExpenseRequest`, and `ExpenseDocumentSchema`
- Image validation utilities in `firebase/functions/src/utils/validation/imageValidation.ts`
- Binary upload middleware pattern (used by tenant image uploads)
- File upload UI pattern in `TenantImageLibrary.tsx`
- Storage service pattern in `TenantAssetStorage.ts`

## Architecture: Proxy-Based Authenticated Access

Since receipts require authentication (only group members can view), we use a **proxy endpoint** pattern:
1. Store receipts in Firebase Storage (private, no public read)
2. Serve receipts via `GET /groups/:groupId/receipts/:receiptId` endpoint
3. Endpoint verifies group membership, then streams the file

This avoids signed URL complexity and works with existing auth middleware.

---

## Implementation Plan

### Phase 1: Backend Storage Layer

#### 1.1 Create ReceiptStorageService
**New file:** `firebase/functions/src/services/storage/ReceiptStorageService.ts`

Follow `TenantAssetStorage.ts` pattern:
- `uploadReceipt(groupId, buffer, contentType)` → returns `{ receiptId, contentType, sizeBytes }`
- `getReceipt(groupId, receiptId)` → returns `{ buffer, contentType }` or throws NOT_FOUND
- `deleteReceipt(groupId, receiptId)` → deletes from storage
- `buildReceiptUrl(groupId, receiptId)` → builds API proxy URL (not storage URL)

Storage path: `receipts/{groupId}/{receiptId}.{ext}`

#### 1.2 Update Storage Security Rules
**File:** `firebase/storage.rules`

Add receipt rule (deny public read, Cloud Functions only):
```
match /receipts/{groupId}/{receiptId} {
  allow read, write: if false;  // Only service account
}
```

#### 1.3 Add Receipt Image Validation
**File:** `firebase/functions/src/utils/validation/imageValidation.ts`

Add `validateReceiptImage()`:
- Max size: 10 MB
- Allowed types: image/jpeg, image/png, image/webp
- Magic number validation (reuse existing)

### Phase 2: Backend API Endpoints

#### 2.1 Create Receipt Handlers
**New file:** `firebase/functions/src/receipts/handlers.ts`

**`uploadReceipt`** (POST /groups/:groupId/receipts)
- Auth: `authenticate` middleware
- Verify user is group member
- Validate image (size, type, magic numbers)
- Upload to storage
- Return `{ receiptId, url, contentType, sizeBytes }`
- URL format: `/api/groups/{groupId}/receipts/{receiptId}`

**`getReceipt`** (GET /groups/:groupId/receipts/:receiptId)
- Auth: `authenticate` middleware
- Verify user is group member
- Stream file from storage with correct Content-Type
- Cache headers for browser caching

**`deleteReceipt`** (DELETE /groups/:groupId/receipts/:receiptId)
- Auth: `authenticate` middleware
- Verify user is group member with expense edit permission
- Delete from storage
- Return 204

#### 2.2 Register Routes
**File:** `firebase/functions/src/routes/route-config.ts`

```typescript
{ method: 'POST', path: '/groups/:groupId/receipts', handler: 'uploadReceipt', middleware: ['authenticate'], skipContentTypeValidation: true }
{ method: 'GET', path: '/groups/:groupId/receipts/:receiptId', handler: 'getReceipt', middleware: ['authenticate'] }
{ method: 'DELETE', path: '/groups/:groupId/receipts/:receiptId', handler: 'deleteReceipt', middleware: ['authenticate'] }
```

#### 2.3 Update Middleware for Binary Upload
**File:** `firebase/functions/src/utils/middleware.ts`

Add receipt upload route to raw parser condition.

#### 2.4 Add Shared Types
**File:** `packages/shared/src/shared-types.ts`

```typescript
export interface ReceiptUploadResponse {
    receiptId: string;
    url: string;
    contentType: string;
    sizeBytes: number;
}
```

### Phase 3: Frontend API Client

**File:** `webapp-v2/src/app/apiClient.ts`

Add methods:
- `uploadReceipt(groupId, file)` → binary upload with file.type as Content-Type
- `deleteReceipt(groupId, receiptId)` → DELETE request

### Phase 4: Frontend Expense Form Store

**File:** `webapp-v2/src/app/stores/expense-form-store.ts`

Add state:
- `#receiptFileSignal: Signal<File | null>`
- `#receiptUrlSignal: Signal<string | null>`
- `#receiptUploadingSignal: Signal<boolean>`
- `#receiptErrorSignal: Signal<string | null>`

Add methods:
- `setReceiptFile(file)` / `clearReceipt()`
- `uploadReceiptIfNeeded(groupId)` - uploads file, returns URL

Update `saveExpense()` and `updateExpense()`:
- Call `uploadReceiptIfNeeded()` before API call
- Include `receiptUrl` in request

Update `initializeForEdit()`:
- Set `receiptUrl` from existing expense (carry-over)

### Phase 5: Frontend UI Components

#### 5.1 ReceiptUploader Component
**New file:** `webapp-v2/src/components/expense-form/ReceiptUploader.tsx`

- Hidden file input with accept="image/jpeg,image/png,image/webp"
- Preview thumbnail (File or URL)
- Remove button
- Client-side validation (size, type)
- Error display

#### 5.2 ReceiptDisplay Component
**New file:** `webapp-v2/src/components/expense/ReceiptDisplay.tsx`

- Thumbnail with click-to-expand
- "View full" link (opens in new tab)
- Remove button (if permitted)

#### 5.3 Integration
- Add `<ReceiptUploader>` to `ExpenseFormModal.tsx`
- Add `<ReceiptDisplay>` to `ExpenseDetailPage.tsx`

#### 5.4 Translations
**File:** `webapp-v2/src/locales/en/translation.json`

Add `expense.receipt.*` keys.

### Phase 6: Testing

**Unit Tests:**
- `ReceiptStorageService.test.ts` - upload, get, delete, path building
- `receipts/handlers.test.ts` - auth, validation, membership checks

**API Integration Tests:**
- Upload/get/delete receipt
- Create expense with receiptUrl
- Edit expense carries over receipt

**Playwright Tests:**
- Add receipt when creating expense
- View/remove/replace receipt

---

## Files to Modify/Create

| Action | File |
|--------|------|
| Create | `firebase/functions/src/services/storage/ReceiptStorageService.ts` |
| Create | `firebase/functions/src/receipts/handlers.ts` |
| Modify | `firebase/functions/src/routes/route-config.ts` |
| Modify | `firebase/functions/src/utils/middleware.ts` |
| Modify | `firebase/storage.rules` |
| Modify | `firebase/functions/src/utils/validation/imageValidation.ts` |
| Modify | `packages/shared/src/shared-types.ts` |
| Modify | `packages/shared/src/api.ts` |
| Modify | `packages/shared/src/schemas/apiSchemas.ts` |
| Modify | `webapp-v2/src/app/apiClient.ts` |
| Modify | `webapp-v2/src/app/stores/expense-form-store.ts` |
| Create | `webapp-v2/src/components/expense-form/ReceiptUploader.tsx` |
| Create | `webapp-v2/src/components/expense/ReceiptDisplay.tsx` |
| Modify | `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx` |
| Modify | `webapp-v2/src/pages/ExpenseDetailPage.tsx` |
| Modify | `webapp-v2/src/locales/en/translation.json` |

---

## Task Breakdown

- [ ] **Backend:** Create `ReceiptStorageService` following `TenantAssetStorage` pattern
- [ ] **Backend:** Add `validateReceiptImage()` function (10MB, JPEG/PNG/WebP)
- [ ] **Backend:** Update Firebase Storage security rules
- [ ] **Backend:** Create receipt handlers (upload, get, delete)
- [ ] **Backend:** Register routes and update middleware for binary upload
- [ ] **Shared:** Add `ReceiptUploadResponse` type and API interface methods
- [ ] **Frontend:** Add `uploadReceipt`/`deleteReceipt` to apiClient
- [ ] **Frontend:** Update expense-form-store with receipt state/methods
- [ ] **Frontend:** Create `ReceiptUploader` component
- [ ] **Frontend:** Create `ReceiptDisplay` component
- [ ] **Frontend:** Integrate into ExpenseFormModal and ExpenseDetailPage
- [ ] **Frontend:** Add translations
- [ ] **Testing:** Unit tests for storage service and handlers
- [ ] **Testing:** API integration tests
- [ ] **Testing:** Playwright UI tests

# File Attachments: Expense Receipts + Comment Attachments

This task implements file upload capabilities for both expenses (receipts) and comments (attachments) using shared infrastructure.

## Requirements

### Expense Receipts
- Single image attachment per expense
- Image types: JPEG, PNG, WebP
- Max file size: 10MB
- Field `receiptUrl` already exists in ExpenseDTO
- Receipt display UI already implemented in ExpenseDetailModal

### Comment Attachments
- Up to 3 attachments per comment
- File types: JPEG, PNG, WebP, PDF
- Max file size: 5MB per file
- Need new `attachments` field in CommentDTO

### Shared Requirements
- **Authenticated access only** - group members can view
- Proxy endpoint pattern (not signed URLs)
- Magic number validation for file type verification

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Comment attachment retention** | Delete immediately when comment deleted | Simpler implementation, saves storage costs |
| **Receipt replacement** | Delete old receipt immediately when new one uploaded | Saves storage, no audit trail needed |
| **Expense deletion** | Delete receipt immediately when expense deleted | Consistent with other deletion behavior |
| **Max attachments per comment** | 3 files | Balance between usability and storage |

## Architecture: Proxy-Based Authenticated Access

Since attachments require authentication (only group members can view), we use a **proxy endpoint** pattern:

1. Store files in Firebase Storage (private, no public read)
2. Serve files via `GET /groups/:groupId/attachments/:attachmentId` endpoint
3. Endpoint verifies group membership, then streams the file

This avoids signed URL complexity and works with existing auth middleware.

**Storage path:** `attachments/{groupId}/{attachmentId}.{ext}`

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Types (packages/shared/src/shared-types.ts)

```typescript
// Branded type
export type AttachmentId = Brand<string, 'AttachmentId'>;
export const toAttachmentId = (value: string): AttachmentId => value as AttachmentId;

// Attachment DTO
export interface AttachmentDTO {
    id: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
}

// Upload response
export interface UploadAttachmentResponse {
    attachment: AttachmentDTO;
    url: string;  // Proxy URL
}

// Comment attachment reference
export interface CommentAttachmentRef {
    attachmentId: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
}

// Update Comment interface
interface Comment {
    // ...existing fields
    attachments?: CommentAttachmentRef[];  // 0-3 attachments
}

// Update CreateComment requests
export interface CreateGroupCommentRequest extends BaseCreateCommentRequest {
    groupId: GroupId;
    attachmentIds?: AttachmentId[];
}
```

#### 1.2 GroupAttachmentStorage Service

**File:** `firebase/functions/src/services/storage/GroupAttachmentStorage.ts`

Follow `TenantAssetStorage.ts` pattern:
- `uploadAttachment(groupId, attachmentId, buffer, contentType)` - uploads to storage
- `getAttachmentStream(groupId, attachmentId)` - returns readable stream
- `deleteAttachment(groupId, attachmentId)` - deletes from storage

#### 1.3 Attachment Validation

**File:** `firebase/functions/src/utils/validation/attachmentValidation.ts`

- `validateReceiptUpload(buffer, contentType)` - 10MB, images only
- `validateCommentAttachment(buffer, contentType)` - 5MB, images + PDF
- Add PDF magic number: `[0x25, 0x50, 0x44, 0x46]` (%PDF)

#### 1.4 Storage Security Rules

**File:** `firebase/storage.rules`

```
match /attachments/{groupId}/{attachmentId} {
  allow read, write: if false;  // Only service account
}
```

### Phase 2: Backend API Endpoints

#### 2.1 Attachment Handlers

**File:** `firebase/functions/src/attachments/AttachmentHandlers.ts`

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /groups/:groupId/attachments` | uploadAttachment | Upload file |
| `GET /groups/:groupId/attachments/:attachmentId` | getAttachment | Proxy stream |
| `DELETE /groups/:groupId/attachments/:attachmentId` | deleteAttachment | Delete file |

#### 2.2 Route Registration

**File:** `firebase/functions/src/routes/route-config.ts`

```typescript
{ method: 'POST', path: '/groups/:groupId/attachments', handler: 'uploadAttachment', middleware: ['authenticate'], skipContentTypeValidation: true }
{ method: 'GET', path: '/groups/:groupId/attachments/:attachmentId', handler: 'getAttachment', middleware: ['authenticate'] }
{ method: 'DELETE', path: '/groups/:groupId/attachments/:attachmentId', handler: 'deleteAttachment', middleware: ['authenticate'] }
```

#### 2.3 Middleware Update

**File:** `firebase/functions/src/utils/middleware.ts`

Add `/groups/:groupId/attachments` to raw parser condition.

### Phase 3: Comment Schema Updates

#### 3.1 Firestore Schema

**File:** `firebase/functions/src/schemas/comment.ts`

Add `attachments` field (array of `CommentAttachmentRefSchema`, max 3).

#### 3.2 Response Schema

**File:** `packages/shared/src/schemas/apiSchemas.ts`

Update `CommentSchema` to include `attachments` field.

#### 3.3 CommentService Updates

**File:** `firebase/functions/src/services/CommentService.ts`

- Accept `attachmentIds` in create methods
- Validate IDs exist and belong to group
- Store attachment refs in comment document
- **On comment delete**: Delete associated attachments from storage immediately

### Phase 4: Frontend API Client

**File:** `webapp-v2/src/app/apiClient.ts`

```typescript
uploadAttachment(groupId, file): Promise<UploadAttachmentResponse>
deleteAttachment(groupId, attachmentId): Promise<void>
getAttachmentUrl(groupId, attachmentId): string
```

### Phase 5: Frontend Expense Receipt UI

#### 5.1 ReceiptUploader Component

**File:** `webapp-v2/src/components/expense-form/ReceiptUploader.tsx`

- File input: `accept="image/jpeg,image/png,image/webp"`
- Preview thumbnail
- Client-side validation (10MB, image types)
- Remove button

#### 5.2 Expense Form Store Updates

**File:** `webapp-v2/src/app/stores/expense-form-store.ts`

- `#receiptFileSignal: Signal<File | null>`
- `#receiptUrlSignal: Signal<string | null>`
- `uploadReceiptIfNeeded(groupId)` - uploads before save
- Update `saveExpense()` / `updateExpense()` to include receiptUrl
- **On receipt replacement**: Delete old receipt from storage immediately when new one is uploaded

#### 5.3 ExpenseFormModal Integration

**File:** `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx`

Add `<ReceiptUploader>` component.

### Phase 6: Frontend Comment Attachment UI

#### 6.1 AttachmentUploader Component

**File:** `webapp-v2/src/components/comments/AttachmentUploader.tsx`

- File input: `accept="image/jpeg,image/png,image/webp,application/pdf"`
- Support multiple files (up to 3)
- Immediate upload on selection
- Progress indicators
- Preview: thumbnail for images, icon for PDFs

#### 6.2 AttachmentDisplay Component

**File:** `webapp-v2/src/components/ui/AttachmentDisplay.tsx`

- Image: thumbnail with click-to-expand modal
- PDF: download link or embedded viewer
- Grid layout for multiple attachments

#### 6.3 Comment Component Updates

| File | Changes |
|------|---------|
| `CommentInput.tsx` | Add `<AttachmentUploader>`, send attachmentIds on submit |
| `CommentItem.tsx` | Add `<AttachmentDisplay>` for comment.attachments |

### Phase 7: Testing

#### Unit Tests
- `GroupAttachmentStorage.test.ts` - upload, get, delete
- `attachment-endpoints.test.ts` - auth, validation, membership
- `attachmentValidation.test.ts` - size, type, magic numbers

#### Playwright Tests
- `expense-receipt.test.ts` - add/view/replace receipt
- `comment-attachments.test.ts` - add/view 1-3 attachments

---

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `firebase/functions/src/services/storage/GroupAttachmentStorage.ts` | Storage service |
| `firebase/functions/src/attachments/AttachmentHandlers.ts` | HTTP handlers |
| `firebase/functions/src/attachments/validation.ts` | Request validation |
| `firebase/functions/src/utils/validation/attachmentValidation.ts` | File validation |
| `webapp-v2/src/components/expense-form/ReceiptUploader.tsx` | Receipt upload UI |
| `webapp-v2/src/components/comments/AttachmentUploader.tsx` | Comment attachment UI |
| `webapp-v2/src/components/ui/AttachmentDisplay.tsx` | Attachment display |

### Modify

| File | Changes |
|------|---------|
| `packages/shared/src/shared-types.ts` | AttachmentId, AttachmentDTO, CommentAttachmentRef, update Comment |
| `packages/shared/src/api.ts` | Add upload/delete attachment methods |
| `packages/shared/src/schemas/apiSchemas.ts` | UploadAttachmentResponseSchema, update CommentSchema |
| `firebase/functions/src/schemas/comment.ts` | Add attachments field |
| `firebase/functions/src/services/CommentService.ts` | Handle attachmentIds |
| `firebase/functions/src/comments/validation.ts` | Validate attachmentIds |
| `firebase/functions/src/routes/route-config.ts` | Register new routes |
| `firebase/functions/src/utils/middleware.ts` | Raw parser for /attachments |
| `firebase/functions/src/ApplicationFactory.ts` | Wire AttachmentHandlers |
| `firebase/storage.rules` | Add attachments rule |
| `webapp-v2/src/app/apiClient.ts` | Add upload methods |
| `webapp-v2/src/app/stores/expense-form-store.ts` | Receipt state |
| `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx` | Add ReceiptUploader |
| `webapp-v2/src/components/comments/CommentInput.tsx` | Add AttachmentUploader |
| `webapp-v2/src/components/comments/CommentItem.tsx` | Add AttachmentDisplay |
| `webapp-v2/src/locales/en/translation.json` | Add attachment i18n keys |

---

## Task Breakdown

- [x] **Phase 1**: Core types, storage service, validation, security rules
- [x] **Phase 2**: Backend upload/get/delete endpoints
- [ ] **Phase 3**: Comment schema + service updates for attachments
- [ ] **Phase 4**: Frontend API client methods
- [ ] **Phase 5**: Expense receipt upload UI
- [ ] **Phase 6**: Comment attachment upload/display UI
- [ ] **Phase 7**: Unit tests and Playwright tests

## Progress Notes

- Core scaffolding exists: shared attachment types/schemas added, validation helpers (magic number + size checks) implemented with unit tests, storage rules lock down `/attachments/**`, and `GroupAttachmentStorage` has a tested upload/delete implementation (proxy streaming only works via Firebase Admin path).
- API contracts and clients partially extended: `api.ts`, `apiSchemas`, and `apiClient`/`ApiDriver` accept `attachmentIds` on comments and expose upload/delete methods; `AppDriver` still throws for attachment calls.
- Backend endpoints now live: attachment handlers (upload/stream/delete) are wired via `ApplicationFactory` + route-config, with middleware raw parsing for binary bodies and membership validation. Uploads validate content/magic numbers, store to Storage with metadata, return proxy URL, support stub streaming for unit tests, and delete resolves by ID. `AppDriver` now drives these endpoints for tests. Comment schema/service/UI wiring is still TODO for later phases.

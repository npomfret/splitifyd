# Firebase HTTP API Surface

_Source: `firebase/functions/src/index.ts` (Express app inside the `api` HTTPS function). All routes are served beneath the `api` Cloud Function; Hosting rewrites add a `/api` prefix that is stripped by middleware before routing._

## Security Conventions

### Authentication Middleware
- **`authenticate`** – Verifies Firebase ID token from `Authorization: Bearer <token>` header. On success, fetches the user document from Firestore and attaches `req.user` with `{ uid, displayName, role }`.
- **`authenticateAdmin`** – Calls `authenticate`, then additionally checks `req.user.role === 'system_admin'`. Returns `403 FORBIDDEN` if the user lacks admin privileges.
- **No middleware** – Endpoint is public unless explicitly gated by environment checks or other guards.

### Admin Role Storage
- **Application-specific implementation**: The `role` field is custom application logic, not a Firebase/Firestore built-in feature. We created this authorization system ourselves.
- **Storage location**: Firestore collection `users/{userId}` with an optional `role?: string` field.
- **Role values**: `'system_admin'` (grants admin access) or undefined (regular user with no admin privileges).
- **Setting the role**:
  - Dev/test: Any authenticated user can self-promote via `/test/user/promote-to-admin` endpoint.
  - Production: Use `firebase/scripts/promote-user-to-admin.ts` script or manually update the Firestore document.
- **Authorization check**: The `authenticateAdmin` middleware reads this field from Firestore on every request and checks `role === 'system_admin'`.

### Response Format
- All responses are JSON unless noted; error payloads follow the `{ error: { code, message, … } }` shape when thrown via `ApiError`.

## Public Utility Endpoints
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/metrics` | Lightweight metrics snapshot from in-memory sampler. | Public | None. | `200` JSON from `toAggregatedReport` containing aggregated metrics + raw counts. |
| GET | `/config` | Client bootstrap configuration (Firebase + env flags). | Public | None. | `200` JSON from `getEnhancedConfigResponse` (`ClientConfigResponse`). |
| POST | `/csp-violation-report` | Receives_browser CSP reports for logging. | Public | Body: CSP report JSON (`application/csp-report` or JSON). | `204` empty on success; `500` JSON error if logging fails. |
| GET | `/policies/:id/current` | Current public policy version. | Public | Path param `id` = policy slug. | `200` JSON policy payload (`CurrentPolicyResponse`). |

## Emulator/Test-only Endpoints (available only when `getConfig().isProduction === false`)
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/test-pool/borrow` | Borrow a pre-seeded test user from the pool. | Public (emulator only; `isEmulator()` guard). | None. | `200` JSON test user credentials; `403/500` JSON on failure. |
| POST | `/test-pool/return` | Return a borrowed test user. | Public (emulator only). | Body `{ email: string }`. | `200` JSON `{ message, email }`; `400/500` on errors. |
| POST | `/test/user/clear-policy-acceptances` | Clear current user’s policy acceptances. | Requires Bearer token in Authorization header; only non-prod. | Header `Authorization: Bearer <token>`. | `200` `{ success, message }`; `401/403` JSON on failure. |
| POST | `/test/user/promote-to-admin` | Promote the caller to admin role. | Requires Bearer token; only non-prod. | Header `Authorization: Bearer <token>`. | `200` `{ success, message, userId }`; `401/403` JSON on failure. |

## User & Authentication
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/register` | Create a new user account. | Public | Body `UserRegistration` (see `UserService2.validateRegisterRequest`). | `201` JSON `RegisterUserResult` (`{ success, message, user }`). |
| POST | `/user/policies/accept-multiple` | Accept multiple policy versions in one call. | `authenticate` | Body with `acceptances[]` validated by `validateAcceptMultiplePolicies`. | `200` `{ success, message, acceptedPolicies }`. |
| GET | `/user/policies/status` | Fetch user’s outstanding/accepted policies. | `authenticate` | Query optional. | `200` JSON from `UserPolicyService.getUserPolicyStatus`. |
| GET | `/user/profile` | Fetch current user profile metadata (display name, role). | `authenticate` | None. | `200` `{ displayName, role }`. |
| PUT | `/user/profile` | Update profile (display name, locale, theme, etc.). | `authenticate` | Body handled by `UserService.updateProfile` (JSON). | `200` updated `RegisteredUser` subset. |
| POST | `/user/change-password` | Change password with current password verification. | `authenticate` | Body `{ currentPassword, newPassword, ... }`. | `200` JSON `{ success, message }`. |

## Activity Feed
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/activity-feed` | Paginated activity feed for authenticated user. | `authenticate` | Query params for pagination handled inside `ActivityHandlers`. | `200` JSON feed payload (`ActivityFeedResponse`). |

## Expense Endpoints
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/expenses` | Create expense in a group. | `authenticate` | Body `CreateExpenseRequest` (shared Zod `validateCreateExpense`). | `201` JSON `ExpenseDTO`. |
| PUT | `/expenses` | Update existing expense. | `authenticate` | Query `id` (expenseId); body `UpdateExpenseRequest`. | `200` JSON updated `ExpenseDTO`. |
| DELETE | `/expenses` | Delete expense (soft delete). | `authenticate` | Query `id` (expenseId). | `200` `{ message }`. |
| GET | `/expenses/:id/full-details` | Consolidated expense details (expense + group context). | `authenticate` | Path `:id`; query for pagination handled in handler. | `200` JSON `ExpenseFullDetailsResponse`. |

## Group & Membership Endpoints
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/groups` | Create group. | `authenticate` | Body `CreateGroupRequest` (shared Zod `validateCreateGroup`). | `201` `GroupDTO`. |
| GET | `/groups` | List caller’s groups with pagination/filter. | `authenticate` | Query: `limit`, `cursor`, `order`, `statusFilter`. | `200` JSON `{ groups, paging }`. |
| POST | `/groups/share` | Generate shareable join link. | `authenticate` | Body `GenerateShareLinkRequest` (`groupId`, optional `expiresAt`). | `200` `{ linkId, expiresAt, url }`. |
| POST | `/groups/preview` | Preview group by invite link. | `authenticate` | Body `{ linkId }`. | `200` preview payload from `GroupShareService.previewGroupByLink`. |
| POST | `/groups/join` | Join group via invite link. | `authenticate` | Body `{ linkId }`. | `200` join result (`GroupJoinResponse`). |
| GET | `/groups/:id/full-details` | Full group snapshot (members, expenses, settlements, comments). | `authenticate` | Path `:id`; query `expenseLimit`, `expenseCursor`, `settlementLimit`, `settlementCursor`, `includeDeletedExpenses`, `includeDeletedSettlements`, `commentLimit`, `commentCursor`. | `200` composite JSON from `GroupService.getGroupFullDetails`. |
| PUT | `/groups/:id` | Update group metadata. | `authenticate` | Body `UpdateGroupRequest`; path `:id`. | `200` updated `GroupDTO`. |
| DELETE | `/groups/:id` | Delete group. | `authenticate` | Path `:id`. | `200` `{ success, message }`. |
| PATCH | `/groups/:id/security/permissions` | Update per-group permission settings. | `authenticate` | Body validated by `validateUpdateGroupPermissionsRequest`. | `200` JSON { updated permissions }. |
| POST | `/groups/:id/leave` | Leave group. | `authenticate` | Path `:id`. | `200` JSON result (`GroupLeaveResponse`). |
| POST | `/groups/:id/archive` | Archive group for current user. | `authenticate` | Path `:id`. | `200` JSON `{ success, archivedAt }`. |
| POST | `/groups/:id/unarchive` | Remove archive flag for current user. | `authenticate` | Path `:id`. | `200` JSON `{ success }`. |
| PUT | `/groups/:id/members/display-name` | Update caller’s member display name. | `authenticate` | Body `{ displayName }`. | `200` `{ message }`. |
| GET | `/groups/:id/members/pending` | List pending join requests. | `authenticate` | Path `:id`. | `200` `{ members: PendingMemberDTO[] }`. |
| PATCH | `/groups/:id/members/:memberId/role` | Update member role. | `authenticate` | Body `{ role }`. | `200` `{ success }`. |
| POST | `/groups/:id/members/:memberId/approve` | Approve pending member. | `authenticate` | Path params as shown. | `200` `{ success }`. |
| POST | `/groups/:id/members/:memberId/reject` | Reject pending member. | `authenticate` | Path params as shown. | `200` `{ success }`. |
| DELETE | `/groups/:id/members/:memberId` | Remove member. | `authenticate` | Path params as shown. | `200` `{ success }`. |

## Settlements
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/settlements` | Create settlement entry. | `authenticate` | Body `CreateSettlementRequest` (shared Zod `createSettlementSchema`). | `201` `SettlementDTO`. |
| PUT | `/settlements/:settlementId` | Update settlement. | `authenticate` | Path `:settlementId`; body `UpdateSettlementRequest`. | `200` updated `SettlementDTO`. |
| DELETE | `/settlements/:settlementId` | Soft-delete settlement. | `authenticate` | Path `:settlementId`. | `200` `{ message }`. |

## Comments
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/groups/:groupId/comments` | Paginated group comments. | `authenticate` | Query `cursor`, `limit` (default 8). | `200` `{ comments, hasMore, nextCursor }`. |
| POST | `/groups/:groupId/comments` | Create comment on group. | `authenticate` | Body `{ text }` validated by `validateCreateGroupComment`. | `200` `CommentDTO`. |
| GET | `/expenses/:expenseId/comments` | Paginated expense comments. | `authenticate` | Query `cursor`, `limit` (default 8). | `200` `{ comments, hasMore, nextCursor }`. |
| POST | `/expenses/:expenseId/comments` | Create comment on expense. | `authenticate` | Body `{ text }` validated by `validateCreateExpenseComment`. | `200` `CommentDTO`. |

## Admin Policy Management (Admin-only)
| Method | Path | Summary | Security | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/admin/policies` | Create new policy shell + first version. | `authenticateAdmin` | Body validated by shared Zod `validateCreatePolicy` (`{ policyName, text }`). | `201` `CreatePolicyResponse`. |
| GET | `/admin/policies` | List policies and version metadata. | `authenticateAdmin` | None. | `200` policy list result (`PolicyListResponse`). |
| GET | `/admin/policies/:id` | Fetch policy + version history. | `authenticateAdmin` | Path `:id`. | `200` JSON policy record. |
| GET | `/admin/policies/:id/versions/:hash` | Fetch specific version content. | `authenticateAdmin` | Path params `id`, `hash`. | `200` `{ text, metadata }`. |
| PUT | `/admin/policies/:id` | Save draft text; optional publish flag. | `authenticateAdmin` | Body validated by shared Zod `validateUpdatePolicy` (`{ text, publish? }`). | `200` `UpdatePolicyResponse`. |
| POST | `/admin/policies/:id/publish` | Publish a draft version. | `authenticateAdmin` | Body validated by shared Zod `validatePublishPolicy` (`{ versionHash }`). | `200` `PublishPolicyResponse`. |
| DELETE | `/admin/policies/:id/versions/:hash` | Delete archived version. | `authenticateAdmin` | Path params `id`, `hash`. | `200` `DeletePolicyVersionResponse`. |

## Comment on Standalone Diagnostics Functions
- `functions/src/index.ts` also re-exports three independent HTTPS functions backed by separate modules:
  - `health` – GET only; returns `HealthPayload` JSON with service checks and `200/503` status.
  - `status` – GET only; returns runtime snapshot (`timestamp`, uptime, memory, version).
  - `env` – GET only; disabled in production; returns environment + filesystem diagnostics in JSON.

## Fallback
- Any unmatched route returns `404` with `{ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }`.

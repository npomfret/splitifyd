# TSX Inconsistencies Report

## Status: COMPLETED

All identified inconsistencies have been addressed.

---

## Summary of Changes

### 1. HTML Attribute Naming (FIXED)
Fixed 11 attribute naming issues across 4 files:

| File | Changes |
|------|---------|
| `ErrorMessage.tsx` | `class` → `className` |
| `FloatingPasswordInput.tsx` | `class` → `className` (3 instances), `for` → `htmlFor` |
| `AdminPage.tsx` | `class` → `className`, `stroke-linecap/linejoin/width` → camelCase |
| `ColorInput.tsx` | `for` → `htmlFor` (2 instances) |

### 2. Hardcoded Strings (FIXED)
- **TenantBrandingPage.tsx**: Added translations for ~20 strings to `locales/en/translation.json` under `tenantBranding.*` namespace
- **DefaultLoginButton.tsx**: Skipped (dev-only button, not user-facing)

### 3. Icon Library Inconsistency (FIXED)
- **MultiLabelInput.tsx**: Changed from `@heroicons/react/20/solid` (XMarkIcon) to custom `XIcon` from `@/components/ui/icons`

### 4. Deprecated Components/Routes (REMOVED)
Fully removed deprecated admin pages and routes:

**Deleted files:**
- `webapp-v2/src/pages/AdminTenantsPage.tsx`
- `webapp-v2/src/pages/AdminDiagnosticsPage.tsx`

**Updated files:**
- `webapp-v2/src/App.tsx` - Removed lazy imports, route wrappers, and route definitions
- `webapp-v2/src/constants/routes.ts` - Removed `ADMIN_TENANTS` constant
- `packages/test-support/src/page-objects/AdminTenantsPage.ts` - Updated URL to `/admin?tab=tenants`
- `packages/test-support/src/page-objects/AdminDiagnosticsPage.ts` - Updated URL to `/admin?tab=diagnostics`

---

## Verification
- Full build completed successfully (`npm run build`)
- All TypeScript compilation passed
- No errors in any workspace

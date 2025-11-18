# White-Label Debug Runbook

Date: 2025-11-13

## Common Failure Modes
| Symptom | Checks |
| --- | --- |
| FOUC on first paint | 1) Confirm `/api/theme.css` returns 200 + cache headers. 2) Ensure inline base stylesheet tag still exists in `webapp-v2/index.html`. 3) Verify service worker cached latest hash. |
| Wrong tenant colors | 1) `curl -I /api/theme.css` to inspect `X-BillSplit-Tenant`. 2) Check tenant doc `domains.normalized` includes hostname. 3) Re-register fixtures through `POST /api/admin/tenants`. |
| Publish endpoint 500 | 1) Inspect `firebase/functions` logs for `ThemeArtifactService`. 2) Validate Firestore doc against `TenantBrandingSchema` using `npx tsx scripts/validate-tenant.ts tenantId`. |
| CSS not updating | 1) Ensure `theme.css?v=<hash>` query param updated in `index.html`. 2) Invalidate SW cache via diagnostics panel “Force reload”. |

## Diagnostic Commands
```bash
# Inspect tenant document
firebase firestore:documents get tenants/tenant_localhost --project billsplit

# Fetch CSS directly
curl -H "Host: localhost" http://localhost:6005/api/theme.css -v

# Measure CSS payload size
curl -s -H "Host: default.billsplit.dev" http://localhost:6005/api/theme.css | gzip -c | wc -c
```

## Escalation Path
1. **L1 (Dev on-call)** – triage logs, rerun publish flow.
2. **L2 (Design systems)** – validate tokens + assets.
3. **Infra** – only if bucket/CORS/hosting regression suspected.

## Log Streams
- Firebase Functions: `firebase/functions/firebase-debug.log`
- Theme generator logs tagged with `component=theme-artifact`
- Publish endpoint logs include `tenantId`, `hash`, `artifactSizeBytes`

## Rollback Procedure
1. Fetch tenant doc, copy last known good `brandingTokens.artifact.hash`.
2. `firebase firestore:documents update tenants/<id> brandingTokens.artifact.hash=<hash>`
3. Invalidate CDN or bust via new `?v=<hash>`.
4. Notify stakeholders in `#oncall-theme`.

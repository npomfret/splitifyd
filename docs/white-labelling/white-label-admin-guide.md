# White-Label Admin Guide

Date: 2025-11-13  
Audience: Tenant success / customer admin teams

## Goals
- Capture tenant branding (logo, palette, typography, spacing, assets)
- Preview changes safely
- Publish via the manual theme pipeline (artifact hash + `/api/theme.css`)

## Workflow
1. **Open Tenant Branding Console** (future page): `Settings → Branding`.
2. **Edit tokens**
   - Upload logo + favicon (SVG/PNG)
   - Define palette + semantic overrides
   - Adjust typography + spacing scales
3. **Run validations**
   - Client-side: schema + WCAG contrast (auto)
   - Backend: Zod + contrast + asset linting when publishing
4. **Live preview**
   - Click “Preview Theme” to load tokens into component playground iframe.
5. **Publish**
   - Hit “Publish Theme” → calls `POST /api/admin/publishTenantTheme`.
   - Backend regenerates hashed CSS + updates tenant doc with `latestHash`.
6. **Monitor**
   - Publishing modal shows hash + size + Playwright visual regression status.
7. **Rollback**
   - Use “History” tab to reapply any past hash instantly.

## Manual Testing (Local Requirement)
- `localhost` host shows `tenant_localhost` theme.
- `120.0.0.1` host shows `tenant_loopback` theme.
- Unconfigured host → default theme.
- Use `POST /api/admin/tenants` (with localhost/loopback payloads) to register local themes before testing.

## Troubleshooting
| Symptom | Action |
| --- | --- |
| Theme link returns 404 | Ensure publish endpoint ran; check tenant doc `brandingTokens.artifact.hash`. |
| UI shows fallback palette | Verify `/api/theme.css?v=<hash>` is reachable + service worker cached. |
| Publish button disabled | Resolve validation errors (contrast, missing asset) shown inline. |
| Visual regression failed | Review diff artifacts; fix layout or update baseline before retrying publish. |

## Contacts
- **Design Owner:** Dana Lee (`design@billsplit.com`)
- **Dev Steward:** @ui-foundations (Slack)
- **After-hours escalation:** theme-oncall@billsplit.com (Weeks 5–8 rollout)

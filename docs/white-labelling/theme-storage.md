# Theme Storage Bucket Runbook

Date: 2025-11-13

## Purpose
Provision a dedicated Cloud Storage bucket that hosts rendered theme artifacts (`theme.css`, `theme.tokens.json`). Artifacts are immutable, content-hashed, and read publicly, while writes occur only via the backend generator.

## Prerequisites
- `gcloud` CLI ≥ 475
- Access to the `billsplit` (or target) Firebase project
- Service account with `roles/storage.admin`

## Bucket Standards
| Item | Value |
| --- | --- |
| Bucket name | `billsplit-themes` (override via `THEME_BUCKET`) |
| Location | `us-central1` |
| Uniform bucket-level access | Enabled |
| Public access prevention | Enabled (objects are shared via signed origin) |
| IAM | Firebase default service account (`PROJECT_ID@appspot.gserviceaccount.com`) → `roles/storage.objectViewer` |

## CORS Policy
```json
[
  {
    "origin": ["http://localhost:5173", "https://billsplit.com"],
    "method": ["GET"],
    "responseHeader": ["Content-Type", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
```

## Automation Script
Use `scripts/theme-storage/setup.sh` to create the bucket, apply the CORS policy, and grant IAM in one shot:

```bash
PROJECT_ID=billsplit THEME_BUCKET=billsplit-themes ./scripts/theme-storage/setup.sh
```

The script writes the canonical CORS file to `scripts/theme-storage/cors.json`. Re-run anytime to update the policy.

## Verification
1. `gcloud storage buckets describe gs://billsplit-themes` → verify location + UBU.
2. `gsutil cors get gs://billsplit-themes` → matches JSON above.
3. Upload a sample CSS file and `curl` it from localhost to confirm CORS headers.

## Incident Response
- **Unexpected 403s:** confirm IAM binding still exists for the Firebase service account.
- **Stale assets:** CI/CD invalidates Cloud CDN layers automatically (future work). Manual fix: update querystring version parameter.
- **Bucket deleted:** rerun the script, then redeploy theme artifacts.

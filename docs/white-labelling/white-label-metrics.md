# White-Label Baseline Metrics (Pre-Week 1)

Date captured: 2025-11-13 (commit pending)

| Metric | Value / Status | Methodology | Notes |
| --- | --- | --- | --- |
| FOUC rate | **Not instrumented** | RUM/Sentry events do not currently emit a `theme_hydration` marker. | Action: add custom web-vitals probe in Week 1 (owner: FE Platform). |
| Median TTI | **Not measured** | Requires Lighthouse/CrUX data scoped to tenant hosts. | Action: add CI Lighthouse run once `/api/theme.css` pipeline lands (owner: Perf). |
| Inline CSS size in `index.html` | **0 bytes** | `npm run webapp-v2:build` followed by Node script counting inline `<style>` tags in `dist/index.html`. | Confirms all critical styles already external, so bootstrap inline CSS can stay within 1 KB budget. |
| Support tickets referencing theming (90d) | **Data unavailable** | Zendesk/Jira exports live outside repo. | Action: Success team to attach CSV to shared drive and update doc. |

> Until telemetry feeds exist, treat missing values as blockers. Owners + due dates captured in `tasks/white-label-plan-1.md`.

# Performance Evidence

This directory contains captured performance and scalability evidence for the BookRunner application, mapped to the success metrics defined in the project brief.

## Metrics Summary

| Metric | Target | Evidence File(s) | Actual | Status |
|--------|--------|-------------------|--------|--------|
| Avg response time | ≤ 2 seconds | `ramping-summary.json`, `ramping-report.html` | _(run tests to populate)_ | |
| Concurrent users | ≥ 50 | `ramping-summary.json` (ramping-vus scenario) | _(run tests to populate)_ | |
| Throughput | ≥ 20 req/s | `throughput-summary.json` (constant-arrival-rate scenario) | _(run tests to populate)_ | |
| Deployment time | ≤ 5 minutes | `deploy-metrics.json`, CD workflow logs | _(run deploy to populate)_ | |

## How to Capture Evidence

### Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed
- Azure CLI authenticated (`az login`) for deploy timing
- Staging environment deployed and accessible

### Step 1: Run k6 load tests

```bash
cd performance-test
chmod +x run-tests.sh
./run-tests.sh --base-url https://<staging-backend-url>
```

This runs two tests:

1. **Ramping VUs** (default) — ramps 0→20→50→100 VUs to prove concurrency and response time
2. **Constant throughput** — maintains 20 req/s arrival rate to prove throughput

Results are saved to `performance-test/results/` and copied here.

### Step 2: Capture deploy timing

After a deployment, run:

```bash
./run-tests.sh \
  --base-url https://<staging-backend-url> \
  --deploy-timing \
  --deploy-app <aca-app-name> \
  --deploy-rg <resource-group>
```

Or check the GitHub Actions CD workflow output for `deploy-metrics.json` as a build artifact.

### Step 3: Screenshot reports

Open `ramping-report.html` or `throughput-report.html` in a browser and take screenshots for the final report/presentation.

## Files

| File | Description |
|------|-------------|
| `ramping-summary.json` | k6 summary for ramping VUs scenario (response time, concurrency) |
| `throughput-summary.json` | k6 summary for constant throughput scenario |
| `ramping-report.html` | Visual HTML report for ramping VUs test |
| `throughput-report.html` | Visual HTML report for throughput test |
| `deploy-metrics.json` | Deployment duration measurement |
| `ramping-results.json` | Raw per-request data from ramping VUs test |
| `throughput-results.json` | Raw per-request data from throughput test |

## Mapping to Project Brief

- **Response time ≤ 2s**: Measured by `http_req_duration` avg in ramping VUs scenario
- **Concurrent users ≥ 50**: Demonstrated by sustaining 50 VUs in ramping scenario
- **Throughput ≥ 20 req/s**: Measured by `http_reqs.rate` in constant throughput scenario
- **Deploy time ≤ 5 min**: Measured by `deploy_duration_seconds` from CD workflow

## Related Issues

- Parent tracker: [#1 — Implementation Tracker](https://github.com/Josan88/BookRunner/issues/1)
- Monitoring: [#8 — Azure Monitor & Evidence](https://github.com/Josan88/BookRunner/issues/8)
- This issue: [#15 — Performance Evidence](https://github.com/Josan88/BookRunner/issues/15)

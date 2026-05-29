#!/usr/bin/env bash
# run-tests.sh — Orchestrator for BookRunner performance evidence collection
#
# Usage:
#   ./run-tests.sh --base-url https://your-staging.azurecontainerapps.io
#
# Prerequisites:
#   - k6 installed (https://grafana.com/docs/k6/latest/set-up/install-k6/)
#   - Azure CLI authenticated (for deploy-timing.sh)
#
# Outputs:
#   performance-test/results/         — raw k6 results (JSON, CSV, HTML)
#   docs/evidence/performance/        — copied evidence files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$REPO_ROOT/docs/evidence/performance"
RESULTS_DIR="$SCRIPT_DIR/results"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
BASE_URL=""
SKIP_K6=false
SKIP_DEPLOY=true
DEPLOY_APP=""
DEPLOY_RG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --skip-k6) SKIP_K6=true; shift ;;
    --deploy-timing) SKIP_DEPLOY=false; shift ;;
    --deploy-app) DEPLOY_APP="$2"; shift 2 ;;
    --deploy-rg) DEPLOY_RG="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --base-url <url> [--skip-k6] [--deploy-timing --deploy-app <app> --deploy-rg <rg>]"
      exit 0
      ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$BASE_URL" ]]; then
  echo "Error: --base-url is required"
  echo "Usage: $0 --base-url https://your-staging.azurecontainerapps.io"
  exit 1
fi

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mkdir -p "$RESULTS_DIR" "$EVIDENCE_DIR"

echo "============================================"
echo " BookRunner Performance Evidence Collection"
echo "============================================"
echo " Base URL:  $BASE_URL"
echo " Results:   $RESULTS_DIR"
echo " Evidence:  $EVIDENCE_DIR"
echo ""

# ---------------------------------------------------------------------------
# 1. k6 Load Test — Ramping VUs (concurrency + response time)
# ---------------------------------------------------------------------------
if [[ "$SKIP_K6" == false ]]; then
  echo "--------------------------------------------"
  echo " [1/3] Ramping VUs test (concurrency + response time)"
  echo "--------------------------------------------"
  if ! command -v k6 &> /dev/null; then
    echo "Error: k6 is not installed."
    echo "Install: https://grafana.com/docs/k6/latest/set-up/install-k6/"
    exit 1
  fi

  BASE_URL="$BASE_URL" SCENARIO=ramping \
    k6 run \
      --out json="$RESULTS_DIR/ramping-results.json" \
      --out csv="$RESULTS_DIR/ramping-results.csv" \
      --summary-export="$RESULTS_DIR/ramping-summary.json" \
      "$SCRIPT_DIR/load-test.js" || true

  # Copy summary to evidence dir
  if [[ -f "$RESULTS_DIR/ramping-summary.json" ]]; then
    cp "$RESULTS_DIR/ramping-summary.json" "$EVIDENCE_DIR/"
  fi
  if [[ -f "$RESULTS_DIR/summary.html" ]]; then
    cp "$RESULTS_DIR/summary.html" "$EVIDENCE_DIR/ramping-report.html"
  fi

  echo ""
  echo " [1/3] Ramping VUs test complete"
  echo ""
fi

# ---------------------------------------------------------------------------
# 2. k6 Throughput Test — Constant arrival rate
# ---------------------------------------------------------------------------
if [[ "$SKIP_K6" == false ]]; then
  echo "--------------------------------------------"
  echo " [2/3] Constant throughput test (20 RPS)"
  echo "--------------------------------------------"

  BASE_URL="$BASE_URL" SCENARIO=throughput \
    k6 run \
      --out json="$RESULTS_DIR/throughput-results.json" \
      --out csv="$RESULTS_DIR/throughput-results.csv" \
      --summary-export="$RESULTS_DIR/throughput-summary.json" \
      "$SCRIPT_DIR/load-test.js" || true

  # Copy summary to evidence dir
  if [[ -f "$RESULTS_DIR/throughput-summary.json" ]]; then
    cp "$RESULTS_DIR/throughput-summary.json" "$EVIDENCE_DIR/"
  fi
  if [[ -f "$RESULTS_DIR/summary.html" ]]; then
    cp "$RESULTS_DIR/summary.html" "$EVIDENCE_DIR/throughput-report.html"
  fi

  echo ""
  echo " [2/3] Throughput test complete"
  echo ""
fi

# ---------------------------------------------------------------------------
# 3. Deploy timing (optional)
# ---------------------------------------------------------------------------
if [[ "$SKIP_DEPLOY" == false ]]; then
  echo "--------------------------------------------"
  echo " [3/3] Deploy timing measurement"
  echo "--------------------------------------------"

  if [[ -z "$DEPLOY_APP" || -z "$DEPLOY_RG" ]]; then
    echo "Warning: --deploy-app and --deploy-rg required for deploy timing. Skipping."
  else
    bash "$SCRIPT_DIR/deploy-timing.sh" \
      --app-name "$DEPLOY_APP" \
      --resource-group "$DEPLOY_RG" \
      --output "$EVIDENCE_DIR/deploy-metrics.json" || true

    echo ""
    echo " [3/3] Deploy timing complete"
  fi
else
  echo "--------------------------------------------"
  echo " [3/3] Deploy timing — SKIPPED (use --deploy-timing to enable)"
  echo "--------------------------------------------"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo " Evidence Collection Complete"
echo "============================================"
echo ""
echo "Evidence files in $EVIDENCE_DIR:"
ls -la "$EVIDENCE_DIR/" 2>/dev/null || echo "  (none)"
echo ""

# Print key metrics if summaries exist
for SUMMARY in "$RESULTS_DIR"/ramping-summary.json "$RESULTS_DIR"/throughput-summary.json; do
  if [[ -f "$SUMMARY" ]]; then
    TEST_NAME=$(basename "$SUMMARY" .json | sed 's/-summary//')
    echo "--- $TEST_NAME ---"
    # Extract key metrics using node (available in most dev environments)
    if command -v node &> /dev/null; then
      node -e "
        const d = require('$SUMMARY');
        const dur = d.metrics?.http_req_duration;
        const reqs = d.metrics?.http_reqs;
        const failed = d.metrics?.http_req_failed;
        const checks = d.metrics?.checks;
        console.log('  Avg response time: ' + (dur?.values?.avg?.toFixed(2) || 'N/A') + 'ms');
        console.log('  P95 response time: ' + (dur?.values?.['p(95)']?.toFixed(2) || 'N/A') + 'ms');
        console.log('  Request rate:      ' + (reqs?.values?.rate?.toFixed(2) || 'N/A') + ' req/s');
        console.log('  Error rate:        ' + (failed?.values?.rate?.toFixed(4) || 'N/A'));
        console.log('  Check pass rate:   ' + (checks?.values?.rate?.toFixed(4) || 'N/A'));
      " 2>/dev/null || echo "  (could not parse summary)"
    fi
    echo ""
  fi
done

echo "Done. Evidence is ready for the final report."

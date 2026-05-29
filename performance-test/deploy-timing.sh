#!/usr/bin/env bash
# deploy-timing.sh — Measure deployment duration from image update to running state
#
# Usage:
#   ./deploy-timing.sh --app-name <aca-app> --resource-group <rg> [--timeout 300]
#
# Outputs:
#   deploy-metrics.json  — JSON with deploy_duration_seconds, commit, timestamp
#
# Exit code:
#   0 — deploy succeeded within timeout
#   1 — deploy failed or timed out

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
APP_NAME=""
RESOURCE_GROUP=""
TIMEOUT_SECONDS=300
POLL_INTERVAL=10
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
OUTPUT_FILE="${OUTPUT_FILE:-deploy-metrics.json}"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-name) APP_NAME="$2"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="$2"; shift 2 ;;
    --timeout) TIMEOUT_SECONDS="$2"; shift 2 ;;
    --commit) COMMIT_SHA="$2"; shift 2 ;;
    --output) OUTPUT_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$APP_NAME" || -z "$RESOURCE_GROUP" ]]; then
  echo "Usage: $0 --app-name <aca-app> --resource-group <rg> [--timeout 300]"
  exit 1
fi

# ---------------------------------------------------------------------------
# Record start time
# ---------------------------------------------------------------------------
START_EPOCH=$(date +%s)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deploy timing started"
echo "  App:           $APP_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Timeout:       ${TIMEOUT_SECONDS}s"
echo "  Commit:        $COMMIT_SHA"

# ---------------------------------------------------------------------------
# Poll until Container App is running or timeout
# ---------------------------------------------------------------------------
ELAPSED=0
FINAL_STATE="unknown"

while [[ $ELAPSED -lt $TIMEOUT_SECONDS ]]; do
  # Query the running status (ACA exposes properties.runningStatus)
  RUNNING_STATUS=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.runningStatus" \
    --output tsv 2>/dev/null || echo "unknown")

  PROVISIONING_STATE=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.provisioningState" \
    --output tsv 2>/dev/null || echo "unknown")

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] runningStatus=$RUNNING_STATUS  provisioningState=$PROVISIONING_STATE  (${ELAPSED}s elapsed)"

  if [[ "$RUNNING_STATUS" == "Running" ]]; then
    FINAL_STATE="Running"
    break
  fi

  if [[ "$PROVISIONING_STATE" == "Failed" ]]; then
    FINAL_STATE="Failed"
    echo "::error::Container App provisioning failed."
    break
  fi

  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

# ---------------------------------------------------------------------------
# Calculate duration
# ---------------------------------------------------------------------------
END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))

if [[ "$FINAL_STATE" != "Running" ]]; then
  echo "::error::Deploy did not reach Running state within ${TIMEOUT_SECONDS}s (final state: $FINAL_STATE)"
fi

echo ""
echo "============================================"
echo " Deploy Duration: ${DURATION}s"
echo " Final State:     $FINAL_STATE"
echo " Target:          ≤ ${TIMEOUT_SECONDS}s"
if [[ $DURATION -le $TIMEOUT_SECONDS ]]; then
  echo " Result:          PASS"
else
  echo " Result:          FAIL"
fi
echo "============================================"

# ---------------------------------------------------------------------------
# Write JSON output
# ---------------------------------------------------------------------------
cat > "$OUTPUT_FILE" <<EOF
{
  "deploy_duration_seconds": $DURATION,
  "timeout_seconds": $TIMEOUT_SECONDS,
  "target_seconds": 300,
  "passed": $( [[ $DURATION -le $TIMEOUT_SECONDS ]] && echo "true" || echo "false" ),
  "final_state": "$FINAL_STATE",
  "commit": "$COMMIT_SHA",
  "app_name": "$APP_NAME",
  "resource_group": "$RESOURCE_GROUP",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "Metrics written to $OUTPUT_FILE"

# Exit with error if deploy didn't succeed
if [[ "$FINAL_STATE" != "Running" ]]; then
  exit 1
fi

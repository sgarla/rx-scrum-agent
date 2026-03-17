#!/bin/bash
# Deploy rxscrum-agent to Databricks Apps
# Usage: ./deploy.sh

set -e
APP_NAME="rxscrum-agent"
WORKSPACE_PATH="/Workspace/Users/satish.garla@databricks.com/apps/rxscrum-agent"
PROFILE="builder-demo"
STAGE="/tmp/rxscrum-stage"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building frontend ==="
if [[ ! -d "$ROOT/client/dist" ]]; then
  cd "$ROOT/client" && npm run build
  cd "$ROOT"
else
  echo "client/dist already exists — skipping npm build"
fi

echo "=== Staging clean files ==="
rm -rf "$STAGE"
mkdir -p "$STAGE/client"
cp "$ROOT/app.yaml" "$ROOT/requirements.txt" "$STAGE/"
cp -r "$ROOT/server" "$STAGE/"
cp -r "$ROOT/client/dist" "$STAGE/client/"
find "$STAGE" -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$STAGE" -name "*.pyc" -delete 2>/dev/null || true
echo "Stage size: $(du -sh "$STAGE" | cut -f1)"

echo "=== Uploading to workspace ==="
databricks --profile "$PROFILE" workspace import-dir "$STAGE" "$WORKSPACE_PATH" --overwrite

echo "=== Deploying app ==="
databricks --profile "$PROFILE" apps deploy "$APP_NAME" --source-code-path "$WORKSPACE_PATH"

echo "=== Waiting for deployment ==="
for i in {1..20}; do
  sleep 15
  state=$(databricks --profile "$PROFILE" apps get "$APP_NAME" 2>&1 | grep '"state"' | sed -n '1p' | tr -d ' ",:' | sed 's/state//')
  echo "$(date +%H:%M:%S) $state"
  if [[ "$state" == "SUCCEEDED" ]]; then
    echo "✓ Deployed: https://${APP_NAME}-7474647717666058.aws.databricksapps.com"
    exit 0
  elif [[ "$state" == "FAILED" ]]; then
    databricks --profile "$PROFILE" apps get "$APP_NAME" 2>&1 | grep '"message"' | head -3
    exit 1
  fi
done
echo "Timed out waiting for deployment"

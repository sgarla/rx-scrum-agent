#!/bin/bash
# setup_scrum_demo.sh — End-to-end setup of RxScrum Agent in a Databricks workspace
#
# Usage:
#   ./setup_scrum_demo.sh --profile <profile> [options]
#
# Options:
#   --profile       (required) Databricks CLI profile from ~/.databrickscfg
#   --catalog       Unity Catalog catalog name (default: rxcorp)
#   --schema        Unity Catalog schema name  (default: claims)
#   --app-name      Databricks app name        (default: rxscrum-agent)
#   --lakebase      Lakebase instance name     (default: scrum-demo-db)
#   --capacity      Lakebase capacity unit     (default: CU_1, options: CU_1 CU_2 CU_4 CU_8)
#
# Example:
#   ./setup_scrum_demo.sh --profile customer-demo
#   ./setup_scrum_demo.sh --profile customer-demo --catalog acme_data --schema rx_claims

set -e

# ─── Defaults ────────────────────────────────────────────────────────────────
PROFILE=""
CATALOG=""          # empty = not provided, will default to rxcorp and auto-create
SCHEMA="claims"
APP_NAME="rxscrum-agent"
LAKEBASE_INSTANCE="scrum-demo-db"
CAPACITY="CU_1"
CUSTOM_CATALOG=false

# ─── Parse arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)   PROFILE="$2";           shift 2 ;;
    --catalog)   CATALOG="$2"; CUSTOM_CATALOG=true; shift 2 ;;
    --schema)    SCHEMA="$2";            shift 2 ;;
    --app-name)  APP_NAME="$2";          shift 2 ;;
    --lakebase)  LAKEBASE_INSTANCE="$2"; shift 2 ;;
    --capacity)  CAPACITY="$2";          shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# Apply default catalog if not explicitly provided
[[ -z "$CATALOG" ]] && CATALOG="rxcorp"

if [[ -z "$PROFILE" ]]; then
  echo "Error: --profile is required"
  echo "Usage: ./setup_scrum_demo.sh --profile <profile> [--catalog <name>] [--schema <name>]"
  exit 1
fi

DB="databricks --profile $PROFILE"

echo "======================================================="
echo "  RxScrum Agent — Workspace Setup"
echo "======================================================="
echo "  Profile:  $PROFILE"
echo "  Catalog:  $CATALOG"
echo "  Schema:   $SCHEMA"
echo "  App:      $APP_NAME"
echo "  Lakebase: $LAKEBASE_INSTANCE ($CAPACITY)"
echo "======================================================="
echo ""

# ─── Get current user email (for workspace path) ─────────────────────────────
echo ">>> Getting workspace user..."
USER_EMAIL=$($DB current-user me --output json | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])")
WORKSPACE_PATH="/Workspace/Users/$USER_EMAIL/apps/$APP_NAME"
echo "    User: $USER_EMAIL"
echo "    Workspace path: $WORKSPACE_PATH"
echo ""

# ─── Step 1: Unity Catalog ───────────────────────────────────────────────────
echo ">>> Step 1: Setting up Unity Catalog..."

if [[ "$CUSTOM_CATALOG" == true ]]; then
  # Customer provided an existing catalog — verify it exists, don't try to create it
  if ! $DB catalogs get "$CATALOG" --output json > /dev/null 2>&1; then
    echo ""
    echo "  ERROR: Catalog '$CATALOG' does not exist or you don't have access."
    echo "  Please provide a catalog you have access to: --catalog <existing_catalog>"
    echo ""
    exit 1
  fi
  echo "    Using existing catalog '$CATALOG' ✓"
else
  # No catalog provided — use default 'rxcorp', create it if it doesn't exist
  if $DB catalogs get "$CATALOG" --output json > /dev/null 2>&1; then
    echo "    Catalog '$CATALOG' already exists — skipping"
  else
    if ! $DB catalogs create "$CATALOG" > /dev/null 2>&1; then
      echo ""
      echo "  ERROR: Could not create catalog '$CATALOG' (insufficient privileges)."
      echo ""
      echo "  Options:"
      echo "    1. Ask a metastore admin to create it:  CREATE CATALOG $CATALOG;"
      echo "    2. Use an existing catalog:             ./setup_scrum_demo.sh --profile $PROFILE --catalog <existing_catalog>"
      echo ""
      exit 1
    fi
    echo "    Created catalog: $CATALOG"
  fi
fi

# Create schema if it doesn't exist
if $DB schemas get "${CATALOG}.${SCHEMA}" --output json > /dev/null 2>&1; then
  echo "    Schema '$CATALOG.$SCHEMA' already exists — skipping"
else
  $DB schemas create "$SCHEMA" "$CATALOG" > /dev/null
  echo "    Created schema: $CATALOG.$SCHEMA"
fi
echo ""

# ─── Step 2: Lakebase PostgreSQL instance ────────────────────────────────────
echo ">>> Step 2: Setting up Lakebase instance '$LAKEBASE_INSTANCE'..."

if $DB database get-database-instance "$LAKEBASE_INSTANCE" --output json > /dev/null 2>&1; then
  echo "    Instance already exists — skipping creation"
else
  $DB database create-database-instance "$LAKEBASE_INSTANCE" --capacity "$CAPACITY"
  echo "    Instance created and ready"
fi
echo ""

# ─── Step 3: Update app.yaml ─────────────────────────────────────────────────
echo ">>> Step 3: Updating app.yaml..."
python3 - "$LAKEBASE_INSTANCE" "$CATALOG" "$SCHEMA" <<'PYEOF'
import re, sys

lakebase_instance, catalog, schema = sys.argv[1], sys.argv[2], sys.argv[3]

with open("app.yaml", "r") as f:
    content = f.read()

# Update resources section with correct Lakebase instance name
content = re.sub(
    r'(resources:.*?- name: lakebase\s*\n\s*database:\s*\n\s*instance: )\S+',
    f'\\g<1>{lakebase_instance}', content, flags=re.DOTALL)
content = re.sub(
    r'(- name: DEFAULT_CATALOG\s*\n\s*value: )"[^"]*"',
    f'\\1"{catalog}"', content)
content = re.sub(
    r'(- name: DEFAULT_SCHEMA\s*\n\s*value: )"[^"]*"',
    f'\\1"{schema}"', content)

with open("app.yaml", "w") as f:
    f.write(content)

print("    app.yaml updated")
PYEOF
echo ""

# ─── Step 4: Update deploy.sh ────────────────────────────────────────────────
echo ">>> Step 4: Updating deploy.sh..."
python3 - "$PROFILE" "$WORKSPACE_PATH" <<'PYEOF'
import re, sys

profile, workspace_path = sys.argv[1], sys.argv[2]

with open("deploy.sh", "r") as f:
    content = f.read()

content = re.sub(r'PROFILE="[^"]*"', f'PROFILE="{profile}"', content)
content = re.sub(r'WORKSPACE_PATH="[^"]*"', f'WORKSPACE_PATH="{workspace_path}"', content)

with open("deploy.sh", "w") as f:
    f.write(content)

print("    deploy.sh updated")
PYEOF
echo ""

# ─── Step 5: Create Databricks App ───────────────────────────────────────────
echo ">>> Step 5: Creating Databricks App '$APP_NAME'..."
if $DB apps get "$APP_NAME" --output json > /dev/null 2>&1; then
  echo "    App already exists — skipping creation"
else
  $DB apps create "$APP_NAME" --description "AI-powered scrum story builder" --no-compute > /dev/null
  echo "    App created"
fi
echo ""

# ─── Step 6: Grant Unity Catalog permissions to App SP ───────────────────────
echo ">>> Step 6: Granting Unity Catalog permissions..."
APP_SP=$($DB apps get "$APP_NAME" --output json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('service_principal_name') or d.get('service_principal_id',''))" 2>/dev/null || echo "")

if [[ -n "$APP_SP" ]]; then
  $DB grants update catalog "$CATALOG" --json "{
    \"changes\": [{
      \"principal\": \"$APP_SP\",
      \"add\": [\"USE_CATALOG\", \"USE_SCHEMA\", \"CREATE_SCHEMA\", \"CREATE_TABLE\", \"SELECT\"]
    }]
  }" > /dev/null
  echo "    Granted UC permissions to: $APP_SP"
else
  echo "    ⚠️  Could not resolve app service principal — grant manually:"
  echo "    GRANT USE CATALOG, USE SCHEMA, CREATE SCHEMA, CREATE TABLE, SELECT"
  echo "      ON CATALOG $CATALOG TO \`<app-service-principal>\`;"
fi
echo ""

# ─── Step 7: Build & Deploy ──────────────────────────────────────────────────
echo ">>> Step 7: Building and deploying app..."
ROOT="$(cd "$(dirname "$0")" && pwd)"
npm --prefix "$ROOT/client" install --silent
"$ROOT/deploy.sh"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "======================================================="
echo "  Setup complete!"
echo "  App:      $APP_NAME"
echo "  Catalog:  $CATALOG.$SCHEMA"
echo "  Lakebase: $LAKEBASE_INSTANCE"
echo "======================================================="

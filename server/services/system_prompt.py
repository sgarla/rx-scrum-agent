"""Build story-contextual system prompts for the Virtual Scrum Member agent.

Each story type gets a tailored SDLC workflow instruction so the agent
knows exactly which skill to load and which steps to follow end-to-end.
"""

import os

WORKSPACE_URL = os.getenv("DATABRICKS_HOST", "").rstrip("/")
AUTO_GRANT = os.getenv("AUTO_GRANT_PERMISSIONS_TO", "account users")
DEFAULT_CATALOG = os.getenv("DEFAULT_CATALOG", "healthcare_demo")
DEFAULT_SCHEMA = os.getenv("DEFAULT_SCHEMA", "claims")

# Per-story-type SDLC workflows
_WORKFLOWS: dict[str, str] = {
    "data_pipeline": """
## SDLC Workflow for Data Pipeline Story

Follow these steps in order. Do NOT stop to ask questions — make reasonable assumptions and document them.

1. **Load skill**: Invoke the `databricks-spark-declarative-pipelines` skill immediately.
2. **Generate synthetic source data**: If source tables/files don't exist, create a synthetic dataset first using Python + Faker so you have data to work with.
3. **Write DLT pipeline code** (Python or SQL notebooks) following the medallion pattern (Bronze / Silver / Gold).
4. **Upload notebook files** to the workspace using `upload_file`.
5. **Create the Lakeflow Declarative Pipeline** using `create_or_update_pipeline` with the uploaded files.
6. **Run the pipeline** using `run_pipeline` (wait for completion).
7. **Verify** row counts and data quality in each layer via `execute_sql`.
8. **Grant permissions** using `manage_uc_grants` to `{auto_grant}`.
9. **Output asset summary** in the required format (see below).
""",

    "dashboard": """
## SDLC Workflow for Dashboard Story

Follow these steps in order. Do NOT stop to ask questions.

1. **Load skill**: Invoke the `databricks-aibi-dashboards` skill immediately.
2. **Inspect target tables**: Query each table with `execute_sql` to understand schema and sample data.
3. **Test ALL dataset queries** via `execute_sql` before including them in the dashboard JSON.
4. **Design and build** the AI/BI dashboard following the skill's JSON schema requirements exactly:
   - Version requirements: counter v2, bar/line/pie v3, filter v2
   - Field name in query.fields MUST match fieldName in encodings exactly
5. **Publish** the dashboard using `publish_dashboard`.
6. **Output asset summary** in the required format (see below).
""",

    "ml_model": """
## SDLC Workflow for ML Model Story

Follow these steps in order. Do NOT stop to ask questions.

1. **Load skill**: Invoke the `databricks-model-serving` skill immediately.
2. **Check or create feature table**: If the feature table doesn't exist, generate synthetic features using `execute_databricks_command`.
3. **Write training script** as a Python notebook — use scikit-learn or XGBoost, log to MLflow.
4. **Upload and run** the notebook on a Databricks cluster using `run_python_file_on_databricks`.
5. **Register model** to Unity Catalog model registry using MLflow Python SDK.
6. **Deploy** a Model Serving endpoint using `create_or_update_pipeline` or the serving SDK pattern.
7. **Test** the endpoint with a sample request using `query_serving_endpoint`.
8. **Output asset summary** in the required format (see below).
""",

    "synthetic_data": """
## SDLC Workflow for Synthetic Data Story

Follow these steps in order. Do NOT stop to ask questions.

1. **Load skill**: Invoke the `databricks-synthetic-data-generation` skill immediately.
2. **Plan schema** based on story acceptance criteria — define column names, types, cardinalities.
3. **Write a Python script** using Faker + Spark to generate the data with realistic distributions.
4. **Run the script** on Databricks using `execute_databricks_command` (Python).
5. **Save to Unity Catalog tables** in the `{catalog}.synthetic` schema.
6. **Verify** row counts via `execute_sql` — confirm they match the AC targets.
7. **Grant permissions** using `manage_uc_grants` to `{auto_grant}`.
8. **Output asset summary** in the required format (see below).
""",

    "ai_agent": """
## SDLC Workflow for AI Agent Story

Follow these steps in order. Do NOT stop to ask questions.

1. **Load skill**: Invoke the `databricks-agent-bricks` skill immediately.
2. **Create source documents**: If source documents don't exist, generate synthetic formulary/policy PDFs or text using `execute_databricks_command`.
3. **Upload documents** to a Unity Catalog Volume.
4. **Create Vector Search endpoint** (if not exists) using `create_or_update_vs_endpoint`.
5. **Create Vector Search index** over the document content with managed embeddings.
6. **Build the agent chain** using LangChain RetrievalQA + Databricks Foundation Models.
7. **Log and register** the agent with MLflow.
8. **Deploy** to a Model Serving endpoint.
9. **Test** with sample questions from the acceptance criteria.
10. **Output asset summary** in the required format (see below).
""",

    "job": """
## SDLC Workflow for Job/Scheduling Story

Follow these steps in order. Do NOT stop to ask questions.

1. **Load skill**: Invoke the `databricks-jobs` skill immediately.
2. **Create any prerequisite notebooks/scripts** that the job needs.
3. **Create the Databricks Job** using `manage_jobs` with all tasks specified.
4. **Configure the schedule** (cron expression per AC).
5. **Set retry policy and timeout** per AC.
6. **Configure notifications** (webhook/email) per AC.
7. **Trigger a test run** using `manage_job_runs` → `run_now` and wait for completion.
8. **Verify** the job completed successfully.
9. **Output asset summary** in the required format (see below).
""",

    "generic": """
## SDLC Workflow

1. Load the most relevant Databricks skill for this story type.
2. Analyze the acceptance criteria carefully.
3. Build the required Databricks assets step by step.
4. Verify each acceptance criterion is met.
5. Grant permissions to `{auto_grant}`.
6. **Output asset summary** in the required format (see below).
""",
}

_ASSET_SUMMARY_INSTRUCTIONS = """
## Asset Summary (REQUIRED at completion)

When you have completed ALL tasks, you MUST output a summary block in EXACTLY this format
(replace with real values — real URLs, real names, real UC paths):

<assets_summary>
{
  "assets": [
    {"type": "pipeline", "name": "rx_claims_ingestion", "catalog": "healthcare_demo", "schema": "claims", "full_path": null, "url": "https://...", "description": "DLT Pipeline - Bronze/Silver/Gold"},
    {"type": "table", "name": "bronze_claims", "catalog": "healthcare_demo", "schema": "claims", "full_path": "healthcare_demo.claims.bronze_claims", "url": "https://...", "description": "Raw claims ingestion table"},
    {"type": "table", "name": "silver_claims", "catalog": "healthcare_demo", "schema": "claims", "full_path": "healthcare_demo.claims.silver_claims", "url": "https://...", "description": "Enriched and deduplicated claims"},
    {"type": "dashboard", "name": "Prior Auth Analytics", "catalog": null, "schema": null, "full_path": null, "url": "https://...", "description": "AI/BI Dashboard for prior authorization metrics"},
    {"type": "endpoint", "name": "member-risk-scorer", "catalog": null, "schema": null, "full_path": null, "url": "https://...", "description": "Model Serving endpoint for risk scoring"},
    {"type": "job", "name": "daily_claims_reconciliation", "catalog": null, "schema": null, "full_path": null, "url": "https://...", "description": "Scheduled reconciliation job"}
  ]
}
</assets_summary>

Rules:
- Include EVERY resource you created (tables, pipelines, dashboards, endpoints, jobs, notebooks, schemas, volumes, models, indexes)
- For Unity Catalog tables: always set catalog, schema, and full_path (e.g. "healthcare_demo.claims.bronze_claims")
- For non-table assets (pipelines, dashboards, jobs, endpoints): set catalog/schema if applicable, otherwise null
- URLs should be real workspace links — construct them from the workspace URL when possible
- full_path format for tables: <catalog>.<schema>.<table_name>

After outputting the asset summary, write a brief human-readable completion message
summarizing what was built and how each acceptance criterion is satisfied.
"""


def build_story_system_prompt(story: dict) -> str:
    """Build a complete system prompt for building a specific JIRA story."""
    key = story.get("key", "")
    summary = story.get("summary", "")
    description = story.get("description", "")
    priority = story.get("priority", "Medium")
    story_points = story.get("story_points", "")
    assignee = story.get("assignee", "")
    labels = ", ".join(story.get("labels", []))
    acceptance_criteria = story.get("acceptance_criteria", [])
    story_type = story.get("type", "generic")

    ac_list = "\n".join(f"  - [ ] {ac}" for ac in acceptance_criteria)

    workflow = _WORKFLOWS.get(story_type, _WORKFLOWS["generic"])
    workflow = workflow.format(auto_grant=AUTO_GRANT, catalog=DEFAULT_CATALOG, schema=DEFAULT_SCHEMA)

    workspace_line = f"\nDatabricks Workspace: {WORKSPACE_URL}" if WORKSPACE_URL else ""

    return f"""# Virtual Scrum Member — Databricks AI Agent

You are an expert **Databricks data engineer and AI practitioner** acting as a virtual scrum team member.
Your task is to implement the following JIRA user story end-to-end on Databricks.{workspace_line}

You have access to all Databricks MCP tools (pipelines, SQL, jobs, serving endpoints, Unity Catalog, etc.)
and the Claude Code built-in tools (Read, Write, Edit, Glob, Grep) for writing code files.

---

## JIRA Story: {key}

**Summary:** {summary}
**Priority:** {priority}  |  **Story Points:** {story_points}  |  **Assigned To:** {assignee}
**Labels:** {labels}

### Description

{description}

### Acceptance Criteria

{ac_list}

---

{workflow}

---

{_ASSET_SUMMARY_INSTRUCTIONS}

---

## General Guidelines

- **Work autonomously** — do not stop to ask for confirmation. Make reasonable assumptions and document them.
- **Use Databricks best practices**: Unity Catalog for all tables, proper grants, serverless compute where available.
- **Default catalog/schema**: `{DEFAULT_CATALOG}.{DEFAULT_SCHEMA}` unless the story specifies otherwise.
- **When creating tables**: Always grant SELECT to `{AUTO_GRANT}` after creation.
- **Error handling**: If a tool call fails, diagnose and retry with a corrected approach. Log what you tried.
- **Quality over speed**: Verify row counts and data correctness after each major step.
"""

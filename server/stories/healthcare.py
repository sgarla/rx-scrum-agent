"""Healthcare insurance mock JIRA stories for the Virtual Scrum Member demo.

These stories cover the full Databricks SDLC for an Rx claims / insurance platform.
Each story maps to a specific Databricks skill and produces real workspace assets.
"""

import json as _json
import os as _os

_CATALOG = _os.getenv("DEFAULT_CATALOG", "rxcorp")

STORIES = [
    {
        "key": "CLAIMS-101",
        "summary": "Build Rx Claims Ingestion Pipeline (Bronze/Silver/Gold)",
        "description": (
            "As a data engineer, I need a medallion architecture pipeline that ingests raw 837 "
            "EDI claim files from our landing zone, validates and enriches them in the silver layer "
            "using NDC drug codes and ICD-10 diagnosis codes, and produces business-ready aggregates "
            "in the gold layer for downstream reporting and analytics.\n\n"
            "The pipeline must handle late-arriving claims (up to 90 days), de-duplicate submissions "
            "with the same claim_id, and apply data quality expectations at each layer. All tables "
            "should be stored in the `rxcorp.claims` schema in Unity Catalog."
        ),
        "acceptance_criteria": [
            "Bronze table `bronze_claims` ingests raw claim files with Auto Loader, schema inference, and rescue column",
            "Silver table `silver_claims` applies deduplication (by claim_id), null checks on member_id and ndc_code, and NDC drug name lookup join",
            "Gold table `gold_claims_by_plan` aggregates total_billed, total_paid, claim_count by insurance_plan and service_date_month",
            "Gold table `gold_denial_summary` shows denial_reason_code counts by drug_class",
            "DLT pipeline has data quality expectations: claim_id IS NOT NULL, billed_amount > 0",
            "Pipeline deployable as a Databricks Lakeflow Declarative Pipeline",
            "All tables granted to account users via Unity Catalog",
        ],
        "story_points": 8,
        "priority": "High",
        "assignee": "John D.",
        "assignee_initials": "JD",
        "labels": ["data-engineering", "dlt", "medallion", "rx-claims"],
        "type": "data_pipeline",
        "status": "todo",
        "skill_hint": "databricks-spark-declarative-pipelines",
        "sprint": "Sprint 12",
    },
    {
        "key": "CLAIMS-102",
        "summary": "Prior Authorization Analytics Dashboard",
        "description": (
            "As a clinical operations analyst, I need an interactive AI/BI dashboard that shows "
            "key prior authorization (PA) metrics including approval rates, denial reasons, average "
            "turnaround times, and trends over time. The dashboard should help our PA team identify "
            "drugs with unusually high denial rates and flag bottlenecks in the PA workflow.\n\n"
            "The dashboard connects to `rxcorp.claims.gold_claims_by_plan` and "
            "`rxcorp.claims.gold_denial_summary` tables built in CLAIMS-101."
        ),
        "acceptance_criteria": [
            "KPI widget: Total claims submitted this month (counter)",
            "KPI widget: Overall PA approval rate % (counter)",
            "Bar chart: Denial count by denial_reason_code (top 10)",
            "Line chart: Approval rate trend by week over last 12 weeks",
            "Table widget: Top 20 denied drugs with total denied amount",
            "Filter: by insurance_plan and date range",
            "Dashboard published and accessible via shareable link",
        ],
        "story_points": 5,
        "priority": "High",
        "assignee": "Priya K.",
        "assignee_initials": "PK",
        "labels": ["dashboard", "analytics", "ai-bi", "prior-auth"],
        "type": "dashboard",
        "status": "todo",
        "skill_hint": "databricks-aibi-dashboards",
        "sprint": "Sprint 12",
    },
    {
        "key": "CLAIMS-103",
        "summary": "Member Risk Scoring Model for High-Cost Claimants",
        "description": (
            "As a medical economics analyst, I want to train a machine learning model that predicts "
            "which members are at risk of becoming high-cost claimants in the next 90 days. The model "
            "will use features derived from claims history, pharmacy utilization, and chronic condition "
            "flags. Predictions will be served via a real-time REST endpoint for our care management team.\n\n"
            "Features should be sourced from `rxcorp.claims.silver_claims` and any available "
            "member eligibility data."
        ),
        "acceptance_criteria": [
            "Feature engineering notebook creates `rxcorp.claims.member_risk_features` table",
            "Model trained (scikit-learn GradientBoostingClassifier or XGBoost) with AUC-ROC > 0.72",
            "Model logged to MLflow with all params, metrics, and feature importance",
            "Model registered in Unity Catalog model registry as `rxcorp.claims.member_risk_model`",
            "Model Serving endpoint deployed and accepts {member_id, feature_vector} → returns {risk_score, risk_tier}",
            "Test the endpoint with 5 sample member IDs and verify response shape",
        ],
        "story_points": 13,
        "priority": "Medium",
        "assignee": "Sarah M.",
        "assignee_initials": "SM",
        "labels": ["ml", "model-serving", "mlflow", "risk-scoring"],
        "type": "ml_model",
        "status": "todo",
        "skill_hint": "databricks-model-serving",
        "sprint": "Sprint 12",
    },
    {
        "key": "CLAIMS-104",
        "summary": "Generate Synthetic HIPAA-Safe Claims Dataset",
        "description": (
            "As a developer and QA engineer, I need a realistic synthetic healthcare dataset with "
            "members, NDC drug codes, insurance plans, and claim transactions that can be used for "
            "pipeline development, dashboard testing, and ML model training — without using any real "
            "patient PII data.\n\n"
            "The dataset should reflect realistic claim patterns including seasonal variation in "
            "specialty drug claims, a realistic mix of plan types (HMO, PPO, HDHP), and authentic "
            "NDC codes from the FDA drug database categories."
        ),
        "acceptance_criteria": [
            "Table `rxcorp.synthetic.members`: 10,000 rows with member_id, plan_type, state, age_band, chronic_flag",
            "Table `rxcorp.synthetic.ndc_formulary`: 500 NDC codes with drug_name, drug_class, tier, requires_pa flag",
            "Table `rxcorp.synthetic.claims`: 500,000 claim lines over 24 months with realistic seasonal distribution",
            "No real PII — all names/IDs synthetically generated",
            "Data has referential integrity (claims reference valid member_ids and ndc_codes)",
            "Row counts verified via SELECT COUNT(*) after load",
            "All tables granted to account users",
        ],
        "story_points": 3,
        "priority": "High",
        "assignee": "Marcus R.",
        "assignee_initials": "MR",
        "labels": ["data-generation", "testing", "synthetic", "hipaa-safe"],
        "type": "synthetic_data",
        "status": "todo",
        "skill_hint": "databricks-synthetic-data-generation",
        "sprint": "Sprint 12",
    },
    {
        "key": "CLAIMS-105",
        "summary": "Formulary & Benefits AI Assistant",
        "description": (
            "As a member services representative, I want an AI chatbot that can instantly answer "
            "common questions about drug formulary status, PA requirements, copay tiers, and benefit "
            "coverage rules — so our reps spend less time looking up plan documents and more time "
            "helping members.\n\n"
            "The agent should be grounded in our formulary documents and benefit summaries stored in "
            "a Unity Catalog volume, using RAG with Databricks Vector Search for retrieval and a "
            "Databricks Foundation Model for generation."
        ),
        "acceptance_criteria": [
            "Formulary documents (PDFs or text) uploaded to a Unity Catalog Volume",
            "Vector Search index created over formulary content with `databricks-gte-large-en` embeddings",
            "Agent built using LangChain RetrievalQA + Databricks Foundation Models",
            "Agent answers: 'Is Humira covered on my PPO plan?', 'What tier is metformin?', 'Does prior auth apply to Ozempic?'",
            "Agent logged to MLflow and deployed to a Model Serving endpoint",
            "Endpoint tested with 5 sample questions, responses include formulary citations",
        ],
        "story_points": 8,
        "priority": "Medium",
        "assignee": "Sarah M.",
        "assignee_initials": "SM",
        "labels": ["ai-agent", "vector-search", "rag", "formulary"],
        "type": "ai_agent",
        "status": "todo",
        "skill_hint": "databricks-agent-bricks",
        "sprint": "Sprint 12",
    },
    {
        "key": "CLAIMS-106",
        "summary": "Daily Claims Reconciliation Job with SLA Alerting",
        "description": (
            "As an operations engineer, I want to automate the daily claims reconciliation process "
            "that validates processed claim counts match received claim counts, flags any claims stuck "
            "in processing beyond our 30-day SLA, and sends webhook alerts to the ops team Slack "
            "channel when thresholds are breached.\n\n"
            "This job should run after the nightly DLT pipeline completes and produce a reconciliation "
            "report table that feeds into the operations dashboard."
        ),
        "acceptance_criteria": [
            "Databricks Job created with two tasks: (1) run DLT pipeline, (2) reconciliation notebook",
            "Reconciliation notebook compares daily received vs processed claim counts",
            "Alert triggered when: claim_count_delta > 5% OR any claim older than 30 days with status='pending'",
            "Job scheduled with cron: daily at 2:30 AM UTC",
            "Retry policy: 2 retries with 15-minute wait between attempts",
            "Job notification on failure sent to webhook (Slack-compatible)",
            "Reconciliation results written to `rxcorp.ops.daily_reconciliation` table",
        ],
        "story_points": 5,
        "priority": "Low",
        "assignee": "John D.",
        "assignee_initials": "JD",
        "labels": ["jobs", "scheduling", "alerting", "reconciliation"],
        "type": "job",
        "status": "todo",
        "skill_hint": "databricks-jobs",
        "sprint": "Sprint 12",
    },
]

# Index by key for O(1) lookup
STORIES_BY_KEY = {s["key"]: s for s in STORIES}

# Apply the configured catalog — replace the default "rxcorp" placeholder with the
# actual catalog name from DEFAULT_CATALOG env var (set in app.yaml or .env).
if _CATALOG != "rxcorp":
    _patched = _json.loads(_json.dumps(STORIES).replace("rxcorp", _CATALOG))
    STORIES[:] = _patched
    STORIES_BY_KEY.update({s["key"]: s for s in STORIES})


def get_all_stories(
    status: str | None = None,
    assignee: str | None = None,
    search: str | None = None,
    sprint: str | None = None,
) -> list[dict]:
    """Return filtered stories."""
    result = list(STORIES)
    if status and status != "all":
        result = [s for s in result if s["status"] == status]
    if assignee and assignee != "all":
        result = [s for s in result if s["assignee"] == assignee]
    if sprint and sprint != "all":
        result = [s for s in result if s.get("sprint") == sprint]
    if search:
        q = search.lower()
        result = [
            s for s in result
            if q in s["key"].lower() or q in s["summary"].lower()
        ]
    return result


def get_story(key: str) -> dict | None:
    return STORIES_BY_KEY.get(key)


def update_story_status(key: str, status: str) -> bool:
    """Update in-memory story status (for demo — no persistence across restarts)."""
    if key in STORIES_BY_KEY:
        STORIES_BY_KEY[key]["status"] = status
        # Also update the list copy
        for s in STORIES:
            if s["key"] == key:
                s["status"] = status
                break
        return True
    return False


ASSIGNEES = sorted({s["assignee"] for s in STORIES})
SPRINTS = sorted({s.get("sprint", "Sprint 12") for s in STORIES})

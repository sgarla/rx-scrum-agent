#!/usr/bin/env bash
set -euo pipefail

# Checks for upstream ai-dev-kit updates across three layers:
#   1. Skills (databricks-skills/) — file-level diffs since last sync
#   2. PyPI packages — version comparison for claude-agent-sdk, databricks-mcp-server, databricks-tools-core
#   3. MCP tools (databricks-mcp-server/) — commit log of tool changes
#
# Usage:
#   ./scripts/check-ai-dev-kit-updates.sh          # check only
#   ./scripts/check-ai-dev-kit-updates.sh --sync    # sync skills from upstream

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_FILE="$REPO_ROOT/.ai-dev-kit-sync"
REMOTE="ai-dev-kit"
REMOTE_URL="https://github.com/databricks-solutions/ai-dev-kit.git"

PACKAGES=("claude-agent-sdk" "databricks-mcp-server" "databricks-tools-core")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

action_needed=0

ensure_remote() {
    if ! git -C "$REPO_ROOT" remote get-url "$REMOTE" &>/dev/null; then
        echo -e "${YELLOW}Adding $REMOTE remote...${RESET}"
        git -C "$REPO_ROOT" remote add "$REMOTE" "$REMOTE_URL"
    fi
    echo -e "${CYAN}Fetching $REMOTE/main...${RESET}"
    git -C "$REPO_ROOT" fetch "$REMOTE" main --quiet 2>/dev/null
}

get_last_synced_commit() {
    if [[ -f "$SYNC_FILE" ]]; then
        grep '^LAST_SYNCED_COMMIT=' "$SYNC_FILE" | cut -d= -f2
    else
        echo ""
    fi
}

save_synced_commit() {
    local commit="$1"
    cat > "$SYNC_FILE" <<EOF
# ai-dev-kit sync tracking
# This file records the last ai-dev-kit commit that skills/ was synced from.
# Used by scripts/check-ai-dev-kit-updates.sh to detect upstream changes.
LAST_SYNCED_COMMIT=$commit
EOF
}

check_skills() {
    echo ""
    echo -e "${BOLD}SKILLS (databricks-skills/)${RESET}"
    echo "────────────────────────────────────────"

    local last_commit
    last_commit=$(get_last_synced_commit)
    local head_commit
    head_commit=$(git -C "$REPO_ROOT" rev-parse "$REMOTE/main")

    if [[ -z "$last_commit" ]]; then
        echo -e "  ${YELLOW}No sync point recorded — run with --sync to set baseline${RESET}"
        action_needed=1
        return
    fi

    if [[ "$last_commit" == "$head_commit" ]]; then
        echo -e "  ${GREEN}Up to date (${last_commit:0:8})${RESET}"
        return
    fi

    local commit_count
    commit_count=$(git -C "$REPO_ROOT" rev-list --count "$last_commit..$head_commit" -- databricks-skills/ 2>/dev/null || echo "?")

    local changed_files
    changed_files=$(git -C "$REPO_ROOT" diff --name-only "$last_commit..$head_commit" -- databricks-skills/ 2>/dev/null || true)

    if [[ -z "$changed_files" ]]; then
        echo -e "  ${GREEN}No skill file changes since last sync (${last_commit:0:8})${RESET}"
        return
    fi

    local file_count
    file_count=$(echo "$changed_files" | wc -l | tr -d ' ')
    echo -e "  ${YELLOW}${file_count} files changed across ${commit_count} commits since last sync${RESET}"
    echo -e "  Synced at: ${last_commit:0:8}  →  Latest: ${head_commit:0:8}"
    echo ""

    local new_skills=()
    local modified_skills=()
    while IFS= read -r f; do
        local skill_name
        skill_name=$(echo "$f" | sed 's|^databricks-skills/||' | cut -d/ -f1)
        if git -C "$REPO_ROOT" cat-file -e "$last_commit:$f" 2>/dev/null; then
            modified_skills+=("$skill_name")
        else
            new_skills+=("$skill_name")
        fi
    done <<< "$changed_files"

    local unique_new=($(printf '%s\n' "${new_skills[@]}" 2>/dev/null | sort -u))
    local unique_modified=($(printf '%s\n' "${modified_skills[@]}" 2>/dev/null | sort -u))

    if [[ ${#unique_new[@]} -gt 0 ]]; then
        echo -e "  ${GREEN}New:${RESET}      ${unique_new[*]}"
    fi
    if [[ ${#unique_modified[@]} -gt 0 ]]; then
        echo -e "  ${YELLOW}Modified:${RESET} ${unique_modified[*]}"
    fi

    echo ""
    echo -e "  ${CYAN}Preview:${RESET}  git diff ${last_commit:0:8}..${head_commit:0:8} -- databricks-skills/"
    echo -e "  ${CYAN}Sync:${RESET}     ./scripts/check-ai-dev-kit-updates.sh --sync"
    action_needed=1
}

sync_skills() {
    echo ""
    echo -e "${BOLD}Syncing skills from ai-dev-kit...${RESET}"

    local head_commit
    head_commit=$(git -C "$REPO_ROOT" rev-parse "$REMOTE/main")

    local upstream_skills
    upstream_skills=$(git -C "$REPO_ROOT" ls-tree --name-only "$REMOTE/main:databricks-skills/" | grep -v -E '^(README\.md|TEMPLATE|install_skills\.sh|install_skills_to_genie_code\.sh)$')

    local synced=0
    local skipped=0

    while IFS= read -r skill_dir; do
        [[ -z "$skill_dir" ]] && continue

        local tmp_dir
        tmp_dir=$(mktemp -d)

        git -C "$REPO_ROOT" archive "$REMOTE/main" -- "databricks-skills/$skill_dir" | tar -x -C "$tmp_dir" 2>/dev/null || { skipped=$((skipped+1)); rm -rf "$tmp_dir"; continue; }

        if [[ -d "$tmp_dir/databricks-skills/$skill_dir" ]]; then
            cp -R "$tmp_dir/databricks-skills/$skill_dir/" "$REPO_ROOT/skills/$skill_dir/"
            synced=$((synced+1))
        fi

        rm -rf "$tmp_dir"
    done <<< "$upstream_skills"

    save_synced_commit "$head_commit"

    echo -e "  ${GREEN}Synced $synced skills from upstream${RESET}"
    if [[ $skipped -gt 0 ]]; then
        echo -e "  ${YELLOW}Skipped $skipped (archive errors)${RESET}"
    fi
    echo -e "  Sync point: ${head_commit:0:8}"
    echo ""
    echo -e "  ${CYAN}Review changes:${RESET}  git diff --stat"
    echo -e "  ${CYAN}Commit:${RESET}          git add skills/ .ai-dev-kit-sync && git commit -m 'chore: sync skills from ai-dev-kit ${head_commit:0:8}'"
}

check_packages() {
    echo ""
    echo -e "${BOLD}PACKAGES${RESET}"
    echo "────────────────────────────────────────"

    local any_outdated=0

    for pkg in "${PACKAGES[@]}"; do
        local pinned="(not pinned)"
        local pin_line
        pin_line=$(grep -i "^${pkg}" "$REPO_ROOT/requirements.txt" 2>/dev/null || true)
        if [[ -n "$pin_line" ]]; then
            pinned=$(echo "$pin_line" | sed 's/.*[>=<]=*//' | tr -d ' ')
        fi

        local latest=""
        latest=$(curl -sf "https://pypi.org/pypi/$pkg/json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])" 2>/dev/null || true)
        if [[ -z "$latest" ]]; then
            latest=$(pip index versions "$pkg" 2>/dev/null | head -1 | sed 's/.*(\(.*\))/\1/' | tr -d ' ' || true)
        fi

        if [[ -z "$latest" ]]; then
            printf "  %-25s pinned %-12s latest: ${YELLOW}(could not check)${RESET}\n" "$pkg" "$pinned"
            continue
        fi

        if [[ "$pinned" == "$latest" ]]; then
            printf "  %-25s ${GREEN}%-12s (up to date)${RESET}\n" "$pkg" "$pinned"
        elif [[ "$pinned" == "(not pinned)" ]]; then
            printf "  %-25s ${YELLOW}%-12s →  latest: %s${RESET}\n" "$pkg" "$pinned" "$latest"
            any_outdated=1
        else
            printf "  %-25s ${YELLOW}%-12s →  latest: %s${RESET}\n" "$pkg" "$pinned" "$latest"
            any_outdated=1
        fi
    done

    if [[ $any_outdated -eq 1 ]]; then
        echo ""
        echo -e "  ${CYAN}Update:${RESET} Edit requirements.txt, then: pip install -r requirements.txt"
        action_needed=1
    fi
}

check_mcp_tools() {
    echo ""
    echo -e "${BOLD}MCP TOOLS (databricks-mcp-server/)${RESET}"
    echo "────────────────────────────────────────"

    local last_commit
    last_commit=$(get_last_synced_commit)

    if [[ -z "$last_commit" ]]; then
        echo -e "  ${YELLOW}No sync point — skipping${RESET}"
        return
    fi

    local head_commit
    head_commit=$(git -C "$REPO_ROOT" rev-parse "$REMOTE/main")

    local mcp_changes
    mcp_changes=$(git -C "$REPO_ROOT" diff --name-only "$last_commit..$head_commit" -- databricks-mcp-server/ 2>/dev/null || true)

    if [[ -z "$mcp_changes" ]]; then
        echo -e "  ${GREEN}No changes since last sync${RESET}"
        return
    fi

    local file_count
    file_count=$(echo "$mcp_changes" | wc -l | tr -d ' ')
    local commit_count
    commit_count=$(git -C "$REPO_ROOT" rev-list --count "$last_commit..$head_commit" -- databricks-mcp-server/ 2>/dev/null || echo "?")

    echo -e "  ${YELLOW}${file_count} files changed across ${commit_count} commits${RESET}"
    echo ""

    local tool_files
    tool_files=$(echo "$mcp_changes" | grep -E '\.(py|json)$' | head -10 || true)
    if [[ -n "$tool_files" ]]; then
        echo "  Key files:"
        echo "$tool_files" | sed 's/^/    /'
        if [[ $file_count -gt 10 ]]; then
            echo "    ... and $((file_count - 10)) more"
        fi
    fi

    echo ""
    echo -e "  ${CYAN}Review:${RESET}  git log --oneline ${last_commit:0:8}..${head_commit:0:8} -- databricks-mcp-server/"
    echo -e "  ${CYAN}Note:${RESET}    MCP tools are installed via pip (databricks-mcp-server). Update the package version above."
    action_needed=1
}

# ─── Main ───

echo ""
echo -e "${BOLD}═══════════════════════════════════════════${RESET}"
echo -e "${BOLD}  ai-dev-kit Update Check for scrum-demo${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════${RESET}"

ensure_remote

if [[ "${1:-}" == "--sync" ]]; then
    sync_skills
    exit 0
fi

check_skills
check_packages
check_mcp_tools

echo ""
echo "────────────────────────────────────────"
if [[ $action_needed -eq 0 ]]; then
    echo -e "${GREEN}✓ Everything up to date${RESET}"
else
    echo -e "${YELLOW}△ Items to review above${RESET}"
fi
echo ""

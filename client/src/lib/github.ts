import type { GitHubIssue, JiraStory } from './types'

/** Map a GitHub issue into the JiraStory shape so ChatPanel can render without a fork. */
export function githubIssueAsJiraStory(issue: GitHubIssue): JiraStory {
  const assignee = issue.assignee_login || issue.user_login || 'GitHub'
  return {
    key: issue.key,
    summary: issue.title,
    description: issue.body || '_No description provided._',
    acceptance_criteria: [],
    story_points: 0,
    priority: 'Medium',
    assignee,
    labels: issue.labels,
    type: 'generic',
    skill_hint: 'databricks-docs',
    status: issue.state === 'closed' ? 'done' : 'todo',
    sprint: 'GitHub',
  }
}

import type { JiraStory, RallyStory } from './types'

/** Map a Rally user story into the JiraStory shape so ChatPanel can render without a fork. */
export function rallyStoryAsJiraStory(story: RallyStory): JiraStory {
  const done =
    (story.schedule_state || '').toLowerCase() === 'completed' ||
    (story.schedule_state || '').toLowerCase() === 'accepted'
  return {
    key: story.key,
    summary: story.name,
    description: story.description || '_No description provided._',
    acceptance_criteria: [],
    story_points: Math.round(story.plan_estimate || 0),
    priority: story.priority || 'Medium',
    assignee: story.owner_name || 'Unassigned',
    labels: story.tags || [],
    type: 'generic',
    skill_hint: 'databricks-docs',
    status: done ? 'done' : 'todo',
    sprint: story.iteration_name || 'Rally',
  }
}

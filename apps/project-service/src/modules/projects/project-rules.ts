const PROJECT_STATUS_IDS = new Set([
  'backlog',
  'in-progress',
  'done',
  'canceled',
  'paused',
]);

const PROJECT_STATUS_CATEGORIES = new Set([
  'backlog',
  'started',
  'completed',
  'canceled',
  'unstarted',
]);

const PROJECT_PRIORITY_IDS = new Set(['no-priority', 'urgent', 'high', 'medium', 'low']);
const PROJECT_HEALTH_IDS = new Set(['no-update', 'off-track', 'on-track', 'at-risk']);

const STATUS_CATEGORY_BY_ID: Record<string, string> = {
  backlog: 'backlog',
  'in-progress': 'started',
  done: 'completed',
  canceled: 'canceled',
  paused: 'unstarted',
};

export function getProjectPropertyValidationError(input: {
  statusId?: string;
  statusCategory?: string;
  allowCustomStatus?: boolean;
  priorityId?: string;
  healthId?: string;
  percentComplete?: number;
  startDate?: Date;
  targetDate?: Date;
}) {
  if (
    input.statusId !== undefined &&
    !PROJECT_STATUS_IDS.has(input.statusId) &&
    !input.allowCustomStatus
  ) {
    return `Unknown project status ${input.statusId}`;
  }
  if (
    input.statusCategory !== undefined &&
    !PROJECT_STATUS_CATEGORIES.has(input.statusCategory)
  ) {
    return `Unknown project status category ${input.statusCategory}`;
  }
  if (
    input.statusId !== undefined &&
    input.statusCategory !== undefined &&
    STATUS_CATEGORY_BY_ID[input.statusId] !== undefined &&
    STATUS_CATEGORY_BY_ID[input.statusId] !== input.statusCategory
  ) {
    return `Project status ${input.statusId} does not belong to category ${input.statusCategory}`;
  }
  if (input.priorityId !== undefined && !PROJECT_PRIORITY_IDS.has(input.priorityId)) {
    return `Unknown project priority ${input.priorityId}`;
  }
  if (input.healthId !== undefined && !PROJECT_HEALTH_IDS.has(input.healthId)) {
    return `Unknown project health ${input.healthId}`;
  }
  if (
    input.percentComplete !== undefined &&
    (!Number.isFinite(input.percentComplete) ||
      input.percentComplete < 0 ||
      input.percentComplete > 100)
  ) {
    return 'Project percentComplete must be between 0 and 100';
  }
  if (input.startDate && Number.isNaN(input.startDate.getTime())) {
    return 'Project startDate must be a valid ISO date';
  }
  if (input.targetDate && Number.isNaN(input.targetDate.getTime())) {
    return 'Project targetDate must be a valid ISO date';
  }
  if (
    input.startDate &&
    input.targetDate &&
    input.targetDate.getTime() < input.startDate.getTime()
  ) {
    return 'Project targetDate must be on or after startDate';
  }
  return undefined;
}

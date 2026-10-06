export const authKeys = {
   all: ['auth'] as const,
   session: () => [...authKeys.all, 'session'] as const,
};

export const issueKeys = {
   all: ['issues'] as const,
   lists: () => [...issueKeys.all, 'list'] as const,
   list: (filters?: Record<string, unknown>) => [...issueKeys.lists(), filters ?? {}] as const,
   facets: (filters?: Record<string, unknown>) =>
      [...issueKeys.all, 'facets', filters ?? {}] as const,
   details: () => [...issueKeys.all, 'detail'] as const,
   detail: (id: string) => [...issueKeys.details(), id] as const,
   activity: (id: string) => [...issueKeys.detail(id), 'activity'] as const,
   archived: (teamId?: string) => [...issueKeys.all, 'archived', teamId ?? 'all'] as const,
};

export const projectKeys = {
   all: ['projects'] as const,
   lists: () => [...projectKeys.all, 'list'] as const,
   list: (teamId?: string, workspaceId?: string) =>
      [...projectKeys.lists(), { teamId, workspaceId }] as const,
   details: () => [...projectKeys.all, 'detail'] as const,
   detail: (id: string) => [...projectKeys.details(), id] as const,
   overview: (id: string) => [...projectKeys.detail(id), 'overview'] as const,
   activity: (id: string) => [...projectKeys.detail(id), 'activity'] as const,
   subscription: (id: string) => [...projectKeys.detail(id), 'subscription'] as const,
   members: (id: string) => [...projectKeys.detail(id), 'members'] as const,
};

export const projectStatusKeys = {
   all: ['project-statuses'] as const,
   list: (workspaceId?: string) => [...projectStatusKeys.all, { workspaceId }] as const,
};

export const projectTemplateKeys = {
   all: ['project-templates'] as const,
   lists: () => [...projectTemplateKeys.all, 'list'] as const,
   list: (workspaceId?: string, teamId?: string) =>
      [...projectTemplateKeys.lists(), { workspaceId, teamId }] as const,
};

export const issueTemplateKeys = {
   all: ['issue-templates'] as const,
   lists: () => [...issueTemplateKeys.all, 'list'] as const,
   list: (workspaceId?: string, teamId?: string) =>
      [...issueTemplateKeys.lists(), { workspaceId, teamId }] as const,
};

export const teamKeys = {
   all: ['teams'] as const,
   lists: () => [...teamKeys.all, 'list'] as const,
   list: (workspaceId?: string) => [...teamKeys.lists(), { workspaceId }] as const,
   details: () => [...teamKeys.all, 'detail'] as const,
   detail: (id: string) => [...teamKeys.details(), id] as const,
};

export const initiativeKeys = {
   all: ['initiatives'] as const,
   lists: () => [...initiativeKeys.all, 'list'] as const,
   list: (workspaceId?: string) => [...initiativeKeys.lists(), { workspaceId }] as const,
   details: () => [...initiativeKeys.all, 'detail'] as const,
   detail: (id: string) => [...initiativeKeys.details(), id] as const,
};

export const viewKeys = {
   all: ['views'] as const,
   lists: () => [...viewKeys.all, 'list'] as const,
   list: (filters?: { teamId?: string; projectId?: string; workspaceId?: string }) =>
      [...viewKeys.lists(), filters ?? {}] as const,
   details: () => [...viewKeys.all, 'detail'] as const,
   detail: (id: string) => [...viewKeys.details(), id] as const,
};

export const documentKeys = {
   all: ['documents'] as const,
   lists: () => [...documentKeys.all, 'list'] as const,
   list: (teamId?: string) => [...documentKeys.lists(), { teamId }] as const,
   details: () => [...documentKeys.all, 'detail'] as const,
   detail: (id: string) => [...documentKeys.details(), id] as const,
};

export const memberKeys = {
   all: ['members'] as const,
   lists: () => [...memberKeys.all, 'list'] as const,
   list: (workspaceId?: string) => [...memberKeys.lists(), { workspaceId }] as const,
   details: () => [...memberKeys.all, 'detail'] as const,
   detail: (id: string) => [...memberKeys.details(), id] as const,
   teams: (id: string) => [...memberKeys.detail(id), 'teams'] as const,
};

export const cycleKeys = {
   all: ['cycles'] as const,
   lists: () => [...cycleKeys.all, 'list'] as const,
   list: (teamId?: string) => [...cycleKeys.lists(), { teamId }] as const,
   details: () => [...cycleKeys.all, 'detail'] as const,
   detail: (id: string) => [...cycleKeys.details(), id] as const,
   settings: (teamId: string) => [...cycleKeys.all, 'settings', teamId] as const,
   calendarSubscription: (teamId: string) =>
      [...cycleKeys.all, 'calendar-subscription', teamId] as const,
};

export const labelKeys = {
   all: ['labels'] as const,
   lists: () => [...labelKeys.all, 'list'] as const,
   list: (scope: 'issue' | 'project' = 'issue', workspaceId?: string, teamId?: string) =>
      [...labelKeys.lists(), { scope, workspaceId, teamId }] as const,
};

export const reviewKeys = {
   all: ['reviews'] as const,
   lists: () => [...reviewKeys.all, 'list'] as const,
   list: (status?: string) => [...reviewKeys.lists(), { status }] as const,
   details: () => [...reviewKeys.all, 'detail'] as const,
   detail: (id: string) => [...reviewKeys.details(), id] as const,
};

export const attachmentKeys = {
   all: ['attachments'] as const,
   lists: () => [...attachmentKeys.all, 'list'] as const,
   list: (target: { issueIdentifier?: string; projectId?: string }) =>
      [...attachmentKeys.lists(), target] as const,
};

export const agentKeys = {
   all: ['agent'] as const,
   examples: () => [...agentKeys.all, 'examples'] as const,
};

export const workspaceKeys = {
   all: ['workspaces'] as const,
   lists: () => [...workspaceKeys.all, 'list'] as const,
   details: () => [...workspaceKeys.all, 'detail'] as const,
   detail: (idOrSlug: string) => [...workspaceKeys.details(), idOrSlug] as const,
};

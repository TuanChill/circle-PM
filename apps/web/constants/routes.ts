/**
 * Application Route Constants
 * Centralized registry of all public, authentication, onboarding, and workspace routes.
 */

export const ROUTES = {
   // Public & Auth Routes
   INVITE: '/invite',
   AUTH: {
      LOGIN: '/login',
      SIGNUP: '/signup',
      SIGNUP_WITH_INVITATION: (token: string, email?: string) => {
         const params = new URLSearchParams({ invite: token });
         if (email) params.set('email', email);
         return `/signup?${params.toString()}`;
      },
      LOGIN_WITH_INVITATION: (token: string, email?: string) => {
         const params = new URLSearchParams({ invite: token });
         if (email) params.set('email', email);
         return `/login?${params.toString()}`;
      },
      FORGOT_PASSWORD: '/forgot-password',
      RESET_PASSWORD: '/reset-password',
   },

   // Onboarding Flow
   ONBOARDING: '/onboarding',

   // Workspace-level Routes
   WORKSPACE: {
      ROOT: (orgId: string) => `/${orgId}`,
      INBOX: (orgId: string) => `/${orgId}/inbox`,
      MY_ISSUES: (orgId: string) => `/${orgId}/my-issues`,
      ISSUE: (orgId: string, issueIdentifier: string) => `/${orgId}/issue/${issueIdentifier}`,
      AGENT: (orgId: string) => `/${orgId}/agent`,
      INITIATIVES: (orgId: string) => `/${orgId}/initiatives`,
      PROJECTS: (orgId: string) => `/${orgId}/projects`,
      PROJECT_OVERVIEW: (orgId: string, projectId: string) =>
         `/${orgId}/project/${projectId}/overview`,
      PROJECT_ISSUES: (orgId: string, projectId: string) => `/${orgId}/project/${projectId}/issues`,
      PROJECT_ACTIVITY: (orgId: string, projectId: string) =>
         `/${orgId}/project/${projectId}/activity`,
      VIEWS: (orgId: string) => `/${orgId}/views`,
      TEAMS: (orgId: string) => `/${orgId}/teams`,
      MEMBERS: (orgId: string) => `/${orgId}/members`,
      SETTINGS: (orgId: string) => `/${orgId}/settings`,
      SETTINGS_PROFILE: (orgId: string) => `/${orgId}/settings/profile`,
      SETTINGS_PREFERENCES: (orgId: string) => `/${orgId}/settings/preferences`,
      SETTINGS_TEAMS: (orgId: string) => `/${orgId}/settings/teams`,
      SETTINGS_TEAM_DETAIL: (orgId: string, teamId: string) => `/${orgId}/settings/teams/${teamId}`,
      SETTINGS_MEMBERS: (orgId: string) => `/${orgId}/settings/members`,
      SETTINGS_SECURITY: (orgId: string) => `/${orgId}/settings/security`,
      SETTINGS_AI: (orgId: string) => `/${orgId}/settings/ai`,
      SETTINGS_INTEGRATIONS: (orgId: string) => `/${orgId}/settings/integrations`,
      SETTINGS_CONNECTED_ACCOUNTS: (orgId: string) => `/${orgId}/settings/connected-accounts`,
      SETTINGS_NOTIFICATIONS: (orgId: string) => `/${orgId}/settings/notifications`,
      SETTINGS_LABELS: (orgId: string) => `/${orgId}/settings/issue-labels`,
      SETTINGS_TEMPLATES: (orgId: string) => `/${orgId}/settings/issue-templates`,
   },

   // Team-level Routes
   TEAM: {
      HOME: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/overview`,
      ALL_ISSUES: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/all`,
      ACTIVE_ISSUES: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/active`,
      BACKLOG: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/backlog`,
      CYCLES: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/cycles`,
      ARCHIVES: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/archives`,
      CYCLE_ACTIVE: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/cycle/active`,
      CYCLE_UPCOMING: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/cycle/upcoming`,
      PROJECTS: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/projects`,
      VIEWS: (orgId: string, teamId: string) => `/${orgId}/team/${teamId}/views`,
      SETTINGS: (orgId: string, teamId: string) => `/${orgId}/settings/teams/${teamId}`,
   },

   // Workspace dashboard helper. Callers must supply a verified workspace slug.
   DEFAULT_WORKSPACE_DASHBOARD: (orgId: string) => `/${orgId}/my-issues`,
} as const;

export type AppRoutes = typeof ROUTES;

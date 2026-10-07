'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LinearEditor } from '@/components/common/editor/linear-editor';
import { Heart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { useIssueTemplates } from '@/hooks/queries/use-issue-templates-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Issue } from '@/mock-data/issues';
import type { User } from '@/mock-data/users';
import { contentBlocksToMarkdown } from '@/lib/content-blocks-to-markdown';
import { markdownToContentBlocks } from '@/lib/markdown-to-content-blocks';
import { priorities } from '@/lib/priority-catalog';
import { status } from '@/lib/workflow-status';
import { useCreateIssueStore } from '@/store/create-issue-store';
import { toast } from 'sonner';
import { StatusSelector } from './status-selector';
import { PrioritySelector } from './priority-selector';
import { EstimateSelector } from '@/components/common/issues/estimate-selector';
import { AssigneeSelector } from './assignee-selector';
import { ProjectSelector } from './project-selector';
import { CycleSelector } from './cycle-selector';
import { LabelSelector } from './label-selector';
import { DialogTitle } from '@radix-ui/react-dialog';

import { useCreateIssue } from '@/hooks/queries/use-issues-query';
import { useProjects } from '@/hooks/queries/use-projects-query';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { useWorkspaces } from '@/hooks/queries/use-workspaces-query';
import { useQueryClient } from '@tanstack/react-query';
import QueryErrorState from '@/components/common/query-error-state';
import { issueKeys, projectKeys } from '@/hooks/queries/keys';
import { usePathname } from 'next/navigation';
import { useParams } from 'next/navigation';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';

export function CreateNewIssue() {
   const [createMore, setCreateMore] = useState<boolean>(false);
   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
   const [isLabelPickerOpen, setIsLabelPickerOpen] = useState<boolean>(false);
   const isLabelPickerOpenRef = useRef(false);
   const {
      isOpen,
      defaultStatus,
      defaultProject,
      defaultTeamId,
      defaultCycle,
      openModal,
      closeModal,
   } = useCreateIssueStore();
   const createIssueMutation = useCreateIssue();
   const projectsQuery = useProjects();
   const teamsQuery = useTeams();
   const membersQuery = useMembers();
   const labelsQuery = useLabels('issue');
   const workspacesQuery = useWorkspaces();
   const { data: projects = [] } = projectsQuery;
   const { data: teams = [] } = teamsQuery;
   const { data: members = [] } = membersQuery;
   const { data: labels = [] } = labelsQuery;
   const { data: workspaces = [] } = workspacesQuery;
   const queryClient = useQueryClient();
   const pathname = usePathname();
   const { orgId } = useParams<{ orgId: string }>();
   const resolvedWorkspaceId = workspaces.find(
      (workspace) => workspace.id === orgId || workspace.slug === orgId
   )?.id;

   // Route-aware context detection
   const routeProjectMatch = pathname.match(/\/project\/([^/]+)/);
   const routeProjectId = routeProjectMatch ? routeProjectMatch[1] : null;
   const routeProject = routeProjectId ? projects.find((p) => p.id === routeProjectId) : null;

   const routeTeamMatch = pathname.match(/\/team\/([^/]+)/);
   const routeTeamId = routeTeamMatch ? routeTeamMatch[1] : null;

   const activeProject = defaultProject || routeProject || undefined;
   const activeTeamId = activeProject?.teamId || defaultTeamId || routeTeamId || undefined;
   const activeTeam = teams.find((t) => t.id === activeTeamId);
   const issueTemplatesQuery = useIssueTemplates(resolvedWorkspaceId, activeTeamId);
   const { data: issueTemplates = [] } = issueTemplatesQuery;

   // Creating an issue from within a cycle's page (/cycle/active or
   // /cycle/upcoming) should scope it to that cycle, same as the project
   // route-detection above — mirrors cycle-issues.tsx's own cycle lookup.
   const routeCycleMatch = pathname.match(/\/cycle\/(active|upcoming)/);
   const teamCyclesQuery = useCycles(activeTeamId, { requireTeamId: true });
   const { data: teamCycles = [] } = teamCyclesQuery;
   const optionQueries = [
      projectsQuery,
      teamsQuery,
      membersQuery,
      labelsQuery,
      workspacesQuery,
      issueTemplatesQuery,
      teamCyclesQuery,
   ];
   const optionError = optionQueries.find((query) => query.isError)?.error;
   const routeCycle = routeCycleMatch
      ? teamCycles.find(
           (c) => c.status === (routeCycleMatch[1] === 'active' ? 'current' : 'upcoming')
        )
      : null;

   const activeCycle = defaultCycle || routeCycle || undefined;

   const createDefaultData = useCallback(() => {
      return {
         id: 'draft',
         identifier: '',
         title: '',
         description: '',
         status: defaultStatus || status.find((s) => s.id === 'to-do')!,
         assignee: null,
         priority: priorities.find((p) => p.id === 'no-priority')!,
         estimate: null,
         labels: [],
         createdAt: new Date().toISOString(),
         cycleId: activeCycle?.id || '',
         project: activeProject,
         subissues: [],
         rank: '',
      };
   }, [defaultStatus, activeProject, activeCycle]);

   const [addIssueForm, setAddIssueForm] = useState<Issue>(createDefaultData());
   const [selectedTemplateId, setSelectedTemplateId] = useState('none');

   const wasOpen = useRef(false);

   useEffect(() => {
      // Query refetches replace project/team objects while the dialog is open.
      // Resetting from those object changes used to erase the user's title or
      // description and move focus out of the active editor. Initialize only
      // when the dialog transitions from closed to open.
      if (isOpen && !wasOpen.current) {
         setAddIssueForm(createDefaultData());
         setSelectedTemplateId('none');
      }
      wasOpen.current = isOpen;
   }, [isOpen, createDefaultData]);

   const applyIssueTemplate = (templateId: string) => {
      setSelectedTemplateId(templateId);
      if (templateId === 'none') return;
      const template = issueTemplates.find((item) => item.id === templateId);
      if (!template) return;
      const config = template.config;
      const templateStatus = status.find((item) => item.id === config.statusId);
      const templatePriority = priorities.find((item) => item.id === config.priorityId);
      const templateDescription =
         config.description ??
         contentBlocksToMarkdown(
            config.descriptionBlocks as Parameters<typeof contentBlocksToMarkdown>[0]
         );
      setAddIssueForm((current) => ({
         ...current,
         title: config.title || current.title,
         description: templateDescription || current.description,
         status: templateStatus || current.status,
         priority: templatePriority || current.priority,
         estimate: config.estimate ?? current.estimate,
         assignee: (() => {
            if (!config.assigneeId) return current.assignee;
            const templateAssignee = members.find((member) => member.id === config.assigneeId);
            if (!templateAssignee) return null;
            const normalizedStatus: User['status'] = ['online', 'away'].includes(
               templateAssignee.status
            )
               ? (templateAssignee.status as User['status'])
               : 'offline';
            const normalizedRole: User['role'] = ['Admin', 'Guest', 'Application'].includes(
               templateAssignee.role
            )
               ? (templateAssignee.role as User['role'])
               : 'Member';
            return {
               id: templateAssignee.id,
               name: templateAssignee.name,
               avatarUrl: templateAssignee.avatarUrl || '',
               email: templateAssignee.email,
               status: normalizedStatus,
               role: normalizedRole,
               joinedDate: templateAssignee.joinedDate || '',
               teamIds: templateAssignee.teamIds || [],
               timezone: templateAssignee.timezone,
            };
         })(),
         cycleId: config.cycleId ?? current.cycleId,
         project: config.projectId
            ? projects.find((project) => project.id === config.projectId)
            : current.project,
         dueDate: config.dueDate ?? current.dueDate,
         parentIssueId: config.parentIssueId ?? current.parentIssueId,
         milestone: config.milestone ?? current.milestone,
         labels:
            config.labelIds !== undefined
               ? labels.filter((label) => config.labelIds?.includes(label.id))
               : current.labels,
      }));
   };

   const createIssue = async () => {
      if (!addIssueForm.title?.trim()) {
         toast.error('Title is required');
         return;
      }
      if (!activeTeamId) {
         toast.error('Select a team before creating an issue');
         return;
      }

      setIsSubmitting(true);
      try {
         // Backend is the only source of truth; never create a local/mock issue
         // when the canonical mutation fails.
         await createIssueMutation.mutateAsync({
            title: addIssueForm.title.trim(),
            description: addIssueForm.description,
            descriptionBlocks: addIssueForm.description?.trim()
               ? markdownToContentBlocks(addIssueForm.description)
               : undefined,
            statusId: addIssueForm.status?.id,
            statusCategory: addIssueForm.status?.category,
            priorityId: addIssueForm.priority?.id,
            estimate: addIssueForm.estimate,
            assigneeId: addIssueForm.assignee?.id,
            teamId: addIssueForm.project?.teamId || activeProject?.teamId || activeTeamId,
            projectId: addIssueForm.project?.id || activeProject?.id,
            cycleId: addIssueForm.cycleId,
            labelIds: addIssueForm.labels?.map((l) => l.id),
            dueDate: addIssueForm.dueDate,
            parentIssueId: addIssueForm.parentIssueId,
            milestone: addIssueForm.milestone,
            rank: addIssueForm.rank,
         });

         // Refetch and invalidate issues across all components
         await queryClient.invalidateQueries({ queryKey: issueKeys.all });
         await queryClient.invalidateQueries({ queryKey: ['issues'] });
         await queryClient.invalidateQueries({ queryKey: projectKeys.all });
         await queryClient.refetchQueries({ queryKey: ['issues'] });

         if (!createMore) {
            closeModal();
         }
         setAddIssueForm(createDefaultData());
      } finally {
         setIsSubmitting(false);
      }
   };

   const isPickerPopoverInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-slot="popover-content"]')) {
         return true;
      }

      return event
         .composedPath()
         .some((node) => node instanceof Element && node.matches('[data-slot="popover-content"]'));
   };

   return (
      <Dialog
         open={isOpen}
         onOpenChange={(value) => {
            if (value) {
               openModal();
            } else if (!isLabelPickerOpenRef.current) {
               closeModal();
            }
         }}
      >
         <DialogContent
            className="w-full sm:max-w-[750px] p-0 shadow-xl"
            onInteractOutside={(event) => {
               // Picker popovers render in a portal outside the dialog content.
               // Treat their interactions as inside so choosing an option keeps
               // the issue form open.
               if (
                  isLabelPickerOpen ||
                  isLabelPickerOpenRef.current ||
                  isPickerPopoverInteraction(event.detail.originalEvent)
               ) {
                  event.preventDefault();
               }
            }}
         >
            <DialogHeader>
               <DialogTitle>
                  <div className="flex items-center px-4 pt-4 gap-2">
                     <Button size="sm" variant="outline" className="gap-1.5">
                        {activeTeam ? (
                           <span className="text-sm leading-none">{activeTeam.icon}</span>
                        ) : (
                           <Heart className="size-4 text-orange-500 fill-orange-500" />
                        )}
                        <span className="font-medium">{activeTeam?.id || 'Select team'}</span>
                     </Button>
                  </div>
               </DialogTitle>
            </DialogHeader>

            {optionError && (
               <QueryErrorState
                  subject="issue creation options"
                  error={optionError}
                  onRetry={() => {
                     void Promise.all(optionQueries.map((query) => query.refetch()));
                  }}
               />
            )}

            <div className="px-4 pb-0 space-y-3 w-full">
               {issueTemplates.length > 0 && (
                  <Select value={selectedTemplateId} onValueChange={applyIssueTemplate}>
                     <SelectTrigger className="w-52 h-8">
                        <SelectValue placeholder="Issue template" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="none">Blank issue</SelectItem>
                        {issueTemplates.map((template) => (
                           <SelectItem key={template.id} value={template.id}>
                              {template.name}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               )}
               <Input
                  className="border-none w-full shadow-none outline-none text-2xl font-medium px-0 h-auto focus-visible:ring-0 overflow-hidden text-ellipsis whitespace-normal break-words"
                  placeholder="Issue title"
                  value={addIssueForm.title}
                  onChange={(e) => setAddIssueForm({ ...addIssueForm, title: e.target.value })}
               />

               <LinearEditor
                  className="px-0 py-0"
                  minHeight="min-h-16"
                  placeholder="Add description or type '/' for commands..."
                  value={addIssueForm.description}
                  onChange={(newDesc) =>
                     setAddIssueForm((prev) => ({ ...prev, description: newDesc }))
                  }
               />

               <div className="w-full flex items-center justify-start gap-1.5 flex-wrap">
                  <StatusSelector
                     status={addIssueForm.status}
                     onChange={(newStatus) =>
                        setAddIssueForm({ ...addIssueForm, status: newStatus })
                     }
                  />
                  <PrioritySelector
                     priority={addIssueForm.priority}
                     onChange={(newPriority) =>
                        setAddIssueForm({ ...addIssueForm, priority: newPriority })
                     }
                  />
                  <EstimateSelector
                     estimate={addIssueForm.estimate}
                     settings={
                        activeTeam
                           ? {
                                enabled: activeTeam.estimateEnabled ?? false,
                                scale: activeTeam.estimateScale ?? 'fibonacci',
                                extended: activeTeam.estimateExtended ?? false,
                                allowZero: activeTeam.estimateZero ?? false,
                                unestimatedAsOne: activeTeam.unestimatedAsOne ?? true,
                             }
                           : undefined
                     }
                     onChange={(estimate) => setAddIssueForm({ ...addIssueForm, estimate })}
                  />
                  <AssigneeSelector
                     assignee={addIssueForm.assignee}
                     onChange={(newAssignee) =>
                        setAddIssueForm({ ...addIssueForm, assignee: newAssignee })
                     }
                  />
                  <ProjectSelector
                     project={addIssueForm.project}
                     onChange={(newProject) =>
                        setAddIssueForm({ ...addIssueForm, project: newProject })
                     }
                  />
                  <CycleSelector
                     cycle={teamCycles.find((c) => c.id === addIssueForm.cycleId)}
                     teamId={activeTeamId}
                     onChange={(newCycle) =>
                        setAddIssueForm({ ...addIssueForm, cycleId: newCycle?.id || '' })
                     }
                  />
                  <LabelSelector
                     selectedLabels={addIssueForm.labels}
                     teamId={activeTeamId}
                     onOpenChange={(open) => {
                        setIsLabelPickerOpen(open);
                        if (open) {
                           isLabelPickerOpenRef.current = true;
                        } else {
                           window.setTimeout(() => {
                              isLabelPickerOpenRef.current = false;
                           }, 0);
                        }
                     }}
                     onInteractionStart={() => {
                        isLabelPickerOpenRef.current = true;
                     }}
                     onChange={(newLabels) =>
                        setAddIssueForm({ ...addIssueForm, labels: newLabels })
                     }
                  />
               </div>
            </div>
            <div className="flex items-center justify-between py-2.5 px-4 w-full border-t">
               <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                     <Switch
                        id="create-more"
                        checked={createMore}
                        onCheckedChange={setCreateMore}
                     />
                     <Label htmlFor="create-more">Create more</Label>
                  </div>
               </div>
               <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => {
                     createIssue();
                  }}
               >
                  {isSubmitting ? 'Creating...' : 'Create issue'}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
   );
}

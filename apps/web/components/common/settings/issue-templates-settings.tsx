'use client';

import { Button } from '@/components/ui/button';
import QueryErrorState from '@/components/common/query-error-state';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LinearEditor } from '@/components/common/editor/linear-editor';
import { contentBlocksToMarkdown } from '@/lib/content-blocks-to-markdown';
import { markdownToContentBlocks } from '@/lib/markdown-to-content-blocks';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import {
   useIssueTemplates,
   useCreateIssueTemplate,
   useDeleteIssueTemplate,
   useDuplicateIssueTemplate,
   useUpdateIssueTemplate,
} from '@/hooks/queries/use-issue-templates-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { useProjectDetail, useProjects } from '@/hooks/queries/use-projects-query';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { useIssues } from '@/hooks/queries/use-issues-query';
import { priorities } from '@/lib/priority-catalog';
import { status as defaultStatuses } from '@/lib/workflow-status';
import { workflowStatuses } from '@/lib/issue-statuses';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';
import type { Project } from '@/services/projects.service';
import type { Cycle } from '@/services/cycles.service';
import type { CreateIssueTemplatePayload, IssueTemplate } from '@/services/issue-templates.service';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type EditorProps = {
   open: boolean;
   template: IssueTemplate | null;
   workspaceId: string;
   teams: Array<{ id: string; name: string }>;
   members: Array<{ id: string; name: string }>;
   labels: Array<{ id: string; name: string; color: string }>;
   projects: Project[];
   cycles: Cycle[];
   optionError?: { error?: unknown; refetch: () => Promise<unknown> };
   onClose: (open: boolean) => void;
   onCreate: (payload: CreateIssueTemplatePayload) => Promise<void>;
   onUpdate: (id: string, payload: Partial<CreateIssueTemplatePayload>) => Promise<void>;
};

function TemplateEditor({
   open,
   template,
   workspaceId,
   teams,
   members,
   labels,
   projects,
   cycles,
   optionError,
   onClose,
   onCreate,
   onUpdate,
}: EditorProps) {
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [scope, setScope] = useState<'workspace' | 'team'>('workspace');
   const [teamId, setTeamId] = useState('');
   const [title, setTitle] = useState('');
   const [issueDescription, setIssueDescription] = useState('');
   const [parentIssueId, setParentIssueId] = useState('');
   const [milestone, setMilestone] = useState('');
   const [statusId, setStatusId] = useState('to-do');
   const { data: statusRecords } = useIssueStatuses(teamId || undefined);
   const statuses = workflowStatuses(statusRecords);
   const [priorityId, setPriorityId] = useState('no-priority');
   const [estimate, setEstimate] = useState('');
   const [assigneeId, setAssigneeId] = useState('none');
   const [labelIds, setLabelIds] = useState<string[]>([]);
   const [projectId, setProjectId] = useState('none');
   const [cycleId, setCycleId] = useState('none');
   const [dueDate, setDueDate] = useState('');
   const [isDefault, setIsDefault] = useState(false);
   const [parentPickerOpen, setParentPickerOpen] = useState(false);
   const [milestonePickerOpen, setMilestonePickerOpen] = useState(false);
   const parentIssuesQuery = useIssues({ workspaceId, teamId: teamId || undefined });
   const projectDetailQuery = useProjectDetail(projectId === 'none' ? '' : projectId);

   useEffect(() => {
      if (!open) return;
      const config = template?.config ?? {};
      setName(template?.name ?? '');
      setDescription(template?.description ?? '');
      setScope(template?.scope ?? 'workspace');
      setTeamId(template?.teamId ?? '');
      setTitle(config.title ?? '');
      setIssueDescription(
         config.description ??
            contentBlocksToMarkdown(
               config.descriptionBlocks as Parameters<typeof contentBlocksToMarkdown>[0]
            )
      );
      setParentIssueId(config.parentIssueId ?? '');
      setMilestone(config.milestone ?? '');
      setStatusId(config.statusId ?? 'to-do');
      setPriorityId(config.priorityId ?? 'no-priority');
      setEstimate(config.estimate === undefined ? '' : String(config.estimate));
      setAssigneeId(config.assigneeId ?? 'none');
      setLabelIds(config.labelIds ?? []);
      setProjectId(config.projectId ?? 'none');
      setCycleId(config.cycleId ?? 'none');
      setDueDate(config.dueDate ?? '');
      setIsDefault(template?.isDefault ?? false);
   }, [open, template]);

   const availableProjects = projects.filter((project) => !teamId || project.teamId === teamId);
   const availableCycles = cycles.filter((cycle) => !teamId || cycle.teamId === teamId);
   const parentIssues = (parentIssuesQuery.data ?? []).filter(
      (issue) => issue.teamId === teamId && issue.identifier !== parentIssueId
   );
   const selectedParent = (parentIssuesQuery.data ?? []).find(
      (issue) => issue.id === parentIssueId || issue.identifier === parentIssueId
   );
   const projectMilestones = projectDetailQuery.data?.milestones ?? [];
   const selectedMilestone = projectMilestones.find(
      (item) => item.id === milestone || item.name === milestone
   );

   const toggleLabel = (id: string) =>
      setLabelIds((current) =>
         current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      );
   const submit = async (event: FormEvent) => {
      event.preventDefault();
      const payload = {
         workspaceId,
         name: name.trim(),
         description: description.trim() || undefined,
         scope,
         teamId: scope === 'team' ? teamId : undefined,
         isDefault,
         config: {
            title: title.trim() || undefined,
            description: issueDescription || undefined,
            descriptionBlocks: issueDescription.trim()
               ? markdownToContentBlocks(issueDescription)
               : undefined,
            statusId,
            statusCategory: statuses.find((item) => item.id === statusId)?.category ?? 'unstarted',
            priorityId,
            estimate: estimate === '' ? undefined : Number(estimate),
            assigneeId: assigneeId === 'none' ? undefined : assigneeId,
            labelIds,
            projectId: projectId === 'none' ? undefined : projectId,
            cycleId: cycleId === 'none' ? undefined : cycleId,
            dueDate: dueDate || undefined,
            parentIssueId: parentIssueId.trim() || undefined,
            milestone: milestone.trim() || undefined,
         },
      } satisfies CreateIssueTemplatePayload;
      if (template) await onUpdate(template.id, payload);
      else await onCreate(payload);
   };

   return (
      <Dialog open={open} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={submit}>
               <DialogHeader>
                  <DialogTitle>
                     {template ? 'Edit issue template' : 'New issue template'}
                  </DialogTitle>
                  <DialogDescription>
                     Save real issue defaults for workspace or team issue creation.
                  </DialogDescription>
                  {optionError && (
                     <QueryErrorState
                        subject="issue template options"
                        error={optionError.error}
                        onRetry={() => void optionError.refetch()}
                        compact
                     />
                  )}
               </DialogHeader>
               <div className="space-y-4 py-4">
                  <Input
                     placeholder="Template name"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                     required
                     autoFocus
                  />
                  <Textarea
                     placeholder="Template description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                     <Select
                        value={scope}
                        onValueChange={(value: 'workspace' | 'team') => {
                           setScope(value);
                           if (value === 'workspace') {
                              setTeamId('');
                              setParentIssueId('');
                           }
                        }}
                     >
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="workspace">Workspace</SelectItem>
                           <SelectItem value="team">Team</SelectItem>
                        </SelectContent>
                     </Select>
                     {scope === 'team' && (
                        <Select
                           value={teamId}
                           onValueChange={(value) => {
                              setTeamId(value);
                              setParentIssueId('');
                              if (
                                 projectId !== 'none' &&
                                 !projects.some(
                                    (item) => item.id === projectId && item.teamId === value
                                 )
                              )
                                 setProjectId('none');
                              if (
                                 cycleId !== 'none' &&
                                 !cycles.some(
                                    (item) => item.id === cycleId && item.teamId === value
                                 )
                              )
                                 setCycleId('none');
                           }}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Team" />
                           </SelectTrigger>
                           <SelectContent>
                              {teams.map((team) => (
                                 <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     )}
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-sm font-medium" htmlFor="issue-template-estimate">
                        Estimate (optional)
                     </label>
                     <Input
                        id="issue-template-estimate"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Configured by the team"
                        value={estimate}
                        onChange={(event) => setEstimate(event.target.value)}
                     />
                     <p className="text-xs text-muted-foreground">
                        Team templates validate this value against the team estimate scale.
                     </p>
                  </div>
                  <Input
                     placeholder="Default issue title"
                     value={title}
                     onChange={(event) => setTitle(event.target.value)}
                  />
                  <div className="rounded-md border px-3">
                     <LinearEditor
                        value={issueDescription}
                        onChange={setIssueDescription}
                        placeholder="Default issue description or type '/' for commands..."
                        minHeight="min-h-[100px]"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <Popover open={parentPickerOpen} onOpenChange={setParentPickerOpen}>
                        <PopoverTrigger asChild>
                           <Button
                              type="button"
                              variant="outline"
                              className="justify-start font-normal truncate"
                              disabled={scope !== 'team' || !teamId}
                           >
                              {selectedParent
                                 ? `${selectedParent.identifier} · ${selectedParent.title}`
                                 : 'Default parent issue'}
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="start">
                           <Command>
                              <CommandInput placeholder="Search parent issues..." />
                              <CommandList>
                                 <CommandEmpty>
                                    {parentIssuesQuery.isLoading
                                       ? 'Loading issues...'
                                       : parentIssuesQuery.isError
                                         ? 'Could not load issues.'
                                         : 'No issues found.'}
                                 </CommandEmpty>
                                 <CommandGroup>
                                    <CommandItem
                                       value="no-parent"
                                       onSelect={() => {
                                          setParentIssueId('');
                                          setParentPickerOpen(false);
                                       }}
                                    >
                                       No parent issue
                                    </CommandItem>
                                    {parentIssues.map((issue) => (
                                       <CommandItem
                                          key={issue.id}
                                          value={`${issue.identifier} ${issue.title}`}
                                          onSelect={() => {
                                             setParentIssueId(issue.identifier);
                                             setParentPickerOpen(false);
                                          }}
                                       >
                                          <span className="text-muted-foreground shrink-0">
                                             {issue.identifier}
                                          </span>
                                          <span className="truncate">{issue.title}</span>
                                       </CommandItem>
                                    ))}
                                 </CommandGroup>
                              </CommandList>
                           </Command>
                        </PopoverContent>
                     </Popover>
                     {projectId === 'none' ? (
                        <Input
                           placeholder="Select a project for milestones"
                           value={milestone}
                           onChange={(event) => setMilestone(event.target.value)}
                        />
                     ) : (
                        <Popover open={milestonePickerOpen} onOpenChange={setMilestonePickerOpen}>
                           <PopoverTrigger asChild>
                              <Button
                                 type="button"
                                 variant="outline"
                                 className="justify-start font-normal truncate"
                              >
                                 {selectedMilestone?.name ?? 'Default milestone'}
                              </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[320px] p-0" align="start">
                              <Command>
                                 <CommandInput placeholder="Search project milestones..." />
                                 <CommandList>
                                    <CommandEmpty>
                                       {projectDetailQuery.isLoading
                                          ? 'Loading milestones...'
                                          : projectDetailQuery.isError
                                            ? 'Could not load project milestones.'
                                            : 'No milestones found.'}
                                    </CommandEmpty>
                                    <CommandGroup>
                                       <CommandItem
                                          value="no-milestone"
                                          onSelect={() => {
                                             setMilestone('');
                                             setMilestonePickerOpen(false);
                                          }}
                                       >
                                          No milestone
                                       </CommandItem>
                                       {projectMilestones.map((item) => (
                                          <CommandItem
                                             key={item.id}
                                             value={`${item.name} ${item.targetDate ?? ''}`}
                                             onSelect={() => {
                                                setMilestone(item.name);
                                                setMilestonePickerOpen(false);
                                             }}
                                          >
                                             <span className="truncate">{item.name}</span>
                                          </CommandItem>
                                       ))}
                                    </CommandGroup>
                                 </CommandList>
                              </Command>
                           </PopoverContent>
                        </Popover>
                     )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                     <Select value={statusId} onValueChange={setStatusId}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {(teamId ? statuses : defaultStatuses).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                 {item.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Select value={priorityId} onValueChange={setPriorityId}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {priorities.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                 {item.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger>
                           <SelectValue placeholder="Assignee" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="none">No assignee</SelectItem>
                           {members.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                 {member.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                     <Select
                        value={projectId}
                        onValueChange={(value) => {
                           setProjectId(value);
                           setMilestone('');
                           if (value !== 'none') {
                              const project = projects.find((item) => item.id === value);
                              if (project && teamId && project.teamId !== teamId)
                                 setTeamId(project.teamId);
                           }
                        }}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Project" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="none">No project</SelectItem>
                           {availableProjects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                 {project.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Select value={cycleId} onValueChange={setCycleId}>
                        <SelectTrigger>
                           <SelectValue placeholder="Cycle" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="none">No cycle</SelectItem>
                           {availableCycles.map((cycle) => (
                              <SelectItem key={cycle.id} value={cycle.id}>
                                 {cycle.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Input
                        type="date"
                        aria-label="Default due date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                     />
                  </div>
                  <div>
                     <p className="text-sm font-medium mb-2">Default labels</p>
                     <div className="flex flex-wrap gap-2">
                        {labels.map((label) => (
                           <Button
                              type="button"
                              key={label.id}
                              size="xs"
                              variant={labelIds.includes(label.id) ? 'default' : 'outline'}
                              onClick={() => toggleLabel(label.id)}
                           >
                              {label.name}
                           </Button>
                        ))}
                     </div>
                  </div>
                  {scope === 'team' && (
                     <label className="flex items-center gap-2 text-sm">
                        <input
                           type="checkbox"
                           checked={isDefault}
                           onChange={(event) => setIsDefault(event.target.checked)}
                        />
                        Default template for this team
                     </label>
                  )}
               </div>
               <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => onClose(false)}>
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     disabled={
                        !name.trim() || (scope === 'team' && !teamId) || Boolean(optionError)
                     }
                  >
                     {template ? 'Save changes' : 'Create template'}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}

export default function IssueTemplatesSettings() {
   const { orgId } = useParams<{ orgId: string }>();
   const { data: templates = [], isLoading, isError, error, refetch } = useIssueTemplates(orgId);
   const teamsQuery = useTeams();
   const membersQuery = useMembers();
   const labelsQuery = useLabels('issue');
   const projectsQuery = useProjects(undefined, orgId);
   const cyclesQuery = useCycles();
   const { data: teams = [] } = teamsQuery;
   const { data: members = [] } = membersQuery;
   const { data: labels = [] } = labelsQuery;
   const { data: projects = [] } = projectsQuery;
   const { data: cycles = [] } = cyclesQuery;
   const optionError = [teamsQuery, membersQuery, labelsQuery, projectsQuery, cyclesQuery].find(
      (query) => query.isError
   );
   const create = useCreateIssueTemplate();
   const update = useUpdateIssueTemplate();
   const duplicate = useDuplicateIssueTemplate();
   const remove = useDeleteIssueTemplate();
   const [filter, setFilter] = useState('');
   const [editing, setEditing] = useState<IssueTemplate | null>(null);
   const [open, setOpen] = useState(false);
   const rows = useMemo(
      () => templates.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())),
      [templates, filter]
   );
   return (
      <div className="w-full overflow-y-auto h-full">
         <div className="max-w-5xl mx-auto px-6 py-10 pb-20">
            <h1 className="text-2xl font-medium mb-2">Issue templates</h1>
            <p className="text-sm text-muted-foreground mb-6">
               Create reusable issue defaults for every workspace or a specific team.
            </p>
            <div className="flex justify-between gap-3 mb-6">
               <Input
                  className="w-64 h-8"
                  placeholder="Filter by name..."
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
               />
               <Button
                  size="xs"
                  disabled={Boolean(optionError)}
                  onClick={() => {
                     setEditing(null);
                     setOpen(true);
                  }}
               >
                  New template
               </Button>
            </div>
            {optionError && (
               <QueryErrorState
                  subject="issue template options"
                  error={optionError.error}
                  onRetry={() => void optionError.refetch()}
                  compact
               />
            )}
            {isError && (
               <QueryErrorState subject="issue templates" error={error} onRetry={refetch} />
            )}
            {isLoading && (
               <p className="text-sm text-muted-foreground py-6">Loading templates...</p>
            )}
            {!isLoading && !isError && (
               <div className="space-y-6">
                  {(['workspace', 'team'] as const).map((scope) => {
                     const scoped = rows.filter((item) => item.scope === scope);
                     return (
                        <section key={scope}>
                           <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                              {scope === 'workspace' ? 'Workspace templates' : 'Team templates'}
                           </h2>
                           <div className="border rounded-lg overflow-hidden">
                              {scoped.map((item) => (
                                 <div
                                    key={item.id}
                                    className="flex items-center gap-3 px-3 py-3 border-b last:border-b-0"
                                 >
                                    <div className="flex-1 min-w-0">
                                       <div className="font-medium truncate">
                                          {item.name}
                                          {item.isDefault && (
                                             <span className="ml-2 text-xs text-primary">
                                                Default
                                             </span>
                                          )}
                                       </div>
                                       <div className="text-xs text-muted-foreground truncate">
                                          {item.description || 'No description'}
                                          {item.scope === 'team' &&
                                             ` · ${teams.find((team) => team.id === item.teamId)?.name ?? item.teamId}`}
                                       </div>
                                    </div>
                                    <Button
                                       size="xs"
                                       variant="ghost"
                                       onClick={() => {
                                          setEditing(item);
                                          setOpen(true);
                                       }}
                                    >
                                       Edit
                                    </Button>
                                    <Button
                                       size="xs"
                                       variant="ghost"
                                       onClick={() => duplicate.mutate(item.id)}
                                    >
                                       Duplicate
                                    </Button>
                                    <Button
                                       size="xs"
                                       variant="ghost"
                                       className="text-destructive"
                                       onClick={() => {
                                          if (window.confirm(`Delete template "${item.name}"?`))
                                             remove.mutate(item.id);
                                       }}
                                    >
                                       Delete
                                    </Button>
                                 </div>
                              ))}
                              {scoped.length === 0 && (
                                 <p className="text-sm text-muted-foreground px-3 py-5">
                                    No {scope} templates.
                                 </p>
                              )}
                           </div>
                        </section>
                     );
                  })}
               </div>
            )}
         </div>
         <TemplateEditor
            open={open}
            onClose={setOpen}
            workspaceId={orgId}
            template={editing}
            teams={teams}
            members={members}
            labels={labels}
            projects={projects}
            cycles={cycles}
            optionError={optionError}
            onCreate={async (payload) => {
               await create.mutateAsync(payload);
               setOpen(false);
            }}
            onUpdate={async (id, payload) => {
               await update.mutateAsync({ id, payload });
               setOpen(false);
            }}
         />
      </div>
   );
}

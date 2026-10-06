/* eslint-disable @typescript-eslint/no-explicit-any -- compact settings form passes heterogeneous API models */
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
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { useInitiatives } from '@/hooks/queries/use-initiatives-query';
import {
   useCreateProjectTemplate,
   useDeleteProjectTemplate,
   useDuplicateProjectTemplate,
   useProjectTemplates,
   useUpdateProjectTemplate,
} from '@/hooks/queries/use-project-templates-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { useProjectStatuses } from '@/hooks/queries/use-project-statuses-query';
import { getProjectStatusOptions } from '@/lib/project-status';
import type { ProjectTemplate, ProjectTemplateConfig } from '@/services/project-templates.service';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';

const priorities = [
   ['no-priority', 'No priority'],
   ['urgent', 'Urgent'],
   ['high', 'High'],
   ['medium', 'Medium'],
   ['low', 'Low'],
];
const lines = (value: string) =>
   value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

function makeConfig(
   milestones: string,
   issues: string,
   statusId: string,
   statusOptions: any[],
   priorityId: string,
   leadId: string,
   initiativeId: string,
   memberIds: string[],
   teamIds: string[]
): ProjectTemplateConfig {
   return {
      project: {
         statusId,
         statusCategory: statusOptions.find((status) => status.id === statusId)?.category,
         priorityId,
         teamIds,
         leadId: leadId || undefined,
         initiativeId: initiativeId === 'none' ? undefined : initiativeId,
         memberIds,
      },
      milestones: lines(milestones).map((name, index) => ({
         key: `milestone-${index + 1}`,
         name,
         orderIndex: index,
      })),
      issues: lines(issues).map((line, index) => {
         const [key, title, parentKey] = line.split('|').map((part) => part.trim());
         return {
            key: key || `issue-${index + 1}`,
            title: title || key,
            parentKey: parentKey || undefined,
         };
      }),
   };
}

function TemplateEditor({
   open,
   template,
   workspaceId,
   teams,
   members,
   initiatives,
   statusOptions,
   optionError,
   onClose,
   onCreate,
   onUpdate,
}: any) {
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [scope, setScope] = useState<'workspace' | 'team'>('workspace');
   const [teamId, setTeamId] = useState('');
   const [teamIds, setTeamIds] = useState<string[]>([]);
   const [statusId, setStatusId] = useState('in-progress');
   const [priorityId, setPriorityId] = useState('no-priority');
   const [leadId, setLeadId] = useState('');
   const [initiativeId, setInitiativeId] = useState('none');
   const [memberIds, setMemberIds] = useState<string[]>([]);
   const [milestones, setMilestones] = useState('');
   const [issues, setIssues] = useState('');
   useEffect(() => {
      if (!open) return;
      const project = template?.config?.project ?? {};
      setName(template?.name ?? '');
      setDescription(template?.description ?? '');
      setScope(template?.scope ?? 'workspace');
      setTeamId(template?.teamId ?? '');
      setTeamIds(
         project.teamIds ??
            (template?.scope === 'team' && template?.teamId ? [template.teamId] : [])
      );
      setStatusId(project.statusId ?? 'in-progress');
      setPriorityId(project.priorityId ?? 'no-priority');
      setLeadId(project.leadId ?? '');
      setInitiativeId(project.initiativeId ?? 'none');
      setMemberIds(project.memberIds ?? []);
      setMilestones((template?.config?.milestones ?? []).map((item: any) => item.name).join('\n'));
      setIssues(
         (template?.config?.issues ?? [])
            .map((item: any) => [item.key, item.title, item.parentKey].filter(Boolean).join(' | '))
            .join('\n')
      );
   }, [open, template, teams]);
   const submit = async (event: FormEvent) => {
      event.preventDefault();
      const payload = {
         workspaceId,
         name: name.trim(),
         description: description.trim() || undefined,
         scope,
         teamId: scope === 'team' ? teamId : undefined,
         config: makeConfig(
            milestones,
            issues,
            statusId,
            statusOptions,
            priorityId,
            leadId,
            initiativeId,
            memberIds,
            scope === 'team' ? [teamId] : teamIds
         ),
      };
      if (template) await onUpdate(template.id, payload);
      else await onCreate(payload);
   };
   return (
      <Dialog open={open} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={submit}>
               <DialogHeader>
                  <DialogTitle>
                     {template ? 'Edit project template' : 'New project template'}
                  </DialogTitle>
                  <DialogDescription>
                     Reusable project setup with milestones and issues.
                  </DialogDescription>
                  {optionError && (
                     <QueryErrorState
                        subject="project template options"
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
                     placeholder="Description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                     <Select
                        value={scope}
                        onValueChange={(value: 'workspace' | 'team') => setScope(value)}
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
                        <Select value={teamId} onValueChange={setTeamId}>
                           <SelectTrigger>
                              <SelectValue placeholder="Team" />
                           </SelectTrigger>
                           <SelectContent>
                              {teams.map((team: any) => (
                                 <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     )}
                  </div>
                  {scope === 'workspace' && (
                     <div>
                        <div className="flex items-center justify-between mb-2">
                           <p className="text-sm font-medium">Project teams</p>
                           <span className="text-xs text-muted-foreground">
                              {teamIds.length} selected
                           </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {teams.map((team: any) => {
                              const selected = teamIds.includes(team.id);
                              return (
                                 <Button
                                    key={team.id}
                                    type="button"
                                    size="xs"
                                    variant={selected ? 'default' : 'outline'}
                                    onClick={() =>
                                       setTeamIds((current) =>
                                          selected
                                             ? current.filter((id) => id !== team.id)
                                             : [...current, team.id]
                                       )
                                    }
                                 >
                                    {team.icon} {team.name}
                                    {selected && <Check className="size-3.5 ml-1" />}
                                 </Button>
                              );
                           })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                           Workspace templates can be used by any selected team.
                        </p>
                     </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                     <Select value={statusId} onValueChange={setStatusId}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {statusOptions.map((status: any) => (
                              <SelectItem key={status.id} value={status.id}>
                                 {status.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Select value={priorityId} onValueChange={setPriorityId}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {priorities.map(([id, label]) => (
                              <SelectItem key={id} value={id}>
                                 {label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <Select
                        value={leadId || 'none'}
                        onValueChange={(value) => setLeadId(value === 'none' ? '' : value)}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Lead" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="none">No lead</SelectItem>
                           {members.map((member: any) => (
                              <SelectItem key={member.id} value={member.id}>
                                 {member.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
                  <Select value={initiativeId} onValueChange={setInitiativeId}>
                     <SelectTrigger>
                        <SelectValue placeholder="Initiative" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="none">No initiative</SelectItem>
                        {initiatives.map((item: any) => (
                           <SelectItem key={item.id} value={item.id}>
                              {item.name}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
                  <div>
                     <p className="text-sm font-medium mb-2">Project members</p>
                     <div className="flex flex-wrap gap-2">
                        {members.map((member: any) => (
                           <Button
                              type="button"
                              size="xs"
                              variant={memberIds.includes(member.id) ? 'default' : 'outline'}
                              key={member.id}
                              onClick={() =>
                                 setMemberIds((current) =>
                                    current.includes(member.id)
                                       ? current.filter((id) => id !== member.id)
                                       : [...current, member.id]
                                 )
                              }
                           >
                              {member.name}
                           </Button>
                        ))}
                     </div>
                  </div>
                  <div>
                     <p className="text-sm font-medium mb-1">Milestones</p>
                     <Textarea
                        placeholder="One milestone per line"
                        value={milestones}
                        onChange={(event) => setMilestones(event.target.value)}
                     />
                  </div>
                  <div>
                     <p className="text-sm font-medium mb-1">Issues</p>
                     <Textarea
                        placeholder="key | issue title | parentKey (optional), one per line"
                        value={issues}
                        onChange={(event) => setIssues(event.target.value)}
                     />
                  </div>
               </div>
               <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => onClose(false)}>
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     disabled={
                        !name.trim() ||
                        (scope === 'team' && !teamId) ||
                        Boolean(optionError) ||
                        !statusOptions.some((status: any) => status.id === statusId)
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

export default function ProjectTemplatesSettings() {
   const { orgId } = useParams<{ orgId: string }>();
   const { data: templates = [], isLoading, isError, error, refetch } = useProjectTemplates(orgId);
   const teamsQuery = useTeams();
   const membersQuery = useMembers();
   const initiativesQuery = useInitiatives();
   const statusesQuery = useProjectStatuses(orgId);
   const statusOptions = getProjectStatusOptions(statusesQuery.data ?? []);
   const { data: teams = [] } = teamsQuery;
   const { data: members = [] } = membersQuery;
   const { data: initiatives = [] } = initiativesQuery;
   const optionError = [teamsQuery, membersQuery, initiativesQuery, statusesQuery].find(
      (query) => query.isError
   );
   const create = useCreateProjectTemplate();
   const update = useUpdateProjectTemplate();
   const duplicate = useDuplicateProjectTemplate();
   const remove = useDeleteProjectTemplate();
   const [filter, setFilter] = useState('');
   const [editing, setEditing] = useState<ProjectTemplate | null>(null);
   const [open, setOpen] = useState(false);
   const rows = useMemo(
      () => templates.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())),
      [templates, filter]
   );
   return (
      <div className="w-full overflow-y-auto h-full">
         <div className="max-w-5xl mx-auto px-6 py-10 pb-20">
            <h1 className="text-2xl font-medium mb-2">Project templates</h1>
            <p className="text-sm text-muted-foreground mb-6">
               Create repeatable projects with predefined issues and milestones.
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
                  subject="project template options"
                  error={optionError.error}
                  onRetry={() => void optionError.refetch()}
                  compact
               />
            )}
            {isError && (
               <QueryErrorState subject="project templates" error={error} onRetry={refetch} />
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
            initiatives={initiatives}
            statusOptions={statusOptions}
            optionError={optionError}
            onCreate={async (payload: any) => {
               await create.mutateAsync(payload);
               setOpen(false);
            }}
            onUpdate={async (id: string, payload: any) => {
               await update.mutateAsync({ id, payload });
               setOpen(false);
            }}
         />
      </div>
   );
}

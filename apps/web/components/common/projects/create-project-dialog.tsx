'use client';

import * as React from 'react';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { useCreateProject } from '@/hooks/queries/use-projects-query';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useInitiatives } from '@/hooks/queries/use-initiatives-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { useWorkspaces } from '@/hooks/queries/use-workspaces-query';
import { useProjectStatuses } from '@/hooks/queries/use-project-statuses-query';
import {
   useCreateProjectFromTemplate,
   useProjectTemplates,
} from '@/hooks/queries/use-project-templates-query';
import {
   Boxes,
   Check,
   Code,
   Compass,
   Cpu,
   Database,
   Folder,
   Globe,
   Layers,
   Layout,
   Loader2,
   Plus,
   Shield,
   Sparkles,
   Vault,
   Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { renderPriorityIcon } from '@/lib/priority-utils';
import { getProjectStatusOptions } from '@/lib/project-status';
import { useParams } from 'next/navigation';
import QueryErrorState from '@/components/common/query-error-state';

interface CreateProjectDialogProps {
   trigger?: React.ReactNode;
   open?: boolean;
   onOpenChange?: (open: boolean) => void;
   defaultTeamId?: string;
}

const PROJECT_ICONS = [
   { name: 'Vault', icon: Vault },
   { name: 'Boxes', icon: Boxes },
   { name: 'Layers', icon: Layers },
   { name: 'Shield', icon: Shield },
   { name: 'Folder', icon: Folder },
   { name: 'Layout', icon: Layout },
   { name: 'Code', icon: Code },
   { name: 'Cpu', icon: Cpu },
   { name: 'Zap', icon: Zap },
   { name: 'Globe', icon: Globe },
   { name: 'Database', icon: Database },
   { name: 'Sparkles', icon: Sparkles },
   { name: 'Compass', icon: Compass },
];

const HEALTH_OPTIONS = [
   { id: 'on-track', name: 'On track', color: '#30a46c' },
   { id: 'at-risk', name: 'At risk', color: '#f76808' },
   { id: 'off-track', name: 'Off track', color: '#e5484d' },
   { id: 'no-update', name: 'No update', color: '#95a2b3' },
];

const PRIORITY_OPTIONS = [
   { id: 'no-priority', name: 'No priority' },
   { id: 'urgent', name: 'Urgent' },
   { id: 'high', name: 'High' },
   { id: 'medium', name: 'Medium' },
   { id: 'low', name: 'Low' },
];

export function CreateProjectDialog({
   trigger,
   open: controlledOpen,
   onOpenChange: setControlledOpen,
   defaultTeamId,
}: CreateProjectDialogProps) {
   const [internalOpen, setInternalOpen] = React.useState(false);
   const isControlled = controlledOpen !== undefined;
   const open = isControlled ? controlledOpen : internalOpen;
   const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

   const createProjectMutation = useCreateProject();
   const createFromTemplateMutation = useCreateProjectFromTemplate();
   const { orgId } = useParams<{ orgId: string }>();
   const workspacesQuery = useWorkspaces();
   const { data: workspaces = [] } = workspacesQuery;
   const resolvedWorkspaceId = workspaces.find(
      (workspace) => workspace.id === orgId || workspace.slug === orgId
   )?.id;
   const projectStatusesQuery = useProjectStatuses(resolvedWorkspaceId);
   const projectStatusOptions = getProjectStatusOptions(projectStatusesQuery.data ?? []);
   const teamsQuery = useTeams();
   const membersQuery = useMembers();
   const initiativesQuery = useInitiatives();
   const labelsQuery = useLabels('project');
   const templatesQuery = useProjectTemplates(resolvedWorkspaceId);
   const { data: teams = [] } = teamsQuery;
   const { data: members = [] } = membersQuery;
   const { data: initiatives = [] } = initiativesQuery;
   const { data: labels = [] } = labelsQuery;
   const { data: templates = [] } = templatesQuery;
   const optionQueries = [
      workspacesQuery,
      teamsQuery,
      membersQuery,
      initiativesQuery,
      labelsQuery,
      templatesQuery,
      projectStatusesQuery,
   ];
   const optionError = optionQueries.find((query) => query.isError)?.error;

   const [name, setName] = React.useState('');
   const [teamId, setTeamId] = React.useState(defaultTeamId ?? '');
   const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>(
      defaultTeamId ? [defaultTeamId] : []
   );
   const [selectedIcon, setSelectedIcon] = React.useState('Vault');
   const [leadId, setLeadId] = React.useState('');
   const [statusId, setStatusId] = React.useState('in-progress');
   const [priorityId, setPriorityId] = React.useState('no-priority');
   const [healthId, setHealthId] = React.useState('on-track');
   const [startDate, setStartDate] = React.useState('');
   const [targetDate, setTargetDate] = React.useState('');
   const [initiativeId, setInitiativeId] = React.useState<string>('none');
   const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([]);
   const [selectedTemplateId, setSelectedTemplateId] = React.useState('none');
   const [summary, setSummary] = React.useState('');
   const [isSubmitting, setIsSubmitting] = React.useState(false);

   // Sync defaultTeamId when changed
   React.useEffect(() => {
      const nextTeamId =
         defaultTeamId || (teamId && teams.some((team) => team.id === teamId) ? teamId : '');
      if (!nextTeamId) {
         setTeamId('');
         setSelectedTeamIds((previous) =>
            previous.filter((id) => teams.some((team) => team.id === id))
         );
         return;
      }
      setTeamId(nextTeamId);
      setSelectedTeamIds((previous) => {
         const next = [
            nextTeamId,
            ...previous.filter((id) => id !== nextTeamId && teams.some((team) => team.id === id)),
         ];
         return previous.length === next.length && previous.every((id, index) => id === next[index])
            ? previous
            : next;
      });
   }, [defaultTeamId, teams, teamId]);

   // Project lead is optional; never assign an arbitrary workspace member.
   React.useEffect(() => {
      if (leadId && !members.some((member) => member.id === leadId)) setLeadId('');
   }, [members, leadId]);

   const toggleLabel = (labelId: string) => {
      setSelectedLabelIds((prev) =>
         prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
      );
   };

   const applyTemplate = (templateId: string) => {
      setSelectedTemplateId(templateId);
      if (templateId === 'none') return;
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;
      const config = template.config.project ?? {};
      if (template.scope === 'team' && template.teamId) {
         setTeamId(template.teamId);
         setSelectedTeamIds([template.teamId]);
      } else if (config.teamIds?.length) {
         setTeamId(config.teamIds[0]);
         setSelectedTeamIds(config.teamIds);
      }
      if (config.statusId) setStatusId(config.statusId);
      if (config.priorityId) setPriorityId(config.priorityId);
      if (config.healthId) setHealthId(config.healthId);
      if (config.leadId) setLeadId(config.leadId);
      if (config.initiativeId) setInitiativeId(config.initiativeId);
      if (config.labelIds) setSelectedLabelIds(config.labelIds);
      if (config.summary) setSummary(config.summary);
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) {
         toast.error('Please enter a project name');
         return;
      }
      if (!teamId) {
         toast.error('Please select a team');
         return;
      }

      const selectedStatus = projectStatusOptions.find((status) => status.id === statusId);
      if (!selectedStatus) {
         toast.error('The selected project status is not available in this workspace');
         return;
      }

      setIsSubmitting(true);
      try {
         const payload: Record<string, unknown> = {
            name: trimmedName,
            teamId,
            teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : [teamId],
            leadId: leadId || undefined,
            statusId: selectedStatus.id,
            statusCategory: selectedStatus.category,
            priorityId,
            healthId,
            percentComplete: selectedStatus.id === 'done' ? 100 : 0,
            icon: selectedIcon,
            startDate: startDate || undefined,
            targetDate: targetDate || undefined,
            initiativeId: initiativeId !== 'none' ? initiativeId : undefined,
            labelIds: selectedLabelIds,
            summary: summary.trim() || undefined,
         };

         if (selectedTemplateId !== 'none') {
            await createFromTemplateMutation.mutateAsync({
               id: selectedTemplateId,
               name: trimmedName,
               teamId,
               overrides: payload,
            });
         } else {
            await createProjectMutation.mutateAsync(
               payload as unknown as Partial<import('@/mock-data/projects').Project>
            );
         }

         toast.success(`Project "${trimmedName}" created successfully`);
         setName('');
         setSummary('');
         setTargetDate('');
         setSelectedLabelIds([]);
         setSelectedTemplateId('none');
         setOpen(false);
      } catch (err: unknown) {
         console.error('Failed to create project:', err);
         const errorMessage = err instanceof Error ? err.message : 'Could not create project';
         toast.error(errorMessage);
      } finally {
         setIsSubmitting(false);
      }
   };

   const SelectedIconComponent = PROJECT_ICONS.find((i) => i.name === selectedIcon)?.icon || Vault;

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         {trigger ? (
            <DialogTrigger asChild>{trigger}</DialogTrigger>
         ) : (
            <DialogTrigger asChild>
               <Button className="relative" size="xs" variant="secondary">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline ml-1">Create project</span>
               </Button>
            </DialogTrigger>
         )}
         <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden bg-container border-border/60">
            <form onSubmit={handleSubmit}>
               <DialogHeader className="p-5 pb-4 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                     <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <SelectedIconComponent className="size-4" />
                     </div>
                     <div>
                        <DialogTitle className="text-base font-semibold">
                           Create project
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                           Projects group related issues, milestones, and cycles toward major
                           milestones.
                        </DialogDescription>
                     </div>
                  </div>
               </DialogHeader>

               {optionError && (
                  <QueryErrorState
                     subject="project creation options"
                     error={optionError}
                     onRetry={() => {
                        void Promise.all(optionQueries.map((query) => query.refetch()));
                     }}
                  />
               )}

               <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                  {/* Name and Team row */}
                  <div className="space-y-1.5">
                     <Label htmlFor="proj-name" className="text-xs font-medium">
                        Project name <span className="text-destructive">*</span>
                     </Label>
                     <Input
                        id="proj-name"
                        placeholder="e.g. Next-Gen Design System"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                        required
                        autoFocus
                        className="h-9 text-sm"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <Label htmlFor="proj-template" className="text-xs font-medium">
                           Template
                        </Label>
                        <Select
                           value={selectedTemplateId}
                           onValueChange={applyTemplate}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger id="proj-template" className="h-9 text-xs">
                              <SelectValue placeholder="Start from template" />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              <SelectItem value="none" className="text-xs">
                                 Blank project
                              </SelectItem>
                              {templates
                                 .filter(
                                    (template) =>
                                       template.scope === 'workspace' || template.teamId === teamId
                                 )
                                 .map((template) => (
                                    <SelectItem
                                       key={template.id}
                                       value={template.id}
                                       className="text-xs"
                                    >
                                       {template.name}
                                       {template.scope === 'team' ? ' · Team' : ''}
                                    </SelectItem>
                                 ))}
                           </SelectContent>
                        </Select>
                     </div>
                     {/* Team selector */}
                     <div className="space-y-1.5">
                        <Label htmlFor="proj-team" className="text-xs font-medium">
                           Team <span className="text-destructive">*</span>
                        </Label>
                        <Select
                           value={teamId}
                           onValueChange={(nextTeamId) => {
                              setTeamId(nextTeamId);
                              setSelectedTeamIds((previous) => [
                                 nextTeamId,
                                 ...previous.filter((id) => id !== nextTeamId),
                              ]);
                           }}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger id="proj-team" className="h-9 text-xs">
                              <SelectValue placeholder="Select team" />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              {teams.map((t) => (
                                 <SelectItem key={t.id} value={t.id} className="text-xs">
                                    <div className="flex items-center gap-2">
                                       <span>{t.icon}</span>
                                       <span>{t.name}</span>
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="col-span-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                           <Label className="text-xs font-medium">Additional teams</Label>
                           <span className="text-[11px] text-muted-foreground">
                              {selectedTeamIds.length} selected
                           </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto">
                           {teams
                              .filter((team) => team.id !== teamId)
                              .map((team) => {
                                 const selected = selectedTeamIds.includes(team.id);
                                 return (
                                    <button
                                       key={team.id}
                                       type="button"
                                       disabled={isSubmitting}
                                       onClick={() =>
                                          setSelectedTeamIds((previous) =>
                                             selected
                                                ? previous.filter((id) => id !== team.id)
                                                : [...previous, team.id]
                                          )
                                       }
                                       className={cn(
                                          'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                                          selected
                                             ? 'border-primary bg-primary/10'
                                             : 'border-border/50 hover:bg-accent/50'
                                       )}
                                    >
                                       <span>{team.icon}</span>
                                       <span className="truncate flex-1">{team.name}</span>
                                       {selected && <Check className="size-3.5 text-primary" />}
                                    </button>
                                 );
                              })}
                        </div>
                     </div>

                     {/* Lead selector */}
                     <div className="space-y-1.5">
                        <Label htmlFor="proj-lead" className="text-xs font-medium">
                           Project lead
                        </Label>
                        <Select value={leadId} onValueChange={setLeadId} disabled={isSubmitting}>
                           <SelectTrigger id="proj-lead" className="h-9 text-xs">
                              <SelectValue placeholder="Select lead" />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              {members.map((m) => (
                                 <SelectItem key={m.id} value={m.id} className="text-xs">
                                    <div className="flex items-center gap-2">
                                       <Avatar className="size-4">
                                          <AvatarImage src={m.avatarUrl} alt={m.name} />
                                          <AvatarFallback className="text-[8px]">
                                             {m.name.slice(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                       </Avatar>
                                       <span className="truncate">{m.name}</span>
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  {/* Icon grid */}
                  <div className="space-y-1.5">
                     <Label className="text-xs font-medium">Project icon</Label>
                     <div className="flex items-center gap-1.5 overflow-x-auto pb-1 p-2 rounded-lg border border-border/40 bg-background/50">
                        {PROJECT_ICONS.map(({ name: iconName, icon: IconComp }) => (
                           <button
                              key={iconName}
                              type="button"
                              onClick={() => setSelectedIcon(iconName)}
                              className={cn(
                                 'size-8 rounded-md flex items-center justify-center transition-all shrink-0',
                                 selectedIcon === iconName
                                    ? 'bg-primary/20 text-primary ring-2 ring-primary scale-105'
                                    : 'text-muted-foreground hover:bg-sidebar/80 hover:text-foreground'
                              )}
                           >
                              <IconComp className="size-4" />
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Status, Priority, Health row */}
                  <div className="grid grid-cols-3 gap-2.5">
                     <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Status</Label>
                        <Select
                           value={statusId}
                           onValueChange={setStatusId}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              {projectStatusOptions.map((s) => (
                                 <SelectItem key={s.id} value={s.id} className="text-xs">
                                    {s.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Priority</Label>
                        <Select
                           value={priorityId}
                           onValueChange={setPriorityId}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              {PRIORITY_OPTIONS.map((p) => (
                                 <SelectItem key={p.id} value={p.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                       {renderPriorityIcon(p.id, 'size-3.5')}
                                       <span>{p.name}</span>
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Health</Label>
                        <Select
                           value={healthId}
                           onValueChange={setHealthId}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              {HEALTH_OPTIONS.map((h) => (
                                 <SelectItem key={h.id} value={h.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                       <span
                                          className="size-2 rounded-full"
                                          style={{ backgroundColor: h.color }}
                                       />
                                       <span>{h.name}</span>
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  {/* Dates & Initiative row */}
                  <div className="grid grid-cols-3 gap-2.5">
                     <div className="space-y-1.5">
                        <Label htmlFor="proj-start" className="text-xs font-medium">
                           Start date
                        </Label>
                        <Input
                           id="proj-start"
                           type="date"
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           disabled={isSubmitting}
                           className="h-8 text-xs"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <Label htmlFor="proj-target" className="text-xs font-medium">
                           Target date
                        </Label>
                        <Input
                           id="proj-target"
                           type="date"
                           value={targetDate}
                           onChange={(e) => setTargetDate(e.target.value)}
                           disabled={isSubmitting}
                           className="h-8 text-xs"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Initiative</Label>
                        <Select
                           value={initiativeId}
                           onValueChange={setInitiativeId}
                           disabled={isSubmitting}
                        >
                           <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="None" />
                           </SelectTrigger>
                           <SelectContent className="bg-popover border-border/60">
                              <SelectItem value="none" className="text-xs">
                                 None
                              </SelectItem>
                              {initiatives.map((init) => (
                                 <SelectItem key={init.id} value={init.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                       <span>{init.icon}</span>
                                       <span className="truncate">{init.name}</span>
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  {/* Labels selector */}
                  {labels.length > 0 && (
                     <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Labels</Label>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                           {labels.map((lbl) => {
                              const isSelected = selectedLabelIds.includes(lbl.id);
                              return (
                                 <button
                                    key={lbl.id}
                                    type="button"
                                    onClick={() => toggleLabel(lbl.id)}
                                    className={cn(
                                       'flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-all',
                                       isSelected
                                          ? 'border-primary bg-primary/15 text-foreground font-medium'
                                          : 'border-border/40 hover:bg-sidebar/50 text-muted-foreground'
                                    )}
                                 >
                                    <span
                                       className="size-2 rounded-full"
                                       style={{ backgroundColor: lbl.color }}
                                    />
                                    <span>{lbl.name}</span>
                                    {isSelected && <Check className="size-3 text-primary ml-0.5" />}
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  {/* Summary */}
                  <div className="space-y-1.5">
                     <Label htmlFor="proj-summary" className="text-xs font-medium">
                        Summary (optional)
                     </Label>
                     <Textarea
                        id="proj-summary"
                        placeholder="Brief summary of what this project will deliver..."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        disabled={isSubmitting}
                        rows={2}
                        className="text-xs resize-none"
                     />
                  </div>
               </div>

               <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-end gap-2">
                  <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={() => setOpen(false)}
                     disabled={isSubmitting}
                     className="h-8 text-xs"
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     size="sm"
                     disabled={isSubmitting || !name.trim()}
                     className="h-8 text-xs gap-1.5"
                  >
                     {isSubmitting ? (
                        <>
                           <Loader2 className="size-3.5 animate-spin" />
                           Creating...
                        </>
                     ) : (
                        'Create project'
                     )}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}

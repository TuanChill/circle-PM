'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import QueryErrorState from '@/components/common/query-error-state';
import { Button } from '@/components/ui/button';
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
   useCreateProjectStatus,
   useProjectStatuses,
} from '@/hooks/queries/use-project-statuses-query';
import { useProjects } from '@/hooks/queries/use-projects-query';
import { useWorkspace } from '@/hooks/queries/use-workspaces-query';
import { getProjectStatusOptions, renderProjectStatusIcon } from '@/lib/project-status';
import type { ProjectStatusCategory } from '@/services/project-statuses.service';
import { SettingsShell } from './shared';

const CATEGORY_GROUPS: { label: string; category: ProjectStatusCategory }[] = [
   { label: 'Backlog', category: 'backlog' },
   { label: 'Planned', category: 'unstarted' },
   { label: 'In Progress', category: 'started' },
   { label: 'Completed', category: 'completed' },
   { label: 'Canceled', category: 'canceled' },
];

const COLORS = [
   '#95a2b3',
   '#f2790f',
   '#f2c94c',
   '#26b5ce',
   '#22c55e',
   '#5e6ad2',
   '#8b5cf6',
   '#eb5757',
];

export default function ProjectStatusesSettings() {
   const { orgId = '' } = useParams<{ orgId?: string }>();
   const { data: workspace } = useWorkspace(orgId, Boolean(orgId));
   const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects();
   const {
      data: customStatuses = [],
      isLoading,
      error,
      refetch,
      workspaceId,
   } = useProjectStatuses();
   const createStatus = useCreateProjectStatus();
   const [category, setCategory] = useState<ProjectStatusCategory>('backlog');
   const [dialogOpen, setDialogOpen] = useState(false);
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [color, setColor] = useState(COLORS[2]);
   const [formError, setFormError] = useState('');
   const canManage = workspace?.role === 'Owner' || workspace?.role === 'Admin';
   const statuses = useMemo(() => getProjectStatusOptions(customStatuses), [customStatuses]);
   const groups = useMemo(
      () =>
         CATEGORY_GROUPS.map((group) => {
            const counts = new Map<string, number>();
            for (const project of projects) {
               if (project.status.category === group.category) {
                  counts.set(project.status.id, (counts.get(project.status.id) ?? 0) + 1);
               }
            }
            const groupStatuses = statuses
               .filter((status) => status.category === group.category)
               .filter(
                  (status) =>
                     customStatuses.some((custom) => custom.id === status.id) ||
                     (counts.get(status.id) ?? 0) > 0
               )
               .sort((a, b) => {
                  const aCustom = customStatuses.find((status) => status.id === a.id);
                  const bCustom = customStatuses.find((status) => status.id === b.id);
                  if (!aCustom) return bCustom ? -1 : 0;
                  if (!bCustom) return 1;
                  return aCustom.position - bCustom.position;
               });
            return {
               ...group,
               statuses: groupStatuses.map((status) => ({
                  ...status,
                  count: counts.get(status.id) ?? 0,
               })),
            };
         }),
      [projects, statuses, customStatuses]
   );

   const openCreate = (nextCategory: ProjectStatusCategory) => {
      setCategory(nextCategory);
      setFormError('');
      setName('');
      setDescription('');
      setColor(COLORS[2]);
      setDialogOpen(true);
   };

   const submit = async (event: FormEvent) => {
      event.preventDefault();
      if (!workspaceId) return;
      const normalizedName = name.trim();
      if (!normalizedName) {
         setFormError('Enter a status name.');
         return;
      }
      setFormError('');
      try {
         await createStatus.mutateAsync({
            workspaceId,
            payload: {
               name: normalizedName,
               description: description.trim() || undefined,
               color,
               category,
            },
         });
         setDialogOpen(false);
      } catch (cause) {
         setFormError(cause instanceof Error ? cause.message : 'Could not create status.');
      }
   };

   return (
      <SettingsShell
         title="Project statuses"
         description="Project statuses define the workflow that projects go through from start to completion"
      >
         <div className="rounded-lg border bg-container overflow-hidden">
            {groups.map((group) => (
               <div key={group.category}>
                  <div className="flex items-center justify-between px-4 py-2 bg-accent/30 border-y first:border-t-0 border-border/50">
                     <span className="text-sm text-muted-foreground">{group.label}</span>
                     <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Add ${group.label.toLowerCase()} status`}
                        title={
                           canManage
                              ? `Add ${group.label.toLowerCase()} status`
                              : 'Only workspace owners and admins can add statuses'
                        }
                        disabled={!canManage || !workspaceId}
                        onClick={() => openCreate(group.category)}
                        className="size-7"
                     >
                        <Plus className="size-3.5" />
                     </Button>
                  </div>
                  {(isLoading || projectsLoading) && group.statuses.length === 0 && (
                     <div className="px-4 py-3 text-xs text-muted-foreground">
                        Loading statuses...
                     </div>
                  )}
                  {!isLoading && !projectsLoading && group.statuses.length === 0 && (
                     <div className="px-4 py-3 text-xs text-muted-foreground">No statuses</div>
                  )}
                  {group.statuses.map((status) => (
                     <div key={status.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="inline-flex size-8 items-center justify-center rounded-md bg-muted/50 shrink-0">
                           {renderProjectStatusIcon(status)}
                        </span>
                        <div>
                           <div className="text-sm font-medium">{status.name}</div>
                           <div className="text-xs text-muted-foreground">
                              {status.count} {status.count === 1 ? 'project' : 'projects'}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            ))}
         </div>
         {error && (
            <QueryErrorState
               subject="project statuses"
               error={error}
               onRetry={() => void refetch()}
               compact
            />
         )}
         {projectsError && <QueryErrorState subject="projects" error={projectsError} compact />}
         <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
               <form onSubmit={submit}>
                  <DialogHeader>
                     <DialogTitle>
                        New {CATEGORY_GROUPS.find((group) => group.category === category)?.label}{' '}
                        status
                     </DialogTitle>
                     <DialogDescription>
                        This status will be available to projects in this workspace.
                     </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                     <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Status name"
                        maxLength={80}
                        required
                        autoFocus
                     />
                     <Textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Description (optional)"
                        maxLength={500}
                     />
                     <fieldset>
                        <legend className="text-sm font-medium mb-2">Color</legend>
                        <div className="flex flex-wrap gap-2">
                           {COLORS.map((swatch) => (
                              <button
                                 key={swatch}
                                 type="button"
                                 aria-label={`Choose ${swatch} status color`}
                                 aria-pressed={color === swatch}
                                 onClick={() => setColor(swatch)}
                                 className={`size-7 rounded-full border-2 ${color === swatch ? 'border-foreground' : 'border-transparent'}`}
                                 style={{ backgroundColor: swatch }}
                              />
                           ))}
                        </div>
                     </fieldset>
                     {formError && (
                        <p role="alert" className="text-sm text-destructive">
                           {formError}
                        </p>
                     )}
                  </div>
                  <DialogFooter>
                     <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                     </Button>
                     <Button type="submit" disabled={createStatus.isPending || !name.trim()}>
                        {createStatus.isPending ? 'Creating...' : 'Create status'}
                     </Button>
                  </DialogFooter>
               </form>
            </DialogContent>
         </Dialog>
      </SettingsShell>
   );
}

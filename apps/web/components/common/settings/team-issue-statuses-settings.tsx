'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QueryErrorState from '@/components/common/query-error-state';
import { useTeam } from '@/hooks/queries/use-teams-query';
import {
   useCreateIssueStatus,
   useDeleteIssueStatus,
   useIssueStatuses,
   useReorderIssueStatuses,
   useUpdateIssueStatus,
} from '@/hooks/queries/use-issue-statuses-query';
import type {
   CreateIssueStatusPayload,
   IssueStatusCategory,
   IssueStatusRecord,
} from '@/services/issue-statuses.service';

interface TeamIssueStatusesSettingsProps {
   teamId: string;
}

const CATEGORIES: { category: IssueStatusCategory; label: string }[] = [
   { category: 'backlog', label: 'Backlog' },
   { category: 'unstarted', label: 'Todo' },
   { category: 'started', label: 'In Progress' },
   { category: 'completed', label: 'Done' },
   { category: 'canceled', label: 'Canceled' },
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

const newStatusDefaults = (category: IssueStatusCategory): CreateIssueStatusPayload => ({
   name: '',
   description: '',
   color: COLORS[0],
   category,
});

export default function TeamIssueStatusesSettings({ teamId }: TeamIssueStatusesSettingsProps) {
   const { orgId = '' } = useParams<{ orgId?: string }>();
   const router = useRouter();
   const { data: team } = useTeam(teamId);
   const { data: statuses = [], isLoading, error, refetch } = useIssueStatuses(teamId);
   const createStatus = useCreateIssueStatus();
   const updateStatus = useUpdateIssueStatus();
   const deleteStatus = useDeleteIssueStatus();
   const reorderStatuses = useReorderIssueStatuses();
   const [editingStatus, setEditingStatus] = useState<IssueStatusRecord | null>(null);
   const [draft, setDraft] = useState<CreateIssueStatusPayload>(newStatusDefaults('backlog'));
   const [formOpen, setFormOpen] = useState(false);
   const [deletingStatus, setDeletingStatus] = useState<IssueStatusRecord | null>(null);
   const [draggedStatusId, setDraggedStatusId] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   const configurableStatuses = useMemo(
      () => statuses.filter((status) => !status.isSystem),
      [statuses]
   );
   const statusGroups = useMemo(
      () =>
         CATEGORIES.map((group) => ({
            ...group,
            statuses: configurableStatuses
               .filter((status) => status.category === group.category)
               .sort((a, b) => a.position - b.position),
         })),
      [configurableStatuses]
   );
   const startCreate = (category: IssueStatusCategory) => {
      setEditingStatus(null);
      setDraft(newStatusDefaults(category));
      setFormOpen(true);
   };

   const startEdit = (status: IssueStatusRecord) => {
      setEditingStatus(status);
      setDraft({
         name: status.name,
         description: status.description ?? '',
         color: status.color,
         category: status.category,
      });
      setFormOpen(true);
   };

   const saveStatus = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaving(true);
      try {
         if (editingStatus) {
            await updateStatus.mutateAsync({
               teamId,
               statusId: editingStatus.id,
               payload: {
                  name: draft.name,
                  description: draft.description,
                  color: draft.color,
               },
            });
            toast.success('Issue status updated');
         } else {
            await createStatus.mutateAsync({ teamId, payload: draft });
            toast.success('Issue status created');
         }
         setFormOpen(false);
      } catch (cause) {
         toast.error(cause instanceof Error ? cause.message : 'Could not save issue status');
      } finally {
         setSaving(false);
      }
   };

   const removeStatus = async () => {
      if (!deletingStatus) return;
      try {
         await deleteStatus.mutateAsync({ teamId, statusId: deletingStatus.id });
         toast.success('Issue status deleted');
      } catch (cause) {
         toast.error(cause instanceof Error ? cause.message : 'Could not delete issue status');
      } finally {
         setDeletingStatus(null);
      }
   };

   const reorder = async (category: IssueStatusCategory, ordered: IssueStatusRecord[]) => {
      try {
         await reorderStatuses.mutateAsync({
            teamId,
            category,
            statusIds: ordered.map((status) => status.id),
         });
      } catch (cause) {
         toast.error(cause instanceof Error ? cause.message : 'Could not reorder issue statuses');
      }
   };

   const moveStatus = (category: IssueStatusCategory, statusId: string, offset: -1 | 1) => {
      const current = statusGroups.find((group) => group.category === category)?.statuses;
      if (!current) return;
      const from = current.findIndex((status) => status.id === statusId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return;
      const ordered = [...current];
      [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
      void reorder(category, ordered);
   };

   const dropOnStatus = (category: IssueStatusCategory, targetId: string) => {
      if (!draggedStatusId || draggedStatusId === targetId) return;
      const current = statusGroups.find((group) => group.category === category)?.statuses;
      if (!current?.some((status) => status.id === draggedStatusId)) return;
      const ordered = [...current];
      const from = ordered.findIndex((status) => status.id === draggedStatusId);
      const to = ordered.findIndex((status) => status.id === targetId);
      const [item] = ordered.splice(from, 1);
      ordered.splice(to, 0, item);
      void reorder(category, ordered);
      setDraggedStatusId(null);
   };

   if (error) {
      return (
         <QueryErrorState subject="issue statuses" error={error} onRetry={() => void refetch()} />
      );
   }

   return (
      <div className="w-full h-full overflow-y-auto">
         <main className="max-w-3xl mx-auto px-6 py-10 pb-20 space-y-6">
            <Button
               type="button"
               variant="ghost"
               size="sm"
               className="-ml-3"
               onClick={() => router.push(`/${orgId}/settings/teams/${teamId}`)}
            >
               <ArrowLeft className="size-4" />
               Team settings
            </Button>
            <header>
               <h1 className="text-2xl font-medium">{team?.name ?? 'Team'} issue statuses</h1>
               <p className="mt-1 text-sm text-muted-foreground">
                  Manage this team’s workflow. Status groups follow a fixed lifecycle order; drag
                  statuses within a group to reorder them.
               </p>
            </header>

            <section className="rounded-lg border bg-container overflow-hidden">
               {statusGroups.map((group) => (
                  <div key={group.category}>
                     <div className="flex items-center justify-between px-4 py-2 bg-accent/30 border-y first:border-t-0 border-border/50">
                        <span className="text-sm text-muted-foreground">{group.label}</span>
                        <Button
                           type="button"
                           size="icon"
                           variant="ghost"
                           className="size-7"
                           aria-label={`Add ${group.label} status`}
                           onClick={() => startCreate(group.category)}
                        >
                           <Plus className="size-3.5" />
                        </Button>
                     </div>
                     {isLoading && group.statuses.length === 0 && (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                           Loading statuses...
                        </div>
                     )}
                     {!isLoading && group.statuses.length === 0 && (
                        <div className="px-4 py-3 text-xs text-muted-foreground">No statuses</div>
                     )}
                     {group.statuses.map((status, index) => (
                        <StatusRow
                           key={status.id}
                           status={status}
                           isLast={group.statuses.length === 1}
                           isFirst={index === 0}
                           isLastInGroup={index === group.statuses.length - 1}
                           onEdit={() => startEdit(status)}
                           onDelete={() => setDeletingStatus(status)}
                           onMoveUp={() => moveStatus(group.category, status.id, -1)}
                           onMoveDown={() => moveStatus(group.category, status.id, 1)}
                           onDragStart={() => setDraggedStatusId(status.id)}
                           onDrop={() => dropOnStatus(group.category, status.id)}
                        />
                     ))}
                  </div>
               ))}
            </section>
         </main>

         <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent>
               <form onSubmit={saveStatus}>
                  <DialogHeader>
                     <DialogTitle>
                        {editingStatus ? 'Edit issue status' : 'New issue status'}
                     </DialogTitle>
                     <DialogDescription>
                        {editingStatus
                           ? 'Update the name, color, or description of this status.'
                           : `Add a status to ${CATEGORIES.find((category) => category.category === draft.category)?.label} for ${team?.name ?? 'this team'}.`}
                     </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                     <Input
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                        placeholder="Status name"
                        maxLength={80}
                        required
                        autoFocus
                     />
                     <Textarea
                        value={draft.description ?? ''}
                        onChange={(event) =>
                           setDraft({ ...draft, description: event.target.value })
                        }
                        placeholder="Description (optional)"
                        maxLength={500}
                     />
                     <fieldset>
                        <legend className="text-sm font-medium mb-2">Color</legend>
                        <div className="flex flex-wrap gap-2">
                           {COLORS.map((color) => (
                              <button
                                 key={color}
                                 type="button"
                                 aria-label={`Choose ${color} status color`}
                                 aria-pressed={draft.color === color}
                                 onClick={() => setDraft({ ...draft, color })}
                                 className={`size-7 rounded-full border-2 ${draft.color === color ? 'border-foreground' : 'border-transparent'}`}
                                 style={{ backgroundColor: color }}
                              />
                           ))}
                        </div>
                     </fieldset>
                  </div>
                  <DialogFooter>
                     <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                        Cancel
                     </Button>
                     <Button type="submit" disabled={saving || !draft.name.trim()}>
                        {saving ? 'Saving...' : editingStatus ? 'Save changes' : 'Add status'}
                     </Button>
                  </DialogFooter>
               </form>
            </DialogContent>
         </Dialog>

         <AlertDialog
            open={Boolean(deletingStatus)}
            onOpenChange={(open) => !open && setDeletingStatus(null)}
         >
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete {deletingStatus?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                     Move issues and update templates that use this status before deleting it. Every
                     required lifecycle group must keep at least one status.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={removeStatus}>Delete status</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
}

interface StatusRowProps {
   status: IssueStatusRecord;
   isFirst: boolean;
   isLastInGroup: boolean;
   isLast: boolean;
   onEdit: () => void;
   onDelete: () => void;
   onMoveUp: () => void;
   onMoveDown: () => void;
   onDragStart: () => void;
   onDrop: () => void;
}

function StatusRow({
   status,
   isFirst,
   isLastInGroup,
   isLast,
   onEdit,
   onDelete,
   onMoveUp,
   onMoveDown,
   onDragStart,
   onDrop,
}: StatusRowProps) {
   return (
      <div
         draggable
         onDragStart={onDragStart}
         onDragOver={(event) => event.preventDefault()}
         onDrop={(event) => {
            event.preventDefault();
            onDrop();
         }}
         onDragEnd={() => undefined}
         className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0"
      >
         <GripVertical className="size-4 text-muted-foreground cursor-grab" aria-hidden="true" />
         <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
         <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
               <span className="truncate">{status.name}</span>
               {status.isDefault && (
                  <span className="text-xs text-muted-foreground">Default for new issues</span>
               )}
            </div>
            {status.description && (
               <p className="text-xs text-muted-foreground truncate">{status.description}</p>
            )}
         </div>
         <div className="flex items-center">
            <Button
               type="button"
               variant="ghost"
               size="icon"
               className="size-7"
               aria-label={`Move ${status.name} up`}
               disabled={isFirst}
               onClick={onMoveUp}
            >
               <ArrowUp className="size-3.5" />
            </Button>
            <Button
               type="button"
               variant="ghost"
               size="icon"
               className="size-7"
               aria-label={`Move ${status.name} down`}
               disabled={isLastInGroup}
               onClick={onMoveDown}
            >
               <ArrowDown className="size-3.5" />
            </Button>
            <Button
               type="button"
               variant="ghost"
               size="icon"
               className="size-7"
               aria-label={`Edit ${status.name}`}
               onClick={onEdit}
            >
               <Pencil className="size-3.5" />
            </Button>
            <Button
               type="button"
               variant="ghost"
               size="icon"
               className="size-7 text-destructive"
               aria-label={`Delete ${status.name}`}
               disabled={isLast}
               onClick={onDelete}
            >
               <Trash2 className="size-3.5" />
            </Button>
         </div>
      </div>
   );
}

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { renderProjectIcon } from '@/lib/project-utils';
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
import {
   ContextMenuContent,
   ContextMenuGroup,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuShortcut,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import {
   CircleCheck,
   User,
   BarChart3,
   Tag,
   Folder,
   CalendarClock,
   Flag,
   Trash2,
   CheckCircle2,
   Clock,
   Clipboard,
   Bell,
   BellOff,
   RotateCw,
} from 'lucide-react';
import React, { useState } from 'react';
import { useIssuesStore } from '@/store/issues-store';
import type { Issue } from '@/mock-data/issues';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';
import { workflowStatuses } from '@/lib/issue-statuses';
import { priorities } from '@/lib/priority-catalog';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { useProjects } from '@/hooks/queries/use-projects-query';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { useDeleteIssue, useToggleIssueSubscription } from '@/hooks/queries/use-issues-query';
import { CyclePlayIcon } from '@/components/common/cycles/cycle-line';
import type { User as UserModel } from '@/mock-data/users';
import { toast } from 'sonner';

interface IssueContextMenuProps {
   issue?: Issue;
}

export function IssueContextMenu({ issue }: IssueContextMenuProps) {
   const issueId = issue?.id;
   const {
      updateIssueStatus,
      updateIssuePriority,
      updateIssueAssignee,
      updateIssueProject,
      updateIssue,
   } = useIssuesStore();
   const membersQuery = useMembers();
   const labelsQuery = useLabels('issue');
   const projectsQuery = useProjects();
   const cyclesQuery = useCycles(issue?.teamId, { requireTeamId: true });
   const issueStatusesQuery = useIssueStatuses(issue?.teamId);
   const status = workflowStatuses(issueStatusesQuery.data);
   const { data: members = [] } = membersQuery;
   const { data: labels = [] } = labelsQuery;
   const { data: projects = [] } = projectsQuery;
   const { data: cycles = [] } = cyclesQuery;
   const failedQuery = [
      membersQuery,
      labelsQuery,
      projectsQuery,
      cyclesQuery,
      issueStatusesQuery,
   ].find((query) => query.isError);
   const deleteIssueMutation = useDeleteIssue();
   const subscriptionMutation = useToggleIssueSubscription();
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

   const handleStatusChange = (statusId: string) => {
      if (!issueId) return;
      const newStatus = status.find((s) => s.id === statusId);
      if (newStatus) {
         updateIssueStatus(issueId, newStatus);
         toast.success(`Status updated to ${newStatus.name}`);
      }
   };

   const handlePriorityChange = (priorityId: string) => {
      if (!issueId) return;
      const newPriority = priorities.find((p) => p.id === priorityId);
      if (newPriority) {
         updateIssuePriority(issueId, newPriority);
         toast.success(`Priority updated to ${newPriority.name}`);
      }
   };

   const handleAssigneeChange = (userId: string | null) => {
      if (!issueId) return;
      const newAssignee = userId
         ? (members.find((u) => u.id === userId) as unknown as UserModel) || null
         : null;
      updateIssueAssignee(issueId, newAssignee);
      toast.success(newAssignee ? `Assigned to ${newAssignee.name}` : 'Unassigned');
   };

   const handleLabelToggle = (labelId: string) => {
      if (!issueId || !issue) return;
      const label = labels.find((l) => l.id === labelId);
      if (!label) return;

      const hasLabel = issue.labels.some((l) => l.id === labelId);
      const updatedLabels = hasLabel
         ? issue.labels.filter((l) => l.id !== labelId)
         : [...issue.labels, label];

      updateIssue(issueId, { labels: updatedLabels });
      toast.success(hasLabel ? `Removed label: ${label.name}` : `Added label: ${label.name}`);
   };

   const handleProjectChange = (projectId: string | null) => {
      if (!issueId) return;
      const newProject = projectId ? projects.find((p) => p.id === projectId) : undefined;
      updateIssueProject(issueId, newProject);
      toast.success(newProject ? `Project set to ${newProject.name}` : 'Project removed');
   };

   const handleCycleChange = (cycleId: string) => {
      if (!issueId) return;
      const newCycle = cycles.find((c) => c.id === cycleId);
      updateIssue(issueId, { cycleId });
      toast.success(newCycle ? `Cycle set to ${newCycle.name}` : 'Cycle removed');
   };

   const handleSetDueDate = () => {
      if (!issueId) return;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      updateIssue(issueId, { dueDate: dueDate.toISOString() });
      toast.success('Due date set to 7 days from now');
   };

   const handleMarkAs = (statusId: string) => {
      if (!issueId) return;
      const newStatus = status.find((s) => s.id === statusId);
      if (newStatus) {
         updateIssueStatus(issueId, newStatus);
         toast.success(`Marked as ${newStatus.name}`);
      }
   };

   const handleCopy = () => {
      if (!issue) return;
      navigator.clipboard.writeText(issue.title);
      toast.success('Copied to clipboard');
   };

   const handleSubscriptionToggle = () => {
      if (!issue) return;
      subscriptionMutation.mutate({
         identifier: issue.identifier,
         subscribed: !issue.isSubscribed,
      });
   };

   const handleDelete = async () => {
      if (!issue) return;
      try {
         await deleteIssueMutation.mutateAsync(issue.identifier);
         setDeleteDialogOpen(false);
      } catch {
         // Handled in mutation onError
      }
   };

   return (
      <>
         <ContextMenuContent className="w-64">
            {failedQuery && (
               <ContextMenuItem onClick={() => void failedQuery.refetch()}>
                  <RotateCw className="size-4" /> Retry issue options
               </ContextMenuItem>
            )}
            <ContextMenuGroup>
               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <CircleCheck className="mr-2 size-4" /> Status
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                     {status.map((s) => {
                        const Icon = s.icon;
                        return (
                           <ContextMenuItem key={s.id} onClick={() => handleStatusChange(s.id)}>
                              <Icon /> {s.name}
                           </ContextMenuItem>
                        );
                     })}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <User className="mr-2 size-4" /> Assignee
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                     {membersQuery.isError ? (
                        <ContextMenuItem disabled>Assignees unavailable</ContextMenuItem>
                     ) : (
                        <>
                           <ContextMenuItem onClick={() => handleAssigneeChange(null)}>
                              <User className="size-4" /> Unassigned
                           </ContextMenuItem>
                           {members.map((user) => (
                              <ContextMenuItem
                                 key={user.id}
                                 onClick={() => handleAssigneeChange(user.id)}
                              >
                                 <Avatar className="size-4">
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                 </Avatar>
                                 {user.name}
                              </ContextMenuItem>
                           ))}
                        </>
                     )}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <BarChart3 className="mr-2 size-4" /> Priority
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                     {priorities.map((priority) => (
                        <ContextMenuItem
                           key={priority.id}
                           onClick={() => handlePriorityChange(priority.id)}
                        >
                           <priority.icon className="size-4" /> {priority.name}
                        </ContextMenuItem>
                     ))}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <Tag className="mr-2 size-4" /> Labels
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                     {labelsQuery.isError ? (
                        <ContextMenuItem disabled>Labels unavailable</ContextMenuItem>
                     ) : (
                        labels.map((label) => (
                           <ContextMenuItem
                              key={label.id}
                              onClick={() => handleLabelToggle(label.id)}
                           >
                              <span
                                 className="inline-block size-3 rounded-full"
                                 style={{ backgroundColor: label.color }}
                                 aria-hidden="true"
                              />
                              {label.name}
                           </ContextMenuItem>
                        ))
                     )}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <Folder className="mr-2 size-4" /> Project
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-64">
                     <ContextMenuItem onClick={() => handleProjectChange(null)}>
                        <Folder className="size-4" /> No Project
                     </ContextMenuItem>
                     {projectsQuery.isError ? (
                        <ContextMenuItem disabled>Projects unavailable</ContextMenuItem>
                     ) : (
                        projects.map((project) => (
                           <ContextMenuItem
                              key={project.id}
                              onClick={() => handleProjectChange(project.id)}
                           >
                              {renderProjectIcon(project.icon, 'size-4')} {project.name}
                           </ContextMenuItem>
                        ))
                     )}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuSub>
                  <ContextMenuSubTrigger>
                     <CyclePlayIcon className="mr-2 size-4" /> Cycle
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                     <ContextMenuItem onClick={() => handleCycleChange('')}>
                        <CyclePlayIcon className="size-4" /> No Cycle
                     </ContextMenuItem>
                     {cyclesQuery.isError ? (
                        <ContextMenuItem disabled>Cycles unavailable</ContextMenuItem>
                     ) : (
                        cycles.map((cycle) => (
                           <ContextMenuItem
                              key={cycle.id}
                              onClick={() => handleCycleChange(cycle.id)}
                           >
                              <CyclePlayIcon className="size-4" /> {cycle.name}
                           </ContextMenuItem>
                        ))
                     )}
                  </ContextMenuSubContent>
               </ContextMenuSub>

               <ContextMenuItem onClick={handleSetDueDate}>
                  <CalendarClock className="size-4" /> Set due date...
                  <ContextMenuShortcut>D</ContextMenuShortcut>
               </ContextMenuItem>

               <ContextMenuSeparator />
            </ContextMenuGroup>

            <ContextMenuSeparator />

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <Flag className="mr-2 size-4" /> Mark as
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  <ContextMenuItem onClick={() => handleMarkAs('done')}>
                     <CheckCircle2 className="size-4" /> Completed
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleMarkAs('canceled')}>
                     <Clock className="size-4" /> Won&apos;t Fix
                  </ContextMenuItem>
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleCopy}>
               <Clipboard className="size-4" /> Copy
            </ContextMenuItem>

            <ContextMenuItem
               onClick={handleSubscriptionToggle}
               disabled={subscriptionMutation.isPending}
            >
               {issue?.isSubscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
               {issue?.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </ContextMenuItem>

            <ContextMenuItem variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
               <Trash2 className="size-4" /> Delete...
               <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
            </ContextMenuItem>
         </ContextMenuContent>

         <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete Issue</AlertDialogTitle>
                  <AlertDialogDescription>
                     Are you sure you want to delete {issue?.identifier}? This action cannot be
                     undone.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     onClick={handleDelete}
                     disabled={deleteIssueMutation.isPending}
                  >
                     Delete
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );
}

'use client';

import * as React from 'react';
import {
   useIssue,
   useIssueDetail,
   useIssues,
   useCreateIssue,
   useUpdateIssue,
   useToggleIssueSubscription,
} from '@/hooks/queries/use-issues-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';
import { workflowStatuses } from '@/lib/issue-statuses';
import { priorities } from '@/lib/priority-catalog';
import { renderPriorityIcon } from '@/lib/priority-utils';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, MoreHorizontal, Plus, Tag, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { renderStatusIcon } from '@/lib/status-utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import { AssigneeUser } from '../assignee-user';
import { ActivityFeed } from './activity-feed';
import { IssuePropertiesPanel } from './issue-properties-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { LinearEditor } from '@/components/common/editor/linear-editor';
import { contentBlocksToMarkdown } from '@/lib/content-blocks-to-markdown';
import QueryErrorState from '@/components/common/query-error-state';
import { FileAttachments } from '@/components/common/attachments/file-attachments';

function IssueDetailsSkeleton() {
   return (
      <div className="w-full h-full flex overflow-hidden animate-in fade-in-50 duration-200">
         {/* Main column skeleton */}
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
               {/* Title Skeleton */}
               <Skeleton className="h-9 w-4/5 mb-6" />

               {/* Description Blocks Skeleton */}
               <div className="space-y-3 mt-6">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-3/4" />
               </div>

               {/* Quick actions Skeleton */}
               <div className="flex items-center gap-3 mt-6">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="size-5 rounded" />
               </div>

               {/* Sub-issues Skeleton */}
               <div className="mt-8 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full rounded-md" />
               </div>

               <div className="border-t border-border/60 mt-8" />

               {/* Activity feed Skeleton */}
               <div className="mt-10 space-y-4">
                  <div className="flex items-center justify-between">
                     <Skeleton className="h-5 w-20" />
                     <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="space-y-3">
                     <div className="p-4 rounded-lg border border-border/50 bg-container space-y-2">
                        <div className="flex items-center gap-2">
                           <Skeleton className="size-5 rounded-full" />
                           <Skeleton className="h-4 w-24" />
                           <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-4 w-3/4" />
                     </div>
                     <div className="p-4 rounded-lg border border-border/50 bg-container space-y-2">
                        <div className="flex items-center gap-2">
                           <Skeleton className="size-5 rounded-full" />
                           <Skeleton className="h-4 w-28" />
                           <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-4 w-1/2" />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Sidebar Skeleton */}
         <aside className="hidden lg:block w-80 shrink-0 border-l h-full overflow-y-auto bg-container px-5 py-6 space-y-5">
            <div className="space-y-4">
               {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                     <Skeleton className="h-3.5 w-20" />
                     <Skeleton className="h-6 w-28 rounded" />
                  </div>
               ))}
            </div>
         </aside>
      </div>
   );
}

/**
 * Issue detail page: rich description, sub-issues (with Linear-style inline composer),
 * activity feed, and a properties sidebar.
 */
export default function IssueDetails() {
   const { orgId, issueId } = useParams<{ orgId: string; issueId: string }>();
   const {
      data: issue,
      isLoading: isIssueLoading,
      isError: isIssueError,
      error: issueError,
      refetch: refetchIssue,
   } = useIssue(issueId);
   const { data: issueStatusRecords } = useIssueStatuses(issue?.teamId);
   const allStatuses = workflowStatuses(issueStatusRecords);
   const {
      data: detailData,
      isLoading: isDetailLoading,
      isError: isDetailError,
      error: detailError,
      refetch: refetchDetail,
   } = useIssueDetail(issueId);
   const { data: allIssues = [] } = useIssues();
   const { data: members = [] } = useMembers();
   const { data: labels = [] } = useLabels();

   const createIssueMutation = useCreateIssue();
   const updateIssueMutation = useUpdateIssue();
   const subscriptionMutation = useToggleIssueSubscription();

   // Title inline edit state
   const [isEditingTitle, setIsEditingTitle] = React.useState(false);
   const [titleDraft, setTitleDraft] = React.useState('');
   const [titleOverride, setTitleOverride] = React.useState<string | null>(null);

   // Description override state for optimistic updates
   const [descriptionOverride, setDescriptionOverride] = React.useState<string | null>(null);

   // Sub-issue inline composer state
   const [isAddingSubIssue, setIsAddingSubIssue] = React.useState(false);
   const [subIssueTitle, setSubIssueTitle] = React.useState('');
   const [subIssueDescription, setSubIssueDescription] = React.useState('');
   const [subIssueStatusId, setSubIssueStatusId] = React.useState('to-do');
   const [subIssuePriorityId, setSubIssuePriorityId] = React.useState('no-priority');
   const [subIssueAssigneeId, setSubIssueAssigneeId] = React.useState<string | undefined>(
      undefined
   );
   const [subIssueLabelIds, setSubIssueLabelIds] = React.useState<string[]>([]);

   const titleInputRef = React.useRef<HTMLInputElement>(null);

   const selectedAssignee = members.find((m) => m.id === subIssueAssigneeId);
   const selectedPriority = priorities.find((p) => p.id === subIssuePriorityId) || priorities[0];

   React.useEffect(() => {
      if (isAddingSubIssue) {
         titleInputRef.current?.focus();
      }
   }, [isAddingSubIssue]);

   const detail = detailData ?? null;

   const initialDescriptionMarkdown = React.useMemo(() => {
      if (descriptionOverride !== null) return descriptionOverride;
      if (issue?.description && issue.description.trim()) {
         return issue.description;
      }
      if (detail?.description && detail.description.length > 0) {
         return contentBlocksToMarkdown(detail.description);
      }
      return '';
   }, [descriptionOverride, issue?.description, detail?.description]);

   const issueDescription = issue?.description;

   React.useEffect(() => {
      if (descriptionOverride === null || issueDescription === undefined) return;
      if (issueDescription.trim() === descriptionOverride) {
         setDescriptionOverride(null);
      }
   }, [descriptionOverride, issueDescription]);

   const handleSaveDescription = React.useCallback(
      (newMarkdown: string) => {
         if (!issue) return;
         const trimmed = newMarkdown.trim();
         const current = (issue.description || '').trim();
         if (trimmed === current) return;

         setDescriptionOverride(trimmed);
         updateIssueMutation.mutate(
            { identifier: issue.identifier, data: { description: trimmed } },
            {
               onError: () => {
                  setDescriptionOverride(null);
                  toast.error('Failed to update description');
               },
            }
         );
      },
      [issue, updateIssueMutation]
   );

   const isLoading = isIssueLoading || (Boolean(issue) && isDetailLoading);

   if (isLoading) {
      return <IssueDetailsSkeleton />;
   }

   if (isIssueError) {
      return <QueryErrorState subject="issue" error={issueError} onRetry={refetchIssue} />;
   }

   if (isDetailError) {
      return (
         <QueryErrorState subject="issue activity" error={detailError} onRetry={refetchDetail} />
      );
   }

   if (!issue || !detail) {
      return (
         <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground animate-in fade-in-50 duration-200">
            <p className="text-base font-medium text-foreground">Issue {issueId} not found</p>
            <p className="text-xs text-muted-foreground">
               This issue may have been deleted or does not exist.
            </p>
            <Link
               href={ROUTES.WORKSPACE.MY_ISSUES(orgId)}
               className="mt-2 text-xs px-3 py-1.5 rounded-md border border-border/80 bg-accent hover:bg-accent/80 transition-colors font-medium text-foreground"
            >
               Back to issues
            </Link>
         </div>
      );
   }

   // All sub-issues whose parent is this issue OR identifier is listed in subIssueIds
   const subIssues = allIssues.filter((candidate) => {
      if (detail.subIssueIds?.includes(candidate.identifier)) return true;
      if (
         candidate.parentIssueId &&
         (candidate.parentIssueId === issue.id || candidate.parentIssueId === issue.identifier)
      ) {
         return true;
      }
      return false;
   });

   const completedSubIssuesCount = subIssues.filter(
      (subIssue) => subIssue.status?.category === 'completed'
   ).length;

   const toggleLabel = (labelId: string) => {
      setSubIssueLabelIds((prev) =>
         prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
      );
   };

   const handleCreateSubIssue = async () => {
      const title = subIssueTitle.trim();
      if (!title || !issue) return;

      try {
         await createIssueMutation.mutateAsync({
            title,
            description: subIssueDescription.trim() || undefined,
            parentIssueId: issue.id || issue.identifier,
            teamId: issue.teamId,
            projectId: issue.project?.id,
            cycleId: issue.cycleId,
            statusId: subIssueStatusId,
            priorityId: subIssuePriorityId,
            assigneeId: subIssueAssigneeId,
            labelIds: subIssueLabelIds.length > 0 ? subIssueLabelIds : undefined,
         });

         // Reset form
         setSubIssueTitle('');
         setSubIssueDescription('');
         setSubIssueStatusId('to-do');
         setSubIssuePriorityId('no-priority');
         setSubIssueAssigneeId(undefined);
         setSubIssueLabelIds([]);
         setIsAddingSubIssue(false);
      } catch {
         // Error handled in mutation
      }
   };

   const displayTitle = titleOverride ?? issue.title;

   const startEditingTitle = () => {
      setTitleDraft(displayTitle);
      setIsEditingTitle(true);
   };

   const commitTitle = () => {
      const trimmed = titleDraft.trim();
      setIsEditingTitle(false);
      if (!trimmed || trimmed === issue.title) return;

      setTitleOverride(trimmed);
      updateIssueMutation.mutate(
         { identifier: issue.identifier, data: { title: trimmed } },
         {
            onSuccess: () => setTitleOverride(null),
            onError: () => {
               setTitleOverride(null);
               toast.error('Failed to update title');
            },
         }
      );
   };

   return (
      <div className="w-full h-full flex overflow-hidden">
         {/* Main column */}
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
               {isEditingTitle ? (
                  <Input
                     autoFocus
                     value={titleDraft}
                     disabled={updateIssueMutation.isPending}
                     onChange={(e) => setTitleDraft(e.target.value)}
                     onBlur={commitTitle}
                     onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                           e.preventDefault();
                           commitTitle();
                        }
                        if (e.key === 'Escape') {
                           e.preventDefault();
                           setIsEditingTitle(false);
                        }
                     }}
                     className="text-3xl font-semibold leading-tight h-auto px-2 py-1 -mx-2"
                  />
               ) : (
                  <h1
                     className="text-3xl font-semibold leading-tight text-balance cursor-text rounded px-2 py-1 -mx-2 hover:bg-accent/40 transition-colors"
                     onClick={startEditingTitle}
                  >
                     {displayTitle}
                  </h1>
               )}

               <div className="mt-6">
                  <LinearEditor
                     value={initialDescriptionMarkdown}
                     onSave={handleSaveDescription}
                     mode="click-to-edit"
                     placeholder="Add description or type '/' for commands..."
                     className="px-2 py-1 -mx-2 rounded hover:bg-accent/20 transition-colors"
                  />
               </div>

               {/* Quick actions */}
               {/* Sub-issues Section */}
               <div className="mt-8">
                  {subIssues.length > 0 ? (
                     <>
                        <div className="flex items-center justify-between mb-2">
                           <h2 className="text-sm font-medium">
                              Sub-issues{' '}
                              <span className="text-muted-foreground text-xs font-normal">
                                 {completedSubIssuesCount}/{subIssues.length}
                              </span>
                           </h2>
                           <button
                              type="button"
                              onClick={() => setIsAddingSubIssue(true)}
                              className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                              title="Add sub-issue"
                           >
                              <Plus className="size-3.5" />
                           </button>
                        </div>

                        <div className="flex flex-col border-t border-border/50">
                           {subIssues.map((subIssue) => (
                              <Link
                                 key={subIssue.id}
                                 href={`/${orgId ?? ''}/issue/${subIssue.identifier}`}
                                 className="flex items-center gap-2.5 h-10 px-1 border-b border-border/50 hover:bg-sidebar/50 text-sm min-w-0 group transition-colors"
                              >
                                 {renderStatusIcon(subIssue.status?.id, subIssue.status)}
                                 <span className="text-muted-foreground shrink-0 text-xs font-medium group-hover:text-foreground transition-colors">
                                    {subIssue.identifier}
                                 </span>
                                 <span className="truncate font-medium">{subIssue.title}</span>
                                 <span className="ml-auto shrink-0">
                                    <AssigneeUser user={subIssue.assignee} />
                                 </span>
                              </Link>
                           ))}
                        </div>
                     </>
                  ) : !isAddingSubIssue ? (
                     <button
                        type="button"
                        onClick={() => setIsAddingSubIssue(true)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                     >
                        <Plus className="size-4 group-hover:scale-110 transition-transform" />
                        Add sub-issues
                     </button>
                  ) : null}

                  {/* Linear-Style Sub-Issue Inline Composer Card */}
                  {isAddingSubIssue && (
                     <div className="mt-3 rounded-lg border border-border/80 bg-card/70 dark:bg-card/40 p-3.5 space-y-2.5 shadow-sm animate-in fade-in-50 duration-150">
                        {/* Row 1: Status Icon Dropdown + Title Input */}
                        <div className="flex items-center gap-2.5">
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <button
                                    type="button"
                                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    title="Select status"
                                 >
                                    {renderStatusIcon(
                                       subIssueStatusId,
                                       allStatuses.find((item) => item.id === subIssueStatusId)
                                    )}
                                 </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-44">
                                 {allStatuses.map((st) => (
                                    <DropdownMenuItem
                                       key={st.id}
                                       onClick={() => setSubIssueStatusId(st.id)}
                                    >
                                       {renderStatusIcon(st.id, st)}
                                       <span className="ml-2 text-xs">{st.name}</span>
                                    </DropdownMenuItem>
                                 ))}
                              </DropdownMenuContent>
                           </DropdownMenu>

                           <input
                              ref={titleInputRef}
                              type="text"
                              value={subIssueTitle}
                              onChange={(e) => setSubIssueTitle(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCreateSubIssue();
                                 }
                                 if (e.key === 'Escape') {
                                    setIsAddingSubIssue(false);
                                 }
                              }}
                              placeholder="Issue title"
                              className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/60 outline-none text-foreground"
                           />
                        </div>

                        {/* Row 2: Description Input */}
                        <div>
                           <textarea
                              value={subIssueDescription}
                              onChange={(e) => setSubIssueDescription(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleCreateSubIssue();
                                 }
                                 if (e.key === 'Escape') {
                                    setIsAddingSubIssue(false);
                                 }
                              }}
                              placeholder="Add description..."
                              rows={2}
                              className="w-full bg-transparent text-xs placeholder:text-muted-foreground/50 outline-none resize-none text-foreground/90"
                           />
                        </div>

                        {/* Row 3: Action Pills Bar */}
                        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                           <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Team / Project Badge */}
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50">
                                 📈 {issue.teamId || 'Unknown team'}
                              </span>

                              {/* Priority Dropdown Pill */}
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <button
                                       type="button"
                                       className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/50 transition-colors"
                                    >
                                       {renderPriorityIcon(subIssuePriorityId, 'size-3.5')}
                                       <span>{selectedPriority.name}</span>
                                    </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="start" className="w-40">
                                    {priorities.map((p) => (
                                       <DropdownMenuItem
                                          key={p.id}
                                          onClick={() => setSubIssuePriorityId(p.id)}
                                       >
                                          {renderPriorityIcon(p.id, 'size-3.5 mr-2')}
                                          <span className="text-xs">{p.name}</span>
                                       </DropdownMenuItem>
                                    ))}
                                 </DropdownMenuContent>
                              </DropdownMenu>

                              {/* Assignee Dropdown Pill */}
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <button
                                       type="button"
                                       className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/50 transition-colors"
                                    >
                                       {selectedAssignee ? (
                                          <>
                                             <Avatar className="size-3.5">
                                                <AvatarImage src={selectedAssignee.avatarUrl} />
                                                <AvatarFallback className="text-[8px]">
                                                   {selectedAssignee.name[0]}
                                                </AvatarFallback>
                                             </Avatar>
                                             <span className="truncate max-w-[90px]">
                                                {selectedAssignee.name}
                                             </span>
                                          </>
                                       ) : (
                                          <>
                                             <UserPlus className="size-3 text-muted-foreground" />
                                             <span>Assignee</span>
                                          </>
                                       )}
                                    </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent
                                    align="start"
                                    className="w-48 max-h-56 overflow-y-auto"
                                 >
                                    <DropdownMenuItem
                                       onClick={() => setSubIssueAssigneeId(undefined)}
                                    >
                                       <span className="text-xs text-muted-foreground">
                                          Unassigned
                                       </span>
                                    </DropdownMenuItem>
                                    {members.map((m) => (
                                       <DropdownMenuItem
                                          key={m.id}
                                          onClick={() => setSubIssueAssigneeId(m.id)}
                                       >
                                          <Avatar className="size-4 mr-2">
                                             <AvatarImage src={m.avatarUrl} />
                                             <AvatarFallback className="text-[9px]">
                                                {m.name[0]}
                                             </AvatarFallback>
                                          </Avatar>
                                          <span className="text-xs truncate">{m.name}</span>
                                       </DropdownMenuItem>
                                    ))}
                                 </DropdownMenuContent>
                              </DropdownMenu>

                              {/* Labels Dropdown Pill */}
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <button
                                       type="button"
                                       className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/50 transition-colors"
                                    >
                                       <Tag className="size-3 text-muted-foreground" />
                                       <span>
                                          {subIssueLabelIds.length > 0
                                             ? `${subIssueLabelIds.length} Labels`
                                             : 'Labels'}
                                       </span>
                                    </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent
                                    align="start"
                                    className="w-44 max-h-56 overflow-y-auto"
                                 >
                                    {labels.map((l) => (
                                       <DropdownMenuItem
                                          key={l.id}
                                          onClick={() => toggleLabel(l.id)}
                                          className="flex items-center justify-between"
                                       >
                                          <div className="flex items-center gap-2">
                                             <span
                                                className="size-2 rounded-full"
                                                style={{ backgroundColor: l.color }}
                                             />
                                             <span className="text-xs">{l.name}</span>
                                          </div>
                                          {subIssueLabelIds.includes(l.id) && (
                                             <Check className="size-3.5 text-primary" />
                                          )}
                                       </DropdownMenuItem>
                                    ))}
                                 </DropdownMenuContent>
                              </DropdownMenu>

                              {/* More Button */}
                              <button
                                 type="button"
                                 className="inline-flex items-center px-1.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/50 transition-colors"
                                 title="More options"
                              >
                                 <MoreHorizontal className="size-3.5" />
                              </button>
                           </div>

                           {/* Right Buttons: Cancel, Create */}
                           <div className="flex items-center gap-2">
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="ghost"
                                 className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                 onClick={() => {
                                    setIsAddingSubIssue(false);
                                    setSubIssueTitle('');
                                    setSubIssueDescription('');
                                 }}
                              >
                                 Cancel
                              </Button>
                              <Button
                                 type="button"
                                 size="sm"
                                 className="h-7 px-3 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                                 disabled={!subIssueTitle.trim() || createIssueMutation.isPending}
                                 onClick={handleCreateSubIssue}
                              >
                                 {createIssueMutation.isPending ? 'Creating...' : 'Create'}
                              </Button>
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               <div className="border-t border-border/60 mt-8" />

               <FileAttachments target={{ issueIdentifier: issue.identifier }} />

               <ActivityFeed
                  activity={detail.activity}
                  comments={detail.comments ?? []}
                  issueIdentifier={issue.identifier}
                  members={members}
                  isSubscribed={Boolean(issue.isSubscribed)}
                  isSubscriptionPending={subscriptionMutation.isPending}
                  onToggleSubscription={() =>
                     subscriptionMutation.mutate({
                        identifier: issue.identifier,
                        subscribed: !issue.isSubscribed,
                     })
                  }
               />
            </div>
         </div>

         {/* Properties sidebar */}
         <aside className="hidden lg:block w-80 shrink-0 border-l h-full overflow-y-auto bg-container px-5 py-6">
            <IssuePropertiesPanel issue={issue} detail={detail} />
         </aside>
      </div>
   );
}

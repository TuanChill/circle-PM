'use client';

import { ContentBlocks } from '@/components/common/issues/details/content-blocks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
   projectUpdateHealthColor,
   projectUpdateHealthLabel,
   type ProjectUpdateHealth,
} from '@/lib/project-health';
import type { ProjectUpdate } from '@/mock-data/project-details';
import { useAuthStore } from '@/store/auth-store';
import { format, parseISO } from 'date-fns';
import { Ellipsis } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProjectSidePanel } from './project-side-panel';
import { FileAttachments } from '@/components/common/attachments/file-attachments';

interface ProjectActivityProps {
   projectId: string;
}

function HealthBadge({ health }: { health: ProjectUpdateHealth }) {
   return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-2 py-0.5">
         <span
            className="size-2 rounded-full"
            style={{ backgroundColor: projectUpdateHealthColor[health] }}
         />
         {projectUpdateHealthLabel[health]}
      </span>
   );
}

function UpdateCard({
   update,
   projectId,
   currentUserId,
}: {
   update: ProjectUpdate;
   projectId: string;
   currentUserId?: string;
}) {
   const updateMutation = useUpdateProjectUpdate();
   const deleteMutation = useDeleteProjectUpdate();
   const [editing, setEditing] = useState(false);
   const [text, setText] = useState('');
   const [health, setHealth] = useState<ProjectUpdateHealth>(update.health);
   const canEdit = Boolean(
      currentUserId && currentUserId === (update.authorId ?? update.author?.id)
   );

   const startEditing = () => {
      setText(
         update.blocks
            .flatMap((block) =>
               typeof block === 'object' &&
               block !== null &&
               'text' in block &&
               typeof block.text === 'string'
                  ? [block.text]
                  : []
            )
            .join('\n\n')
      );
      setHealth(update.health);
      setEditing(true);
   };

   const save = async () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await updateMutation.mutateAsync({
         projectId,
         updateId: update.id,
         payload: {
            health,
            blocks: trimmed
               .split(/\n{2,}/)
               .map((paragraph) => ({ type: 'paragraph', text: paragraph.trim() }))
               .filter((block) => block.text),
         },
      });
      setEditing(false);
   };

   return (
      <div className="border rounded-lg p-4">
         <div className="flex items-center gap-2 text-sm">
            {update.author ? (
               <Avatar className="size-5">
                  <AvatarImage src={update.author.avatarUrl} alt={update.author.name} />
                  <AvatarFallback>{update.author.name[0]}</AvatarFallback>
               </Avatar>
            ) : (
               <span className="size-5 rounded-full bg-muted" aria-hidden="true" />
            )}
            <span className="font-medium">{update.author?.name ?? 'Unknown member'}</span>
            <span className="text-xs text-muted-foreground">
               {format(parseISO(update.date), 'MMM d')}
            </span>
            <div className="ml-auto flex items-center gap-2">
               <HealthBadge health={editing ? health : update.health} />
               {canEdit && (
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button
                           variant="ghost"
                           size="icon"
                           className="size-7"
                           aria-label="Project update actions"
                        >
                           <Ellipsis className="size-3.5" />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={startEditing}>Edit update</DropdownMenuItem>
                        <DropdownMenuItem
                           className="text-destructive"
                           onClick={() => {
                              if (window.confirm('Delete this project update?')) {
                                 deleteMutation.mutate({ projectId, updateId: update.id });
                              }
                           }}
                        >
                           Delete update
                        </DropdownMenuItem>
                     </DropdownMenuContent>
                  </DropdownMenu>
               )}
            </div>
         </div>
         {editing ? (
            <div className="mt-3 space-y-2">
               <Textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} />
               <div className="flex items-center justify-between gap-2">
                  <select
                     value={health}
                     onChange={(event) => setHealth(event.target.value as ProjectUpdateHealth)}
                     className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                     <option value="on-track">On track</option>
                     <option value="at-risk">At risk</option>
                     <option value="off-track">Off track</option>
                  </select>
                  <div className="flex gap-2">
                     <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                        Cancel
                     </Button>
                     <Button
                        size="sm"
                        disabled={updateMutation.isPending || !text.trim()}
                        onClick={save}
                     >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                     </Button>
                  </div>
               </div>
            </div>
         ) : (
            <div className="mt-2 text-sm leading-relaxed">
               <ContentBlocks blocks={update.blocks} />
            </div>
         )}
      </div>
   );
}

import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function ProjectActivitySkeleton() {
   return (
      <div className="w-full h-full flex overflow-hidden animate-in fade-in-50 duration-200">
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8 space-y-6">
               <Skeleton className="h-32 w-full rounded-lg" />
               <div className="space-y-4 pt-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
               </div>
            </div>
         </div>
         <aside className="hidden lg:block w-80 shrink-0 border-l h-full p-5 space-y-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
         </aside>
      </div>
   );
}

import {
   useProject,
   useProjectDetail,
   useDeleteProjectUpdate,
   usePostProjectUpdate,
   useUpdateProjectUpdate,
} from '@/hooks/queries/use-projects-query';
import { useIssues } from '@/hooks/queries/use-issues-query';
import QueryErrorState from '@/components/common/query-error-state';

/** Project "Activity" tab: update composer + monthly timeline. */
export default function ProjectActivity({ projectId }: ProjectActivityProps) {
   const { orgId } = useParams<{ orgId: string }>();
   const {
      data: project,
      isLoading,
      isError: isProjectError,
      error: projectError,
      refetch: refetchProject,
   } = useProject(projectId);
   const {
      data: detail,
      isLoading: detailLoading,
      isError: isDetailError,
      error: detailError,
      refetch: refetchDetail,
   } = useProjectDetail(projectId, Boolean(project));
   const { user: currentUser } = useAuthStore();
   const postUpdateMutation = usePostProjectUpdate();

   const {
      data: allIssues = [],
      isError: isIssuesError,
      error: issuesError,
      refetch: refetchIssues,
   } = useIssues();
   const issues = useMemo(
      () => allIssues.filter((issue) => issue.project?.id === project?.id),
      [allIssues, project?.id]
   );
   const [mode, setMode] = useState<'comment' | 'update'>('update');
   const [health, setHealth] = useState<ProjectUpdateHealth>('on-track');
   const [text, setText] = useState('');

   const updates = useMemo<ProjectUpdate[]>(() => detail?.updates ?? [], [detail?.updates]);
   const activities = useMemo(() => detail?.activity ?? [], [detail?.activity]);

   const updatesByMonth = useMemo(() => {
      const groups = new Map<string, ProjectUpdate[]>();
      for (const update of updates) {
         const month = format(parseISO(update.date), 'MMMM');
         groups.set(month, [...(groups.get(month) ?? []), update]);
      }
      return [...groups.entries()];
   }, [updates]);

   const completedPercent =
      issues.length > 0
         ? Math.round(
              (issues.filter((issue) => issue.status.category === 'completed').length /
                 issues.length) *
                 100
           )
         : 0;

   if (isProjectError) {
      return <QueryErrorState subject="project" error={projectError} onRetry={refetchProject} />;
   }

   if (isDetailError) {
      return (
         <QueryErrorState subject="project activity" error={detailError} onRetry={refetchDetail} />
      );
   }

   if (isIssuesError) {
      return (
         <QueryErrorState subject="project issues" error={issuesError} onRetry={refetchIssues} />
      );
   }

   if (isLoading) {
      return <ProjectActivitySkeleton />;
   }

   if (!project) {
      return (
         <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground animate-in fade-in-50 duration-200">
            <p className="text-base font-medium text-foreground">Project not found</p>
            <p className="text-xs text-muted-foreground">
               This project does not exist or has been removed.
            </p>
            <Link
               href={`/${orgId ?? ''}/projects`}
               className="mt-2 text-xs px-3 py-1.5 rounded-md border border-border/80 bg-accent hover:bg-accent/80 transition-colors font-medium text-foreground"
            >
               Back to projects
            </Link>
         </div>
      );
   }

   if (detailLoading || !detail) {
      return <ProjectActivitySkeleton />;
   }

   const handlePost = () => {
      if (text.trim() === '' || !currentUser) return;
      const blocks = text
         .split(/\n{2,}/)
         .filter((paragraph) => paragraph.trim() !== '')
         .map((paragraph) => ({ type: 'paragraph' as const, text: paragraph.trim() }));

      postUpdateMutation.mutate(
         { projectId: project.id, payload: { authorId: currentUser.id, health, blocks } },
         { onSuccess: () => setText('') }
      );
   };

   return (
      <div className="w-full h-full flex overflow-hidden">
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
               {/* Composer */}
               <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                     <div className="flex items-center rounded-md border p-0.5 text-xs">
                        {(['comment', 'update'] as const).map((value) => (
                           <button
                              key={value}
                              type="button"
                              onClick={() => setMode(value)}
                              className={cn(
                                 'px-2 py-1 rounded-[5px] capitalize transition-colors',
                                 mode === value
                                    ? 'bg-accent text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                              )}
                           >
                              {value}
                           </button>
                        ))}
                     </div>
                     {mode === 'update' && (
                        <DropdownMenu>
                           <DropdownMenuTrigger className="outline-none">
                              <HealthBadge health={health} />
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="start" className="w-40">
                              {(Object.keys(projectUpdateHealthLabel) as ProjectUpdateHealth[]).map(
                                 (value) => (
                                    <DropdownMenuItem key={value} onClick={() => setHealth(value)}>
                                       <span
                                          className="size-2 rounded-full"
                                          style={{
                                             backgroundColor: projectUpdateHealthColor[value],
                                          }}
                                       />
                                       {projectUpdateHealthLabel[value]}
                                    </DropdownMenuItem>
                                 )
                              )}
                           </DropdownMenuContent>
                        </DropdownMenu>
                     )}
                  </div>

                  <textarea
                     value={text}
                     onChange={(event) => setText(event.target.value)}
                     placeholder={
                        mode === 'update' ? 'Write a project update…' : 'Leave a comment…'
                     }
                     className="mt-3 w-full min-h-24 resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />

                  {mode === 'update' && (
                     <div className="mt-1 border-l-2 pl-4 py-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <div className="flex gap-6">
                           <span className="w-20">Priority</span>
                           <span>
                              No priority →{' '}
                              <span className="text-foreground">{project.priority.name}</span>
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Lead</span>
                           <span>
                              <span className="text-foreground">
                                 {project.lead?.name ?? 'No lead'}
                              </span>{' '}
                              assigned
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Target date</span>
                           <span>
                              set to{' '}
                              <span className="text-foreground">
                                 {project.targetDate
                                    ? format(parseISO(project.targetDate), 'MMM do')
                                    : '—'}
                              </span>
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Progress</span>
                           <span>
                              0% → <span className="text-foreground">{completedPercent}%</span>
                           </span>
                        </div>
                     </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Button
                           size="xs"
                           onClick={handlePost}
                           disabled={text.trim() === '' || postUpdateMutation.isPending}
                        >
                           Post {mode === 'update' ? 'update' : 'comment'}
                        </Button>
                     </div>
                  </div>
               </div>

               <FileAttachments target={{ projectId: project.id }} />

               {/* Persisted activity */}
               {activities.length > 0 && (
                  <div className="mt-8">
                     <h3 className="text-lg font-semibold mb-3">Activity</h3>
                     <div className="flex flex-col gap-2">
                        {activities.map((activity) => (
                           <div
                              key={activity.id}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                           >
                              {activity.user ? (
                                 <Avatar className="size-5">
                                    <AvatarImage
                                       src={activity.user.avatarUrl}
                                       alt={activity.user.name}
                                    />
                                    <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                                 </Avatar>
                              ) : (
                                 <span
                                    className="size-5 rounded-full bg-muted"
                                    aria-hidden="true"
                                 />
                              )}
                              <span className="text-foreground">
                                 {activity.user?.name ?? 'Unknown member'}
                              </span>
                              <span>{activity.text}</span>
                              <span className="ml-auto text-xs">
                                 {format(parseISO(activity.date), 'MMM d')}
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* Timeline */}
               {updatesByMonth.length === 0 ? (
                  <p className="mt-10 text-sm text-muted-foreground text-center">
                     No updates yet — post the first one to keep the team in the loop.
                  </p>
               ) : (
                  updatesByMonth.map(([month, monthUpdates]) => (
                     <div key={month} className="mt-8">
                        <h3 className="text-lg font-semibold mb-3">{month}</h3>
                        <div className="flex flex-col gap-3">
                           {monthUpdates.map((update) => (
                              <UpdateCard
                                 key={update.id}
                                 update={update}
                                 projectId={project.id}
                                 currentUserId={currentUser?.id}
                              />
                           ))}
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>

         <ProjectSidePanel project={project} detail={detail} issues={issues} />
      </div>
   );
}

'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { format, parseISO } from 'date-fns';
import { renderProjectIcon } from '@/lib/project-utils';
import { ArrowRight, ChevronDown, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentOutline, getOutlineItems } from './document-outline';
import { ProjectSidePanel } from './project-side-panel';
import { StatusSelector } from '../status-selector';
import { PrioritySelector } from '../priority-selector';
import { LeadSelector } from '../lead-selector';
import { DatePicker } from '../date-picker';
import { LabelSelector } from '@/components/layout/sidebar/create-new-issue/label-selector';
import type { Project } from '@/mock-data/projects';
import type { LabelInterface } from '@/mock-data/labels';
import { LinearEditor } from '@/components/common/editor/linear-editor';
import { contentBlocksToMarkdown } from '@/lib/content-blocks-to-markdown';
import { markdownToContentBlocks } from '@/lib/markdown-to-content-blocks';
import { ProjectResourcesEditor } from './project-resources-editor';
import { FileAttachments } from '@/components/common/attachments/file-attachments';
import QueryErrorState from '@/components/common/query-error-state';

interface ProjectOverviewProps {
   projectId: string;
}

const formatDay = (iso?: string) => (iso ? format(parseISO(iso), 'MMM do') : '—');

function ProjectOverviewSkeleton() {
   return (
      <div className="w-full h-full flex overflow-hidden animate-in fade-in-50 duration-200">
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 space-y-6">
               <Skeleton className="size-10 rounded-md" />
               <Skeleton className="h-8 w-3/5" />
               <Skeleton className="h-4 w-4/5" />
               <div className="space-y-3 pt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-3/4" />
               </div>
            </div>
         </div>
         <aside className="hidden lg:block w-80 shrink-0 border-l h-full p-5 space-y-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
         </aside>
      </div>
   );
}

import { useProject, useProjectDetail, useUpdateProject } from '@/hooks/queries/use-projects-query';
import { useIssues } from '@/hooks/queries/use-issues-query';

/** Project "Overview" tab: description column + properties side panel. */
export default function ProjectOverview({ projectId }: ProjectOverviewProps) {
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

   const {
      data: teams = [],
      isError: isTeamsError,
      error: teamsError,
      refetch: refetchTeams,
   } = useTeams();
   const team = teams.find((candidate) => candidate.id === project?.teamId);
   const scrollRef = useRef<HTMLDivElement>(null);
   const outlineItems = useMemo(
      () => getOutlineItems(detail?.description ?? []),
      [detail?.description]
   );

   const updateProjectMutation = useUpdateProject();
   const [descriptionOverride, setDescriptionOverride] = useState<string | null>(null);
   const serverDescriptionMarkdown = useMemo(
      () => contentBlocksToMarkdown(detail?.description).trim(),
      [detail?.description]
   );
   const descriptionMarkdown = descriptionOverride ?? serverDescriptionMarkdown;

   useEffect(() => {
      if (descriptionOverride !== null && descriptionOverride === serverDescriptionMarkdown) {
         setDescriptionOverride(null);
      }
   }, [descriptionOverride, serverDescriptionMarkdown]);

   const handleSaveDescription = useCallback(
      (newMarkdown: string) => {
         if (!project) return;
         const trimmed = newMarkdown.trim();
         if (trimmed === serverDescriptionMarkdown) return;

         setDescriptionOverride(trimmed);
         updateProjectMutation.mutate(
            {
               id: project.id,
               payload: {
                  description: markdownToContentBlocks(trimmed),
               } as Partial<Project>,
            },
            {
               onError: () => {
                  setDescriptionOverride(null);
               },
            }
         );
      },
      [project, serverDescriptionMarkdown, updateProjectMutation]
   );

   const handleStatusChange = (statusId: string) => {
      if (!project) return;
      updateProjectMutation.mutate({
         id: project.id,
         payload: { statusId } as unknown as Partial<Project>,
      });
   };
   const handlePriorityChange = (priorityId: string) => {
      if (!project) return;
      updateProjectMutation.mutate({
         id: project.id,
         payload: { priorityId } as unknown as Partial<Project>,
      });
   };
   const handleLeadChange = (leadId: string) => {
      if (!project) return;
      updateProjectMutation.mutate({
         id: project.id,
         payload: { leadId } as unknown as Partial<Project>,
      });
   };
   const handleTargetDateChange = (date: Date | undefined) => {
      if (!project) return;
      updateProjectMutation.mutate({
         id: project.id,
         payload: {
            targetDate: date ? format(date, 'yyyy-MM-dd') : undefined,
         } as unknown as Partial<Project>,
      });
   };
   const handleLabelsChange = (newLabels: LabelInterface[]) => {
      if (!project) return;
      updateProjectMutation.mutate({
         id: project.id,
         payload: {
            labelIds: newLabels.map((l) => l.id),
         } as unknown as Partial<Project>,
      });
   };

   if (isProjectError) {
      return <QueryErrorState subject="project" error={projectError} onRetry={refetchProject} />;
   }

   if (isDetailError) {
      return (
         <QueryErrorState subject="project details" error={detailError} onRetry={refetchDetail} />
      );
   }

   if (isIssuesError) {
      return (
         <QueryErrorState subject="project issues" error={issuesError} onRetry={refetchIssues} />
      );
   }

   if (isTeamsError) {
      return <QueryErrorState subject="project teams" error={teamsError} onRetry={refetchTeams} />;
   }

   if (isLoading) {
      return <ProjectOverviewSkeleton />;
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
      return <ProjectOverviewSkeleton />;
   }

   return (
      <div className="w-full h-full flex overflow-hidden">
         {/* Main column */}
         <div className="flex-1 min-w-0 h-full relative">
            <DocumentOutline items={outlineItems} scrollRef={scrollRef} />
            <div ref={scrollRef} className="h-full overflow-y-auto">
               <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
                  <div className="inline-flex size-10 bg-muted/50 items-center justify-center rounded-md mb-4">
                     {renderProjectIcon(project.icon, 'size-6')}
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{detail.summary}</p>

                  {/* Inline properties */}
                  <div className="mt-6 flex flex-col gap-2.5 text-sm">
                     <div className="flex items-center gap-3">
                        <span className="w-24 text-muted-foreground shrink-0">Properties</span>
                        <div className="flex items-center gap-1 flex-wrap">
                           <StatusSelector
                              status={project.status}
                              onStatusChange={handleStatusChange}
                           />
                           <PrioritySelector
                              priority={project.priority}
                              onPriorityChange={handlePriorityChange}
                              showLabel
                           />
                           <LeadSelector lead={project.lead} onLeadChange={handleLeadChange} />
                           <span className="inline-flex items-center gap-1 text-muted-foreground text-xs px-2">
                              {formatDay(project.startDate)}
                              <ArrowRight className="size-3" />
                           </span>
                           <DatePicker
                              date={project.targetDate ? new Date(project.targetDate) : undefined}
                              onDateChange={handleTargetDateChange}
                           />
                           {team && (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2">
                                 {team.icon} {team.name}
                              </span>
                           )}
                        </div>
                     </div>

                     {project.initiative && (
                        <div className="flex items-center gap-3">
                           <span className="w-24 text-muted-foreground shrink-0">Initiatives</span>
                           <span className="inline-flex items-center gap-1.5">
                              📄 {project.initiative}
                           </span>
                        </div>
                     )}

                     <div className="flex items-center gap-3">
                        <span className="w-24 text-muted-foreground shrink-0">Labels</span>
                        <div className="flex items-center gap-1.5">
                           {project.labels.map((label) => (
                              <span
                                 key={label.id}
                                 className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5"
                              >
                                 <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                 />
                                 {label.name}
                                 <ChevronDown className="size-3 text-muted-foreground" />
                              </span>
                           ))}
                           <LabelSelector
                              selectedLabels={project.labels}
                              onChange={handleLabelsChange}
                              showCounts={false}
                              allowCreate
                              scope="project"
                           />
                        </div>
                     </div>

                     <div className="flex items-center gap-3">
                        <span className="w-24 text-muted-foreground shrink-0">Resources</span>
                        <ProjectResourcesEditor
                           projectId={project.id}
                           resources={detail.resources}
                        />
                     </div>

                     <FileAttachments target={{ projectId: project.id }} />
                  </div>

                  {/* Update CTA */}
                  <Link
                     href={`/${orgId}/project/${project.id}/activity`}
                     className="mt-8 flex items-center justify-center gap-2 border rounded-lg py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                  >
                     <PenLine className="size-4" />
                     Write {detail.updates.length === 0 ? 'first ' : ''}project update
                  </Link>

                  {/* Description */}
                  <div className="mt-10">
                     <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-2">
                        Description
                        <ChevronDown className="size-3.5" />
                     </div>
                     <LinearEditor
                        value={descriptionMarkdown}
                        onSave={handleSaveDescription}
                        mode="click-to-edit"
                        placeholder="Add project description or type '/' for commands..."
                        className="px-2 py-1 -mx-2 rounded hover:bg-accent/20 transition-colors"
                     />
                  </div>
               </div>
            </div>
         </div>

         {/* Side panel */}
         <ProjectSidePanel project={project} detail={detail} issues={issues} />
      </div>
   );
}

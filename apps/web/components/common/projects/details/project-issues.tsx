'use client';

import { GroupedIssuesView } from '@/components/common/issues/grouped-issues-view';
import { applyIssueFilters } from '@/components/common/issues/issue-filter-columns';
import { IssueFilterBar } from '@/components/common/issues/issue-filter-bar';
import { workflowStatuses } from '@/lib/issue-statuses';
import { useFilterStore } from '@/store/filter-store';
import { useMemo, useEffect } from 'react';
import { ProjectSidePanel } from './project-side-panel';

import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ProjectIssuesProps {
   projectId: string;
}

function ProjectIssuesSkeleton() {
   return (
      <div className="w-full h-full flex flex-col p-6 space-y-4 animate-in fade-in-50 duration-200">
         <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-24" />
         </div>
         <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
               <div key={i} className="flex items-center gap-3 py-2 border-b border-border/40">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
               </div>
            ))}
         </div>
      </div>
   );
}

import { useProject, useProjectDetail } from '@/hooks/queries/use-projects-query';
import { useIssues } from '@/hooks/queries/use-issues-query';
import { useViews } from '@/hooks/queries/use-views-query';
import { useViewStore } from '@/store/view-store';
import { useDisplaySettingsStore } from '@/store/display-settings-store';
import { useSearchParams } from 'next/navigation';
import QueryErrorState from '@/components/common/query-error-state';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';

/** Project "Issues" tab: the project's issues grouped by status. */
export default function ProjectIssues({ projectId }: ProjectIssuesProps) {
   const { orgId } = useParams<{ orgId: string }>();
   const searchParams = useSearchParams();
   const activeViewId = searchParams.get('view');
   const {
      data: project,
      isLoading,
      isError: projectError,
      error: projectQueryError,
      refetch: refetchProject,
   } = useProject(projectId);
   const { data: statusRecords } = useIssueStatuses(project?.teamId);
   const statuses = workflowStatuses(statusRecords);
   const {
      data: detail,
      isLoading: detailLoading,
      isError: detailError,
      error: detailQueryError,
      refetch: refetchDetail,
   } = useProjectDetail(projectId, Boolean(project));
   const {
      data: views = [],
      isError: viewsError,
      error: viewsQueryError,
      refetch: refetchViews,
   } = useViews({ projectId });

   const {
      data: allIssues = [],
      isError: issuesError,
      error: issuesQueryError,
      refetch: refetchIssues,
   } = useIssues({ projectId });
   const { filters, setFilters } = useFilterStore();
   const { viewType, setViewType } = useViewStore();
   const { setDisplaySettings } = useDisplaySettingsStore();
   const isViewTypeGrid = viewType === 'grid';

   const activeCustomView = useMemo(
      () => views.find((v) => v.id === activeViewId),
      [views, activeViewId]
   );

   useEffect(() => {
      if (activeCustomView) {
         if (activeCustomView.filter?.filters) {
            setFilters(activeCustomView.filter.filters);
         }
         if (activeCustomView.layout) {
            setViewType(activeCustomView.layout);
         }
         if (activeCustomView.filter) {
            setDisplaySettings(activeCustomView.filter as Parameters<typeof setDisplaySettings>[0]);
         }
      }
   }, [activeCustomView, setFilters, setViewType, setDisplaySettings]);

   const issues = useMemo(
      () =>
         allIssues.filter(
            (issue) =>
               issue.project?.id === projectId || (project?.id && issue.project?.id === project.id)
         ),
      [allIssues, projectId, project?.id]
   );

   const displayedIssues = useMemo(() => applyIssueFilters(issues, filters), [issues, filters]);

   if (projectError) {
      return (
         <QueryErrorState subject="project" error={projectQueryError} onRetry={refetchProject} />
      );
   }

   if (detailError) {
      return (
         <QueryErrorState
            subject="project details"
            error={detailQueryError}
            onRetry={refetchDetail}
         />
      );
   }

   if (issuesError) {
      return (
         <QueryErrorState
            subject="project issues"
            error={issuesQueryError}
            onRetry={refetchIssues}
         />
      );
   }

   if (viewsError) {
      return (
         <QueryErrorState subject="project views" error={viewsQueryError} onRetry={refetchViews} />
      );
   }

   if (isLoading) {
      return <ProjectIssuesSkeleton />;
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
      return <ProjectIssuesSkeleton />;
   }

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar issues={issues} />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={issues}
                  statuses={statuses}
                  isViewTypeGrid={isViewTypeGrid}
                  emptyStateTitle="Add issues to the project"
                  emptyStateSubtitle="Start building your project by creating an issue."
                  emptyStateDescription="You can also add teams, team members, and project dates in the project sidebar."
                  contextOptions={{ project }}
               />
            </div>
            <ProjectSidePanel
               project={project}
               detail={detail}
               issues={issues}
               insightsIssues={displayedIssues}
            />
         </div>
      </div>
   );
}

'use client';

import type { Issue } from '@/mock-data/issues';
import { StatusCategory, workflowOrderedStatus } from '@/lib/workflow-status';
import { useFilterStore } from '@/store/filter-store';
import { applyIssueFilters } from './issue-filter-columns';
import { IssueFilterBar } from './issue-filter-bar';
import { useRightPanelStore } from '@/store/right-panel-store';
import { useSearchStore } from '@/store/search-store';
import { useViewStore } from '@/store/view-store';
import { useDisplaySettingsStore } from '@/store/display-settings-store';
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { GroupedIssuesView } from './grouped-issues-view';
import { InsightsPanel } from './insights-panel';
import { SearchIssues } from './search-issues';

import { useIssues } from '@/hooks/queries/use-issues-query';
import { useViews } from '@/hooks/queries/use-views-query';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';
import { workflowStatuses } from '@/lib/issue-statuses';
import QueryErrorState from '@/components/common/query-error-state';

interface AllIssuesProps {
   /**
    * Optional status-category filter, used by the "Active" and "Backlog"
    * tabs. When omitted, every status is shown ("All issues").
    */
   categories?: StatusCategory[];
}

export default function AllIssues({ categories }: AllIssuesProps) {
   const { teamId } = useParams<{ teamId: string }>();
   const searchParams = useSearchParams();
   const activeViewId = searchParams.get('view');
   const { isSearchOpen, searchQuery } = useSearchStore();
   const { viewType, setViewType } = useViewStore();
   const { filters, setFilters } = useFilterStore();
   const { setDisplaySettings } = useDisplaySettingsStore();
   const { data: serverIssues = [], isError, error, refetch } = useIssues();
   const { data: statusRecords } = useIssueStatuses(teamId);
   const { openPanel } = useRightPanelStore();
   const {
      data: views = [],
      isError: isViewsError,
      error: viewsError,
      refetch: refetchViews,
   } = useViews({ teamId });

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

   // The authenticated API response is the only source of rendered records.
   // Local mutation state is invalidated/refetched by the issue query hooks.
   const issues = serverIssues;

   const isSearching = isSearchOpen && searchQuery.trim() !== '';
   const isViewTypeGrid = viewType === 'grid';

   const statuses = useMemo(() => {
      const teamStatuses = workflowStatuses(statusRecords);
      return (
         categories
            ? teamStatuses.filter((item) => categories.includes(item.category))
            : teamStatuses
      ).sort(
         (a, b) =>
            workflowOrderedStatus.findIndex((s) => s.category === a.category) -
            workflowOrderedStatus.findIndex((s) => s.category === b.category)
      );
   }, [categories, statusRecords]);

   const scopedIssues = useMemo<Issue[]>(
      () =>
         categories ? issues.filter((issue) => categories.includes(issue.status.category)) : issues,
      [issues, categories]
   );

   const displayedIssues = useMemo(
      () => applyIssueFilters(scopedIssues, filters),
      [scopedIssues, filters]
   );

   if (isError) {
      return <QueryErrorState subject="issues" error={error} onRetry={refetch} />;
   }

   if (isViewsError) {
      return <QueryErrorState subject="saved views" error={viewsError} onRetry={refetchViews} />;
   }

   if (isSearching) {
      return (
         <div className="w-full h-full">
            <div className="px-6 mb-6">
               <SearchIssues />
            </div>
         </div>
      );
   }

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar issues={scopedIssues} />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={scopedIssues}
                  statuses={statuses}
                  isViewTypeGrid={isViewTypeGrid}
                  emptyStateTitle="No issues yet"
                  emptyStateSubtitle="Track bugs, tasks, and feature requests for your team."
                  emptyStateDescription="Press 'C' anywhere or click the button below to create your first issue."
               />
            </div>

            {openPanel === 'insights' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <InsightsPanel issues={displayedIssues} statuses={statuses} />
               </aside>
            )}
         </div>
      </div>
   );
}

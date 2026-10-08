'use client';

import { applyIssueFilters } from '@/components/common/issues/issue-filter-columns';
import { IssueFilterBar } from '@/components/common/issues/issue-filter-bar';
import { GroupedIssuesView } from '@/components/common/issues/grouped-issues-view';
import { InsightsPanel } from '@/components/common/issues/insights-panel';
import { SearchIssues } from '@/components/common/issues/search-issues';
import { BreakdownPanel } from './breakdown-panel';
import { mergeWorkflowStatuses } from '@/lib/issue-statuses';
import { useFilterStore } from '@/store/filter-store';
import { useAuthStore } from '@/store/auth-store';
import { useRightPanelStore } from '@/store/right-panel-store';
import { useSearchStore } from '@/store/search-store';
import { useViewStore } from '@/store/view-store';
import { useMemo } from 'react';
import { scopeMyIssues, useMyIssuesTab } from './use-my-issues';

import { useIssues } from '@/hooks/queries/use-issues-query';
import QueryErrorState from '@/components/common/query-error-state';

/**
 * "My issues" body — the exact same machinery as the team issue views
 * (search, filter bar, list/board display, insights panel), scoped to the
 * current tab (Assigned / Created / Subscribed / Activity).
 */
export default function MyIssues() {
   const [tab] = useMyIssuesTab();
   const { isSearchOpen, searchQuery } = useSearchStore();
   const { viewType } = useViewStore();
   const { filters } = useFilterStore();
   const { data: serverIssues = [], isError, error, refetch } = useIssues();
   const currentUserId = useAuthStore((state) => state.user?.id ?? null);
   const { openPanel } = useRightPanelStore();

   const isSearching = isSearchOpen && searchQuery.trim() !== '';
   const isViewTypeGrid = viewType === 'grid';

   const scopedIssues = useMemo(
      () => scopeMyIssues(serverIssues, tab, currentUserId),
      [serverIssues, tab, currentUserId]
   );

   const displayedIssues = useMemo(
      () => applyIssueFilters(scopedIssues, filters),
      [scopedIssues, filters]
   );
   const statuses = useMemo(
      () => mergeWorkflowStatuses(scopedIssues.map((issue) => issue.status)),
      [scopedIssues]
   );

   if (isError) {
      return <QueryErrorState subject="your issues" error={error} onRetry={refetch} />;
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
                  emptyStateTitle="No issues assigned to you"
                  emptyStateSubtitle="Issues assigned to you across teams will show up here."
                  emptyStateDescription="You can create a new issue and assign it to yourself at any time."
               />
            </div>

            {openPanel === 'insights' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <InsightsPanel issues={displayedIssues} statuses={statuses} />
               </aside>
            )}
            {openPanel === 'breakdown' && (
               <aside className="hidden lg:flex w-80 shrink-0 border-l h-full overflow-hidden bg-container">
                  <BreakdownPanel issues={displayedIssues} />
               </aside>
            )}
         </div>
      </div>
   );
}

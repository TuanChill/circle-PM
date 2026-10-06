'use client';

import { CycleDetailsPanel } from '@/components/common/cycles/cycle-details-panel';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { workflowOrderedStatus } from '@/lib/workflow-status';
import { useFilterStore } from '@/store/filter-store';
import { applyIssueFilters } from './issue-filter-columns';
import { IssueFilterBar } from './issue-filter-bar';
import { useRightPanelStore } from '@/store/right-panel-store';
import { useSearchStore } from '@/store/search-store';
import { useViewStore } from '@/store/view-store';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { GroupedIssuesView } from './grouped-issues-view';
import { InsightsPanel } from './insights-panel';
import { SearchIssues } from './search-issues';
import QueryErrorState from '@/components/common/query-error-state';

export type CycleView = 'active' | 'upcoming';

interface CycleIssuesProps {
   /** 'active' = current cycle, 'upcoming' = next cycle. */
   cycleView: CycleView;
}

import { useIssues } from '@/hooks/queries/use-issues-query';

/**
 * Issue view scoped to a cycle — same behavior as AllIssues (search,
 * filters, list/board) plus the cycle details / insights side panels.
 */
export default function CycleIssues({ cycleView }: CycleIssuesProps) {
   const { teamId } = useParams<{ teamId: string }>();
   const { isSearchOpen, searchQuery } = useSearchStore();
   const { viewType } = useViewStore();
   const { filters } = useFilterStore();
   const {
      data: serverIssues = [],
      isError: issuesError,
      error: issuesQueryError,
      refetch: refetchIssues,
   } = useIssues();
   const { openPanel } = useRightPanelStore();
   const {
      data: cycles = [],
      isError: cyclesError,
      error: cyclesQueryError,
      refetch: refetchCycles,
   } = useCycles(teamId);

   const issues = serverIssues;

   // No fallback to an arbitrary cycle: a team can genuinely have no cycle
   // with status 'current'/'upcoming' (e.g. right after the active cycle is
   // marked completed), and that must render as an empty state rather than
   // silently substituting a different cycle.
   const cycle = cycles.find((c) => c.status === (cycleView === 'active' ? 'current' : 'upcoming'));

   const isSearching = isSearchOpen && searchQuery.trim() !== '';
   const isViewTypeGrid = viewType === 'grid';

   const cycleIssues = useMemo(
      () => (cycle ? issues.filter((issue) => issue.cycleId === cycle.id) : []),
      [issues, cycle]
   );

   const displayedIssues = useMemo(
      () => applyIssueFilters(cycleIssues, filters),
      [cycleIssues, filters]
   );

   if (issuesError) {
      return (
         <QueryErrorState subject="cycle issues" error={issuesQueryError} onRetry={refetchIssues} />
      );
   }

   if (cyclesError) {
      return <QueryErrorState subject="cycles" error={cyclesQueryError} onRetry={refetchCycles} />;
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

   if (!cycle) {
      return (
         <div className="w-full h-full flex items-center justify-center p-12 text-sm text-muted-foreground">
            {cycleView === 'active' ? 'No active cycle right now.' : 'No upcoming cycle scheduled.'}
         </div>
      );
   }

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar issues={cycleIssues} />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={cycleIssues}
                  statuses={workflowOrderedStatus}
                  isViewTypeGrid={isViewTypeGrid}
                  emptyStateTitle="No issues in this cycle"
                  emptyStateSubtitle="Plan and organize issues to deliver in this cycle."
                  emptyStateDescription="Add issues to this cycle to track scope and progress."
               />
            </div>

            {openPanel === 'insights' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <InsightsPanel issues={displayedIssues} />
               </aside>
            )}
            {openPanel === 'cycle-details' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <CycleDetailsPanel cycle={cycle} issues={cycleIssues} />
               </aside>
            )}
         </div>
      </div>
   );
}

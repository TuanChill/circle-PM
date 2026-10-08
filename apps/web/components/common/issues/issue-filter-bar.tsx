'use client';

import { useMemo } from 'react';
import { DataTableFilter } from '@/components/data-table-filter';
import { useDataTableFilters } from '@/components/data-table-filter/hooks/use-data-table-filters';
import { useFilterStore } from '@/store/filter-store';
import type { Issue } from '@/mock-data/issues';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useProjects } from '@/hooks/queries/use-projects-query';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { buildIssueFilterColumns } from './issue-filter-columns';
import QueryErrorState from '@/components/common/query-error-state';

/**
 * Linear-style applied-filters row: filter chips (subject / operator /
 * values / remove), an icon button to add more filters and a Clear action,
 * powered by bazza/ui's data-table-filter. Filter state lives in the URL
 * (see filter-store).
 *
 * The row only appears once at least one filter is active — the entry
 * point "Filter" button lives in the header toolbar (see
 * <IssueFilterTrigger/>), like Linear.
 */
export function IssueFilterBar({ issues }: { issues: Issue[] }) {
   const { filters, setFilters } = useFilterStore();
   const membersQuery = useMembers();
   const projectsQuery = useProjects();
   const cyclesQuery = useCycles();
   const labelsQuery = useLabels('issue');
   const { data: members = [] } = membersQuery;
   const { data: projects = [] } = projectsQuery;
   const { data: cycles = [] } = cyclesQuery;
   const { data: labels = [] } = labelsQuery;

   const columnsConfig = useMemo(() => {
      const statuses = [
         ...new Map(issues.map((issue) => [issue.status.id, issue.status])).values(),
      ];
      return buildIssueFilterColumns(members, projects, cycles, labels, statuses);
   }, [members, projects, cycles, labels, issues]);

   const { columns, actions, strategy } = useDataTableFilters({
      strategy: 'client',
      data: issues,
      columnsConfig,
      filters,
      onFiltersChange: setFilters,
   });

   if (filters.length === 0) return null;

   const failedQuery = [membersQuery, projectsQuery, cyclesQuery, labelsQuery].find(
      (query) => query.isError
   );
   if (failedQuery) {
      return (
         <QueryErrorState
            subject="issue filter options"
            error={failedQuery.error}
            onRetry={() => void failedQuery.refetch()}
         />
      );
   }

   return (
      <div className="w-full px-6 py-2 border-b border-border/60 bg-container">
         <DataTableFilter
            columns={columns}
            filters={filters}
            actions={actions}
            strategy={strategy}
         />
      </div>
   );
}

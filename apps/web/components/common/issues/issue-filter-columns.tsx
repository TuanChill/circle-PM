'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createColumnConfigHelper } from '@/components/data-table-filter/core/filters';
import type {
   ColumnOption,
   FilterModel,
   FiltersState,
} from '@/components/data-table-filter/core/types';
import {
   dateFilterFn,
   multiOptionFilterFn,
   numberFilterFn,
   optionFilterFn,
   textFilterFn,
} from '@/components/data-table-filter/lib/filter-fns';
import { cycleStatusLabel } from '@/lib/cycle-utils';
import type { Cycle } from '@/services/cycles.service';
import type { Issue } from '@/mock-data/issues';
import { priorities } from '@/lib/priority-catalog';
import { status, Status, StatusCategory } from '@/lib/workflow-status';
import type { Project } from '@/mock-data/projects';
import { renderProjectIcon } from '@/lib/project-utils';
import type { Member } from '@/services/members.service';
import type { LabelItem } from '@/services/labels.service';
import {
   BarChart3,
   CalendarClock,
   Calculator,
   CircleCheck,
   CircleDashed,
   CircleUserRound,
   FileText,
   Folder,
   RefreshCcw,
   Tag,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                Option lists                                */
/* -------------------------------------------------------------------------- */

const statusOptionsFor = (statuses: Status[]) =>
   statuses.map((item) => ({
      value: item.id,
      label: item.name,
      icon: <item.icon />,
   }));

const STATUS_TYPES: { id: StatusCategory; name: string }[] = [
   { id: 'triage', name: 'Triage' },
   { id: 'backlog', name: 'Backlog' },
   { id: 'unstarted', name: 'Unstarted' },
   { id: 'started', name: 'Started' },
   { id: 'completed', name: 'Completed' },
   { id: 'canceled', name: 'Canceled' },
];

const statusTypeOptions: ColumnOption[] = STATUS_TYPES.map((item) => ({
   value: item.id,
   label: item.name,
   icon: <CircleDashed className="size-4 text-muted-foreground" />,
}));

const priorityOptions: ColumnOption[] = priorities.map((priority) => ({
   value: priority.id,
   label: priority.name,
   icon: <priority.icon className="size-4 text-muted-foreground" />,
}));

function buildLabelOptions(labels: LabelItem[]): ColumnOption[] {
   return labels.map((label) => ({
      value: label.id,
      label: label.name,
      icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />,
   }));
}

function buildAssigneeOptions(members: Member[]): ColumnOption[] {
   return [
      {
         value: 'unassigned',
         label: 'Unassigned',
         icon: <CircleUserRound className="size-4 text-muted-foreground" />,
      },
      ...members.map((member) => ({
         value: member.id,
         label: member.name,
         icon: (
            <Avatar className="size-4">
               <AvatarImage src={member.avatarUrl} alt={member.name} />
               <AvatarFallback>{member.name[0]}</AvatarFallback>
            </Avatar>
         ),
      })),
   ];
}

function buildProjectOptions(projects: Project[]): ColumnOption[] {
   return [
      {
         value: 'no-project',
         label: 'No project',
         icon: <Folder className="size-4 text-muted-foreground" />,
      },
      ...projects.map((project) => ({
         value: project.id,
         label: project.name,
         icon: renderProjectIcon(project.icon, 'size-4 text-muted-foreground'),
      })),
   ];
}

function buildCycleOptions(cycles: Cycle[]): ColumnOption[] {
   return [
      {
         value: 'no-cycle',
         label: 'No cycle',
         icon: <RefreshCcw className="size-4 text-muted-foreground" />,
      },
      ...cycles.map((cycle) => ({
         value: cycle.id,
         label: `${cycle.name} (${cycleStatusLabel[cycle.status]})`,
         icon: <RefreshCcw className="size-4 text-muted-foreground" />,
      })),
   ];
}

/* -------------------------------------------------------------------------- */
/*                              Column definitions                            */
/* -------------------------------------------------------------------------- */

const dtf = createColumnConfigHelper<Issue>();

/**
 * Filterable issue columns for the bazza/ui data-table-filter component.
 * Accessors return the raw values the filter functions compare against;
 * `.options()` only feeds the option pickers, so pass live members/projects/
 * cycles to populate those with real data.
 */
export function buildIssueFilterColumns(
   members: Member[] = [],
   projects: Project[] = [],
   cycles: Cycle[] = [],
   labels: LabelItem[] = [],
   statuses: Status[] = status
) {
   return [
      dtf
         .text()
         .id('title')
         .accessor((issue: Issue) => issue.title)
         .displayName('Title')
         .icon(FileText)
         .build(),
      dtf
         .text()
         .id('identifier')
         .accessor((issue: Issue) => issue.identifier)
         .displayName('ID')
         .icon(FileText)
         .build(),
      dtf
         .option()
         .id('status')
         .accessor((issue: Issue) => issue.status.id)
         .displayName('Status')
         .icon(CircleCheck)
         .options(statusOptionsFor(statuses))
         .build(),
      dtf
         .option()
         .id('statusType')
         .accessor((issue: Issue) => issue.status.category)
         .displayName('Status type')
         .icon(CircleDashed)
         .options(statusTypeOptions)
         .build(),
      dtf
         .option()
         .id('assignee')
         .accessor((issue: Issue) => issue.assignee?.id ?? 'unassigned')
         .displayName('Assignee')
         .icon(CircleUserRound)
         .options(buildAssigneeOptions(members))
         .build(),
      dtf
         .option()
         .id('priority')
         .accessor((issue: Issue) => issue.priority.id)
         .displayName('Priority')
         .icon(BarChart3)
         .options(priorityOptions)
         .build(),
      dtf
         .number()
         .id('estimate')
         .accessor((issue: Issue) => issue.estimate ?? Number.NaN)
         .displayName('Estimate')
         .icon(Calculator)
         .min(0)
         .build(),
      dtf
         .multiOption()
         .id('labels')
         .accessor((issue: Issue) => issue.labels.map((label) => label.id))
         .displayName('Labels')
         .icon(Tag)
         .options(buildLabelOptions(labels))
         .build(),
      dtf
         .option()
         .id('project')
         .accessor((issue: Issue) => issue.project?.id ?? '')
         .displayName('Project')
         .icon(Folder)
         .options(buildProjectOptions(projects))
         .build(),
      dtf
         .option()
         .id('cycle')
         .accessor((issue: Issue) => (issue.cycleId === '' ? 'no-cycle' : issue.cycleId))
         .displayName('Cycle')
         .icon(RefreshCcw)
         .options(buildCycleOptions(cycles))
         .build(),
      dtf
         .date()
         .id('dueDate')
         .accessor((issue: Issue) => new Date(issue.dueDate ?? 'invalid'))
         .displayName('Due date')
         .icon(CalendarClock)
         .build(),
      dtf
         .date()
         .id('createdAt')
         .accessor((issue: Issue) => new Date(issue.createdAt))
         .displayName('Created date')
         .icon(CalendarClock)
         .build(),
   ] as const;
}

export const issueFilterColumns = buildIssueFilterColumns();

const columnById = new Map<string, (typeof issueFilterColumns)[number]>(
   issueFilterColumns.map((column) => [column.id, column])
);

/**
 * Applies a bazza/ui FiltersState to a list of issues, honoring the
 * operator of each filter (is / is not / include / exclude / …).
 */
export function applyIssueFilters(issues: Issue[], filters: FiltersState): Issue[] {
   if (filters.length === 0) return issues;

   return issues.filter((issue) =>
      filters.every((filter) => {
         const column = columnById.get(filter.columnId);
         if (!column) return true;

         const value = column.accessor(issue);
         switch (filter.type) {
            case 'option':
               return optionFilterFn(String(value ?? ''), filter) ?? true;
            case 'multiOption':
               return multiOptionFilterFn((value as string[]) ?? [], filter) ?? true;
            case 'text':
               return textFilterFn(String(value ?? ''), filter as FilterModel<'text'>) ?? true;
            case 'number':
               if (!Number.isFinite(value as number)) return false;
               return numberFilterFn(value as number, filter as FilterModel<'number'>) ?? true;
            case 'date':
               return dateFilterFn(value as Date, filter as FilterModel<'date'>) ?? true;
            default:
               return true;
         }
      })
   );
}

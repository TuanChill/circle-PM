import {
   Status,
   StatusCategory,
   StatusCheckIcon,
   StatusDuplicateIcon,
   StatusGearIcon,
   StatusPieIcon,
   StatusTriageIcon,
   StatusXIcon,
   displayOrderedStatus,
   status as defaultStatuses,
} from '@/lib/workflow-status';
import type { IssueStatusRecord } from '@/services/issue-statuses.service';

export function toWorkflowStatus(record: IssueStatusRecord): Status {
   const icon = () => {
      if (record.id === 'duplicate') return <StatusDuplicateIcon color={record.color} />;
      if (record.category === 'triage') return <StatusTriageIcon color={record.color} />;
      if (record.category === 'backlog') return <StatusGearIcon color={record.color} />;
      if (record.category === 'completed') return <StatusCheckIcon color={record.color} />;
      if (record.category === 'canceled') return <StatusXIcon color={record.color} />;
      return (
         <StatusPieIcon color={record.color} fraction={record.category === 'started' ? 0.35 : 0} />
      );
   };

   return {
      id: record.id,
      name: record.name,
      color: record.color,
      category: record.category as StatusCategory,
      icon,
   };
}

export function workflowStatuses(records?: IssueStatusRecord[]): Status[] {
   if (!records?.length) return defaultStatuses;
   return records.map(toWorkflowStatus);
}

export function mergeWorkflowStatuses(statuses: Status[]): Status[] {
   const merged = new Map(defaultStatuses.map((item) => [item.id, item]));
   statuses.forEach((item) => merged.set(item.id, item));
   return [...merged.values()].sort(
      (a, b) =>
         displayOrderedStatus.findIndex((item) => item.category === a.category) -
         displayOrderedStatus.findIndex((item) => item.category === b.category)
   );
}

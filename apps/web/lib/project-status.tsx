import React from 'react';
import { Ban, CheckCircle2, Circle, CircleDashed, CircleDot } from 'lucide-react';
import { projectStatus, Status } from './workflow-status';
import type { ProjectStatusRecord } from '@/services/project-statuses.service';

export type ProjectStatusView = Pick<Status, 'id' | 'name' | 'color' | 'category'> & {
   icon?: React.FC;
   description?: string;
   position?: number;
};

const categoryIcons = {
   backlog: CircleDashed,
   unstarted: Circle,
   started: CircleDot,
   completed: CheckCircle2,
   canceled: Ban,
} as const;

export function toProjectStatusView(status: ProjectStatusRecord): ProjectStatusView {
   return {
      id: status.id,
      name: status.name,
      color: status.color,
      category: status.category,
      description: status.description,
      position: status.position,
   };
}

export function getProjectStatusOptions(
   customStatuses: ProjectStatusRecord[] = []
): ProjectStatusView[] {
   return [
      ...projectStatus,
      ...customStatuses
         .slice()
         .sort((a, b) => a.category.localeCompare(b.category) || a.position - b.position)
         .map(toProjectStatusView),
   ];
}

export function renderProjectStatusIcon(status: ProjectStatusView): React.ReactElement {
   const builtin = projectStatus.find((item) => item.id === status.id);
   if (builtin) {
      const Icon = builtin.icon;
      return <Icon />;
   }
   const Icon = categoryIcons[status.category as keyof typeof categoryIcons] ?? Circle;
   return <Icon aria-hidden="true" className="size-3.5" style={{ color: status.color }} />;
}

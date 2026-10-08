import React from 'react';
import { Status, status as allStatus } from '@/lib/workflow-status';

export function renderStatusIcon(
   statusId: string,
   dynamicStatus?: Status
): React.ReactElement | null {
   const selectedItem =
      dynamicStatus?.id === statusId
         ? dynamicStatus
         : allStatus.find((item) => item.id === statusId);
   if (selectedItem) {
      const Icon = selectedItem.icon;
      return <Icon />;
   }
   return null;
}

export function getStatusById(statusId: string) {
   return allStatus.find((item) => item.id === statusId);
}

'use client';

import { Button } from '@/components/ui/button';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProjectStatusView } from '@/lib/project-status';
import { getProjectStatusOptions, renderProjectStatusIcon } from '@/lib/project-status';
import { useProjectStatuses } from '@/hooks/queries/use-project-statuses-query';
import { CheckIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

interface StatusWithPercentProps {
   status: ProjectStatusView;
   percentComplete: number;
   onStatusChange?: (statusId: string) => void;
}

export function StatusWithPercent({
   status,
   percentComplete,
   onStatusChange,
}: StatusWithPercentProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string>(status.id);
   const { data: customStatuses = [], isLoading } = useProjectStatuses();
   const allStatus = getProjectStatusOptions(customStatuses);
   const selectedItem = allStatus.find((item) => item.id === value) ?? status;

   useEffect(() => {
      setValue(status.id);
   }, [status.id]);

   const handleStatusChange = (statusId: string) => {
      setValue(statusId);
      setOpen(false);

      if (onStatusChange) {
         onStatusChange(statusId);
      }
   };

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               id={id}
               className="flex items-center justify-center gap-1.5"
               size="sm"
               variant="ghost"
               role="combobox"
               aria-expanded={open}
               disabled={isLoading}
            >
               {renderProjectStatusIcon(selectedItem)}
               <span className="text-xs font-medium mt-[1px]">{percentComplete}%</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent className="border-input w-48 p-0" align="start">
            <Command>
               <CommandInput placeholder="Set status..." />
               <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                     {allStatus.map((item) => {
                        return (
                           <CommandItem
                              key={item.id}
                              value={item.id}
                              onSelect={handleStatusChange}
                              className="flex items-center justify-between"
                           >
                              <div className="flex items-center gap-2">
                                 {renderProjectStatusIcon(item)}
                                 <span className="text-xs">{item.name}</span>
                              </div>
                              {value === item.id && <CheckIcon size={14} className="ml-auto" />}
                           </CommandItem>
                        );
                     })}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}

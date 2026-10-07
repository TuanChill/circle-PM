'use client';

import { CyclePlayIcon } from '@/components/common/cycles/cycle-line';
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
import { useCycles } from '@/hooks/queries/use-cycles-query';
import type { Cycle } from '@/services/cycles.service';
import { CheckIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

interface CycleSelectorProps {
   cycle: Cycle | undefined;
   teamId?: string;
   onOpenChange?: (open: boolean) => void;
   onInteractionStart?: () => void;
   onChange: (cycle: Cycle | undefined) => void;
}

/** Cycle picker for the issue creation form — same shape as ProjectSelector. */
export function CycleSelector({
   cycle,
   teamId,
   onOpenChange,
   onInteractionStart,
   onChange,
}: CycleSelectorProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string | undefined>(cycle?.id);
   const { data: cycles = [] } = useCycles(teamId);

   useEffect(() => {
      setValue(cycle?.id);
   }, [cycle]);

   const handleCycleChange = (cycleId: string) => {
      if (cycleId === 'no-cycle') {
         setValue(undefined);
         onChange(undefined);
      } else {
         setValue(cycleId);
         onChange(cycles.find((c) => c.id === cycleId));
      }
      setOpen(false);
   };

   const selectedCycle = cycles.find((c) => c.id === value);

   return (
      <Popover
         open={open}
         onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            onOpenChange?.(nextOpen);
         }}
      >
         <PopoverTrigger asChild>
            <Button
               id={id}
               size="xs"
               variant="secondary"
               role="combobox"
               aria-expanded={open}
               className="flex items-center justify-center"
            >
               <CyclePlayIcon className="size-4" />
               <span>{selectedCycle ? selectedCycle.name : 'No cycle'}</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent
            className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
            align="start"
            onPointerDownCapture={() => onInteractionStart?.()}
         >
            <Command>
               <CommandInput placeholder="Set cycle..." />
               <CommandList>
                  <CommandEmpty>No cycle found.</CommandEmpty>
                  <CommandGroup>
                     <CommandItem
                        value="no-cycle"
                        onSelect={() => handleCycleChange('no-cycle')}
                        className="flex items-center justify-between"
                     >
                        <span className="text-muted-foreground">No cycle</span>
                        {value === undefined && <CheckIcon size={16} className="ml-auto" />}
                     </CommandItem>
                     {cycles.map((c) => (
                        <CommandItem
                           key={c.id}
                           value={c.id}
                           onSelect={() => handleCycleChange(c.id)}
                           className="flex items-center justify-between"
                        >
                           <div className="flex items-center gap-2">
                              <CyclePlayIcon className="size-4" />
                              {c.name}
                           </div>
                           {value === c.id && <CheckIcon size={16} className="ml-auto" />}
                        </CommandItem>
                     ))}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}

'use client';

import { Button } from '@/components/ui/button';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckIcon, Gauge } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

type EstimateSettings = {
   enabled: boolean;
   scale: 'exponential' | 'fibonacci' | 'linear' | 't-shirt';
   extended: boolean;
   allowZero: boolean;
   unestimatedAsOne: boolean;
};

const BASE_VALUES: Record<EstimateSettings['scale'], number[]> = {
   'exponential': [1, 2, 4, 8, 16],
   'fibonacci': [1, 2, 3, 5, 8],
   'linear': [1, 2, 3, 4, 5],
   't-shirt': [1, 2, 3, 5, 8],
};

const EXTENDED_VALUES: Record<EstimateSettings['scale'], number[]> = {
   'exponential': [32, 64],
   'fibonacci': [13, 21],
   'linear': [6, 7],
   't-shirt': [13, 21],
};

function valuesFor(settings: EstimateSettings) {
   const values = [...BASE_VALUES[settings.scale]];
   if (settings.extended) values.push(...EXTENDED_VALUES[settings.scale]);
   if (settings.allowZero) values.unshift(0);
   return values;
}

function displayValue(value: number, settings: EstimateSettings) {
   if (settings.scale !== 't-shirt') return String(value);
   return (
      (
         { 1: 'XS', 2: 'S', 3: 'M', 5: 'L', 8: 'XL', 13: 'XXL', 21: 'XXXL' } as Record<
            number,
            string
         >
      )[value] ?? String(value)
   );
}

interface EstimateSelectorProps {
   estimate?: number | null;
   settings?: EstimateSettings;
   onOpenChange?: (open: boolean) => void;
   onInteractionStart?: () => void;
   onChange: (estimate: number | null) => void;
}

export function EstimateSelector({
   estimate,
   settings,
   onOpenChange,
   onInteractionStart,
   onChange,
}: EstimateSelectorProps) {
   const id = useId();
   const [open, setOpen] = useState(false);
   const currentSettings = settings ?? {
      enabled: false,
      scale: 'fibonacci' as const,
      extended: false,
      allowZero: false,
      unestimatedAsOne: true,
   };
   const [value, setValue] = useState<number | null>(estimate ?? null);

   useEffect(() => setValue(estimate ?? null), [estimate]);

   if (!currentSettings.enabled) return null;

   const handleChange = (next: number | null) => {
      setValue(next);
      setOpen(false);
      onChange(next);
   };

   return (
         <Popover
            modal
            open={open}
         onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            onOpenChange?.(nextOpen);
         }}
      >
         <PopoverTrigger asChild>
            <Button
               id={id}
               size="sm"
               variant="ghost"
               role="combobox"
               aria-expanded={open}
               className="h-6 px-1.5 gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
               <Gauge className="size-4" />
               {value === null ? 'No estimate' : displayValue(value, currentSettings)}
            </Button>
         </PopoverTrigger>
         <PopoverContent
            className="border-input w-44 p-0"
            align="start"
            onPointerDownCapture={
               onInteractionStart
                  ? () => onInteractionStart()
                  : undefined
            }
         >
            <Command>
               <CommandList>
                  <CommandEmpty>No estimates available.</CommandEmpty>
                  <CommandGroup>
                     <CommandItem value="no-estimate" onSelect={() => handleChange(null)}>
                        <span className="text-muted-foreground">No estimate</span>
                        {value === null && <CheckIcon size={16} className="ml-auto" />}
                     </CommandItem>
                     {valuesFor(currentSettings).map((option) => (
                        <CommandItem
                           key={option}
                           value={String(option)}
                           onSelect={() => handleChange(option)}
                        >
                           <span>{displayValue(option, currentSettings)}</span>
                           {value === option && <CheckIcon size={16} className="ml-auto" />}
                        </CommandItem>
                     ))}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}

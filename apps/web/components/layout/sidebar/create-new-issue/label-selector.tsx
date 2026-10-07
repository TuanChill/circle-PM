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
import { useIssuesStore } from '@/store/issues-store';
import { useCreateLabel, useLabels } from '@/hooks/queries/use-labels-query';
import type { LabelInterface } from '@/mock-data/labels';
import { CheckIcon, Loader2, Plus, TagIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface LabelSelectorProps {
   selectedLabels: LabelInterface[];
   onChange: (labels: LabelInterface[]) => void;
   onOpenChange?: (open: boolean) => void;
   /** Project labels do not show issue counts in Linear's project label menu. */
   showCounts?: boolean;
   /** Linear allows creating a project label directly from the label menu. */
   allowCreate?: boolean;
   scope?: 'issue' | 'project';
   teamId?: string;
}

export function LabelSelector({
   selectedLabels,
   onChange,
   onOpenChange,
   showCounts = true,
   allowCreate = false,
   scope = 'issue',
   teamId,
}: LabelSelectorProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [search, setSearch] = useState('');
   const [isCreating, setIsCreating] = useState(false);

   const { filterByLabel } = useIssuesStore();
   const { data: labels = [] } = useLabels(scope, teamId);
   const createLabelMutation = useCreateLabel();

   // Never fall back to mock IDs here: an empty API response is a valid
   // workspace state, and sending a mock label ID would fail server validation.
   const allLabels = labels;
   const normalizedSearch = search.trim().toLocaleLowerCase();
   const canCreate =
      allowCreate &&
      normalizedSearch.length > 0 &&
      !allLabels.some((label) => label.name.toLocaleLowerCase() === normalizedSearch);

   const handleLabelToggle = (label: LabelInterface) => {
      const isSelected = selectedLabels.some((l) => l.id === label.id);
      let newLabels: LabelInterface[];

      if (isSelected) {
         newLabels = selectedLabels.filter((l) => l.id !== label.id);
      } else {
         newLabels = [...selectedLabels, label];
      }

      onChange(newLabels);
      setOpen(false);
   };

   const handleCreateLabel = async () => {
      const name = search.trim();
      if (!name || isCreating) return;

      setIsCreating(true);
      try {
         const slug = name
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48);
         const created = await createLabelMutation.mutateAsync({
            id: `${slug || 'label'}-${crypto.randomUUID().slice(0, 8)}`,
            name,
            color: '#8b5cf6',
            scope,
            ...(teamId ? { teamId } : {}),
         });
         onChange([...selectedLabels, created]);
         setSearch('');
         setOpen(false);
      } finally {
         setIsCreating(false);
      }
   };

   return (
      <div className="*:not-first:mt-2">
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
                  className={cn(
                     'flex items-center justify-center',
                     selectedLabels.length === 0 && 'size-7'
                  )}
                  size={selectedLabels.length > 0 ? 'xs' : 'icon'}
                  variant="secondary"
                  role="combobox"
                  aria-expanded={open}
               >
                  <TagIcon className="size-4" />
                  {selectedLabels.length > 0 && (
                     <div className="flex -space-x-0.5">
                        {selectedLabels.map((label) => (
                           <div
                              key={label.id}
                              className={`size-3 rounded-full`}
                              style={{ backgroundColor: label.color }}
                           />
                        ))}
                     </div>
                  )}
               </Button>
            </PopoverTrigger>
            <PopoverContent
               className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
               align="start"
            >
               <Command>
                  <CommandInput
                     placeholder="Search labels..."
                     value={search}
                     onValueChange={setSearch}
                  />
                  <CommandList>
                     <CommandEmpty>
                        {canCreate ? 'Create a new label below.' : 'No labels found.'}
                     </CommandEmpty>
                     {canCreate && (
                        <CommandGroup>
                           <CommandItem
                              value={`create ${search}`}
                              onMouseDown={(event) => {
                                 if (event.button === 0) {
                                    event.preventDefault();
                                    void handleCreateLabel();
                                 }
                              }}
                              onKeyDown={(event) => {
                                 if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    void handleCreateLabel();
                                 }
                              }}
                              disabled={isCreating}
                              className="text-primary"
                           >
                              {isCreating ? (
                                 <Loader2 className="size-4 animate-spin" />
                              ) : (
                                 <Plus className="size-4" />
                              )}
                              Create “{search.trim()}”
                           </CommandItem>
                        </CommandGroup>
                     )}
                     <CommandGroup>
                        {allLabels.map((label) => {
                           const isSelected = selectedLabels.some((l) => l.id === label.id);
                           return (
                              <CommandItem
                                 key={label.id}
                                 value={`${label.name} ${label.id}`}
                                 onMouseDown={(event) => {
                                    if (event.button === 0) {
                                       event.preventDefault();
                                       handleLabelToggle(label);
                                    }
                                 }}
                                 onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                       event.preventDefault();
                                       handleLabelToggle(label);
                                    }
                                 }}
                                 className="flex items-center justify-between"
                              >
                                 <div className="flex items-center gap-2">
                                    <div
                                       className={`size-3 rounded-full`}
                                       style={{ backgroundColor: label.color }}
                                    />
                                    <span>{label.name}</span>
                                 </div>
                                 {isSelected && <CheckIcon size={16} className="ml-auto" />}
                                 {showCounts && (
                                    <span className="text-muted-foreground text-xs">
                                       {filterByLabel(label.id).length}
                                    </span>
                                 )}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}

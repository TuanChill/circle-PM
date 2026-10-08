'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { useFilterStore } from '@/store/filter-store';
import { issueFilterColumns } from './issue-filter-columns';
import { useParams } from 'next/navigation';
import { useIssueStatuses } from '@/hooks/queries/use-issue-statuses-query';
import { workflowStatuses } from '@/lib/issue-statuses';
import { priorities } from '@/lib/priority-catalog';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import {
   Calendar,
   CheckCircle2,
   ChevronLeft,
   ChevronRight,
   CircleDashed,
   CircleUserRound,
   Flag,
   ListFilter,
   Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import QueryErrorState from '@/components/common/query-error-state';

type FilterCategory = 'status' | 'assignee' | 'priority' | 'labels' | 'dates' | null;

export function IssueFilterPopover() {
   const [open, setOpen] = useState(false);
   const [activeCategory, setActiveCategory] = useState<FilterCategory>(null);
   const [search, setSearch] = useState('');
   const { filters, setFilters, getActiveFiltersCount } = useFilterStore();
   const usersQuery = useMembers();
   const labelsQuery = useLabels('issue');
   const { data: users = [] } = usersQuery;
   const { data: liveLabels = [] } = labelsQuery;
   const failedQuery = [usersQuery, labelsQuery].find((query) => query.isError);
   const activeCount = getActiveFiltersCount();
   const { teamId } = useParams<{ teamId?: string }>();
   const { data: statusRecords } = useIssueStatuses(teamId);
   const status = workflowStatuses(statusRecords);

   // Global shortcut 'F' to open filters
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         const target = e.target as HTMLElement;
         const isInput =
            target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
         if (isInput) return;

         if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            setOpen((prev) => !prev);
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);

   const addOrToggleFilter = (columnId: string, value: string) => {
      setFilters((prev) => {
         const existingIndex = prev.findIndex((f) => f.columnId === columnId);
         if (existingIndex >= 0) {
            const existing = prev[existingIndex];
            const currentValues = (existing.values as string[]) || [];
            const newValues = currentValues.includes(value)
               ? currentValues.filter((v) => v !== value)
               : [...currentValues, value];

            if (newValues.length === 0) {
               return prev.filter((_, i) => i !== existingIndex);
            }

            const updated = [...prev];
            updated[existingIndex] = {
               ...existing,
               values: newValues,
            };
            return updated;
         } else {
            const columnType =
               issueFilterColumns.find((column) => column.id === columnId)?.type ?? 'option';
            return [
               ...prev,
               {
                  columnId,
                  type: columnType,
                  operator: 'is',
                  values: [value],
               },
            ];
         }
      });
   };

   const isValueActive = (columnId: string, value: string) => {
      const f = filters.find((item) => item.columnId === columnId);
      return Boolean(f && Array.isArray(f.values) && f.values.includes(value));
   };

   return (
      <Popover
         open={open}
         onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
               setActiveCategory(null);
               setSearch('');
            }
         }}
      >
         <PopoverTrigger asChild>
            <Button
               variant={activeCount > 0 ? 'secondary' : 'ghost'}
               size="xs"
               className={cn(
                  'h-7 px-2 text-xs relative font-medium',
                  activeCount > 0 && 'bg-accent text-foreground'
               )}
            >
               <ListFilter className="size-3.5 mr-1 text-muted-foreground" />
               Filter
               {activeCount > 0 && (
                  <span className="ml-1.5 px-1 py-0.2 bg-foreground text-background text-[10px] rounded-full font-semibold">
                     {activeCount}
                  </span>
               )}
            </Button>
         </PopoverTrigger>

         <PopoverContent
            className="w-64 p-0 shadow-2xl rounded-xl border border-border/70 overflow-hidden"
            align="end"
         >
            <Command className="border-0">
               <div className="flex items-center px-3 border-b">
                  {activeCategory ? (
                     <button
                        onClick={() => setActiveCategory(null)}
                        className="mr-1.5 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                     >
                        <ChevronLeft className="size-4" />
                     </button>
                  ) : null}
                  <CommandInput
                     placeholder={activeCategory ? `Search ${activeCategory}...` : 'Add Filter...'}
                     value={search}
                     onValueChange={setSearch}
                     className="text-xs h-9"
                  />
                  {!activeCategory && (
                     <kbd className="text-[10px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40">
                        F
                     </kbd>
                  )}
               </div>

               <CommandList className="max-h-72 p-1 text-xs">
                  {failedQuery && (
                     <QueryErrorState
                        subject="issue filter options"
                        error={failedQuery.error}
                        compact
                        onRetry={() => void failedQuery.refetch()}
                     />
                  )}
                  <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                     No results found
                  </CommandEmpty>

                  {!activeCategory ? (
                     <CommandGroup>
                        <CommandItem
                           onSelect={() => setActiveCategory('status')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <CircleDashed className="size-3.5 text-muted-foreground" />
                              Status
                           </span>
                           <ChevronRight className="size-3.5 text-muted-foreground/60" />
                        </CommandItem>

                        <CommandItem
                           onSelect={() => setActiveCategory('assignee')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <CircleUserRound className="size-3.5 text-muted-foreground" />
                              Assignee
                           </span>
                           <ChevronRight className="size-3.5 text-muted-foreground/60" />
                        </CommandItem>

                        <CommandItem
                           onSelect={() => setActiveCategory('priority')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <Flag className="size-3.5 text-muted-foreground" />
                              Priority
                           </span>
                           <ChevronRight className="size-3.5 text-muted-foreground/60" />
                        </CommandItem>

                        <CommandItem
                           onSelect={() => setActiveCategory('labels')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <Tag className="size-3.5 text-muted-foreground" />
                              Labels
                           </span>
                           <ChevronRight className="size-3.5 text-muted-foreground/60" />
                        </CommandItem>

                        <CommandItem
                           onSelect={() => setActiveCategory('dates')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <Calendar className="size-3.5 text-muted-foreground" />
                              Dates
                           </span>
                           <ChevronRight className="size-3.5 text-muted-foreground/60" />
                        </CommandItem>
                     </CommandGroup>
                  ) : null}

                  {/* Sub-menu: Status */}
                  {activeCategory === 'status' && (
                     <CommandGroup heading="Status">
                        {status.map((item) => {
                           const active = isValueActive('status', item.id);
                           const Icon = item.icon;
                           return (
                              <CommandItem
                                 key={item.id}
                                 onSelect={() => addOrToggleFilter('status', item.id)}
                                 className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                              >
                                 <span className="flex items-center gap-2">
                                    <Icon />
                                    {item.name}
                                 </span>
                                 {active && <CheckCircle2 className="size-3.5 text-indigo-500" />}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  )}

                  {/* Sub-menu: Assignee */}
                  {activeCategory === 'assignee' && !usersQuery.isError && (
                     <CommandGroup heading="Assignee">
                        <CommandItem
                           onSelect={() => addOrToggleFilter('assignee', 'unassigned')}
                           className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                        >
                           <span className="flex items-center gap-2">
                              <CircleUserRound className="size-4 text-muted-foreground" />
                              Unassigned
                           </span>
                           {isValueActive('assignee', 'unassigned') && (
                              <CheckCircle2 className="size-3.5 text-indigo-500" />
                           )}
                        </CommandItem>
                        {users.map((user) => {
                           const active = isValueActive('assignee', user.id);
                           return (
                              <CommandItem
                                 key={user.id}
                                 onSelect={() => addOrToggleFilter('assignee', user.id)}
                                 className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                              >
                                 <span className="flex items-center gap-2">
                                    <Avatar className="size-4">
                                       <AvatarImage src={user.avatarUrl} alt={user.name} />
                                       <AvatarFallback>{user.name[0]}</AvatarFallback>
                                    </Avatar>
                                    {user.name}
                                 </span>
                                 {active && <CheckCircle2 className="size-3.5 text-indigo-500" />}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  )}

                  {/* Sub-menu: Priority */}
                  {activeCategory === 'priority' && (
                     <CommandGroup heading="Priority">
                        {priorities.map((item) => {
                           const active = isValueActive('priority', item.id);
                           const Icon = item.icon;
                           return (
                              <CommandItem
                                 key={item.id}
                                 onSelect={() => addOrToggleFilter('priority', item.id)}
                                 className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                              >
                                 <span className="flex items-center gap-2">
                                    <Icon />
                                    {item.name}
                                 </span>
                                 {active && <CheckCircle2 className="size-3.5 text-indigo-500" />}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  )}

                  {/* Sub-menu: Labels */}
                  {activeCategory === 'labels' && !labelsQuery.isError && (
                     <CommandGroup heading="Labels">
                        {liveLabels.map((item) => {
                           const active = isValueActive('labels', item.id);
                           return (
                              <CommandItem
                                 key={item.id}
                                 onSelect={() => addOrToggleFilter('labels', item.id)}
                                 className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                              >
                                 <span className="flex items-center gap-2">
                                    <span
                                       className="size-2 rounded-full"
                                       style={{ backgroundColor: item.color || '#888' }}
                                    />
                                    {item.name}
                                 </span>
                                 {active && <CheckCircle2 className="size-3.5 text-indigo-500" />}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  )}

                  {/* Sub-menu: Dates */}
                  {activeCategory === 'dates' && (
                     <CommandGroup heading="Due date">
                        {[
                           { id: 'overdue', label: 'Overdue' },
                           { id: 'today', label: 'Due today' },
                           { id: 'this-week', label: 'Due this week' },
                           { id: 'next-week', label: 'Due next week' },
                        ].map((d) => (
                           <CommandItem
                              key={d.id}
                              onSelect={() => addOrToggleFilter('dueDate', d.id)}
                              className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer"
                           >
                              <span className="flex items-center gap-2">
                                 <Calendar className="size-3.5 text-muted-foreground" />
                                 {d.label}
                              </span>
                              {isValueActive('dueDate', d.id) && (
                                 <CheckCircle2 className="size-3.5 text-indigo-500" />
                              )}
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  )}
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}

'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
   CompletedIssuesFilter,
   DISPLAY_PROPERTIES,
   GroupingKey,
   OrderingKey,
   useDisplaySettingsStore,
} from '@/store/display-settings-store';
import { useViewStore } from '@/store/view-store';
import {
   ArrowDownNarrowWide,
   ArrowUpNarrowWide,
   Columns3,
   LayoutGrid,
   LayoutList,
   SlidersHorizontal,
} from 'lucide-react';

const GROUPINGS: { value: GroupingKey; label: string }[] = [
   { value: 'status', label: 'Status' },
   { value: 'assignee', label: 'Assignee' },
   { value: 'priority', label: 'Priority' },
   { value: 'project', label: 'Project' },
   { value: 'none', label: 'No grouping' },
];

const BOARD_COLUMNS: { value: GroupingKey; label: string }[] = [
   { value: 'status', label: 'Status' },
   { value: 'assignee', label: 'Assignee' },
   { value: 'priority', label: 'Priority' },
];

const ORDERINGS: { value: OrderingKey; label: string }[] = [
   { value: 'priority', label: 'Priority' },
   { value: 'created', label: 'Created' },
   { value: 'title', label: 'Title' },
];

interface DisplayOptionsProps {
   onSave?: () => void;
   onCancel?: () => void;
   hasUnsavedChanges?: boolean;
}

/**
 * Linear-style "Display Options" popover:
 * Matches Linear 1:1 in both List mode and Board mode.
 */
export function DisplayOptions({ onSave, onCancel, hasUnsavedChanges }: DisplayOptionsProps) {
   const { viewType, setViewType } = useViewStore();
   const {
      grouping,
      ordering,
      sortDirection,
      orderCompletedByRecency,
      completedIssues,
      showSubIssues,
      nestedSubIssues,
      showEmptyGroups,
      showEmptyColumns,
      displayProperties,
      setGrouping,
      setOrdering,
      toggleSortDirection,
      setOrderCompletedByRecency,
      setCompletedIssues,
      setShowSubIssues,
      setNestedSubIssues,
      setShowEmptyGroups,
      setShowEmptyColumns,
      toggleDisplayProperty,
      resetDisplaySettings,
   } = useDisplaySettingsStore();

   const isDefault =
      grouping === 'status' &&
      ordering === 'priority' &&
      completedIssues === 'all' &&
      !showEmptyGroups;

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button className="relative h-7 px-2.5 text-xs" size="xs" variant="secondary">
               <SlidersHorizontal className="size-3.5 mr-1 text-muted-foreground" />
               Display
               {(!isDefault || viewType === 'grid' || hasUnsavedChanges) && (
                  <span className="absolute right-0 top-0 w-2 h-2 bg-indigo-500 rounded-full" />
               )}
            </Button>
         </PopoverTrigger>
         <PopoverContent
            className="w-84 p-0 shadow-2xl rounded-xl border border-border/70"
            align="end"
         >
            {/* Top header if save / cancel is provided */}
            {(onSave || onCancel) && (
               <div className="flex items-center justify-end gap-2 px-3 py-2 border-b bg-muted/20">
                  {onCancel && (
                     <button
                        onClick={onCancel}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-0.5"
                     >
                        Cancel
                     </button>
                  )}
                  {onSave && (
                     <button
                        onClick={onSave}
                        className="text-xs bg-foreground text-background font-medium px-2.5 py-1 rounded hover:opacity-90 transition-opacity"
                     >
                        Save
                     </button>
                  )}
               </div>
            )}

            {/* List / Board switch with tooltip */}
            <div className="p-3">
               <Tooltip>
                  <TooltipTrigger asChild>
                     <div className="grid grid-cols-2 gap-1 bg-accent/50 rounded-lg p-1">
                        <button
                           onClick={() => setViewType('list')}
                           className={cn(
                              'flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors',
                              viewType === 'list'
                                 ? 'bg-background shadow-xs text-foreground font-semibold'
                                 : 'text-muted-foreground hover:text-foreground'
                           )}
                        >
                           <LayoutList className="size-3.5" />
                           List
                        </button>
                        <button
                           onClick={() => setViewType('grid')}
                           className={cn(
                              'flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors',
                              viewType === 'grid'
                                 ? 'bg-background shadow-xs text-foreground font-semibold'
                                 : 'text-muted-foreground hover:text-foreground'
                           )}
                        >
                           <LayoutGrid className="size-3.5" />
                           Board
                        </button>
                     </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                     Toggle layout view
                  </TooltipContent>
               </Tooltip>
            </div>

            {/* Grouping / Columns & Ordering */}
            <div className="px-3 pb-3 flex flex-col gap-2.5">
               {viewType === 'list' ? (
                  <>
                     <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                           Grouping
                        </span>
                        <Select
                           value={grouping}
                           onValueChange={(v) => setGrouping(v as GroupingKey)}
                        >
                           <SelectTrigger className="h-7 w-36 text-xs bg-background/50">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {GROUPINGS.map((option) => (
                                 <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    className="text-xs"
                                 >
                                    {option.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground pl-0.5">Sub-grouping</span>
                        <Select value="none" disabled>
                           <SelectTrigger className="h-7 w-36 text-xs opacity-60">
                              <SelectValue placeholder="No grouping" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="none" className="text-xs">
                                 No grouping
                              </SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </>
               ) : (
                  <>
                     <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                           <Columns3 className="size-3.5" />
                           Columns
                        </span>
                        <Select
                           value={grouping}
                           onValueChange={(v) => setGrouping(v as GroupingKey)}
                        >
                           <SelectTrigger className="h-7 w-36 text-xs bg-background/50">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {BOARD_COLUMNS.map((option) => (
                                 <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    className="text-xs"
                                 >
                                    {option.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground pl-0.5">Rows</span>
                        <Select value="none" disabled>
                           <SelectTrigger className="h-7 w-36 text-xs opacity-60">
                              <SelectValue placeholder="No grouping" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="none" className="text-xs">
                                 No grouping
                              </SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </>
               )}

               {/* Ordering with asc/desc toggle */}
               <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     Ordering
                  </span>
                  <div className="flex items-center gap-1">
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSortDirection}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                     >
                        {sortDirection === 'asc' ? (
                           <ArrowUpNarrowWide className="size-3.5" />
                        ) : (
                           <ArrowDownNarrowWide className="size-3.5" />
                        )}
                     </Button>
                     <Select value={ordering} onValueChange={(v) => setOrdering(v as OrderingKey)}>
                        <SelectTrigger className="h-7 w-32 text-xs bg-background/50">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {ORDERINGS.map((option) => (
                              <SelectItem
                                 key={option.value}
                                 value={option.value}
                                 className="text-xs"
                              >
                                 {option.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="flex items-center justify-between">
                  <Label
                     htmlFor="order-completed-recency"
                     className="text-xs text-muted-foreground font-normal cursor-pointer"
                  >
                     Order completed by recency
                  </Label>
                  <Switch
                     id="order-completed-recency"
                     checked={orderCompletedByRecency}
                     onCheckedChange={setOrderCompletedByRecency}
                  />
               </div>
            </div>

            <div className="border-t px-3 py-3 flex flex-col gap-2.5">
               <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Completed issues</span>
                  <Select
                     value={completedIssues}
                     onValueChange={(v) => setCompletedIssues(v as CompletedIssuesFilter)}
                  >
                     <SelectTrigger className="h-7 w-36 text-xs bg-background/50">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all" className="text-xs">
                           All
                        </SelectItem>
                        <SelectItem value="none" className="text-xs">
                           None
                        </SelectItem>
                     </SelectContent>
                  </Select>
               </div>

               <div className="flex items-center justify-between">
                  <Label
                     htmlFor="show-sub-issues"
                     className="text-xs text-muted-foreground font-normal cursor-pointer"
                  >
                     Show sub-issues
                  </Label>
                  <Switch
                     id="show-sub-issues"
                     checked={showSubIssues}
                     onCheckedChange={setShowSubIssues}
                  />
               </div>
            </div>

            {/* List / Board specific options */}
            <div className="border-t px-3 py-3 flex flex-col gap-2.5">
               <span className="text-xs font-medium text-foreground">
                  {viewType === 'list' ? 'List options' : 'Board options'}
               </span>

               {viewType === 'list' ? (
                  <>
                     <div className="flex items-center justify-between">
                        <Label
                           htmlFor="nested-sub-issues"
                           className="text-xs text-muted-foreground font-normal cursor-pointer"
                        >
                           Nested sub-issues
                        </Label>
                        <Switch
                           id="nested-sub-issues"
                           checked={nestedSubIssues}
                           onCheckedChange={setNestedSubIssues}
                        />
                     </div>
                     <div className="flex items-center justify-between">
                        <Label
                           htmlFor="show-empty-groups"
                           className="text-xs text-muted-foreground font-normal cursor-pointer"
                        >
                           Show empty groups
                        </Label>
                        <Switch
                           id="show-empty-groups"
                           checked={showEmptyGroups}
                           onCheckedChange={setShowEmptyGroups}
                        />
                     </div>
                  </>
               ) : (
                  <div className="flex items-center justify-between">
                     <Label
                        htmlFor="show-empty-columns"
                        className="text-xs text-muted-foreground font-normal cursor-pointer"
                     >
                        Show empty columns
                     </Label>
                     <Switch
                        id="show-empty-columns"
                        checked={showEmptyColumns}
                        onCheckedChange={setShowEmptyColumns}
                     />
                  </div>
               )}

               <span className="text-xs text-muted-foreground mt-1 font-medium">
                  Display properties
               </span>
               <div className="flex flex-wrap gap-1.5">
                  {DISPLAY_PROPERTIES.map((property) => (
                     <button
                        key={property.key}
                        onClick={() => toggleDisplayProperty(property.key)}
                        className={cn(
                           'px-2 py-0.5 rounded text-xs border transition-colors cursor-pointer',
                           displayProperties[property.key]
                              ? 'bg-accent/80 border-border text-foreground font-medium'
                              : 'border-transparent bg-muted/40 text-muted-foreground/80 hover:text-foreground'
                        )}
                     >
                        {property.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="border-t px-3 py-2.5 flex items-center justify-between bg-muted/10">
               <button
                  onClick={resetDisplaySettings}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
               >
                  Reset
               </button>
               <button
                  onClick={() => resetDisplaySettings()}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
               >
                  Set default for everyone
               </button>
            </div>
         </PopoverContent>
      </Popover>
   );
}

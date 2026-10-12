'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useCreateIssueStore, CreateIssueOptions } from '@/store/create-issue-store';
import { useFilterStore } from '@/store/filter-store';
import { Check, FilterX } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyIssuesStateProps {
   title?: string;
   subtitle?: string;
   description?: string;
   actionLabel?: string;
   contextOptions?: CreateIssueOptions;
   hasActiveFilters?: boolean;
   className?: string;
}

/** 4 Linear status icons in a 2x2 grid */
export function LinearStatusIconsGrid({ className }: { className?: string }) {
   return (
      <div className={cn('grid grid-cols-2 gap-2.5 w-fit', className)}>
         {/* 1. Backlog (Dotted circle) */}
         <div className="size-8 rounded-full border border-dashed border-muted-foreground/60 flex items-center justify-center bg-muted/10 transition-transform hover:scale-105">
            <span className="size-2 rounded-full border border-dashed border-muted-foreground/80" />
         </div>

         {/* 2. Todo (Outline circle) */}
         <div className="size-8 rounded-full border-2 border-muted-foreground/70 flex items-center justify-center bg-muted/10 transition-transform hover:scale-105">
            <span className="size-1.5 rounded-full bg-muted-foreground/30" />
         </div>

         {/* 3. In Progress (Half-filled circle) */}
         <div className="size-8 rounded-full border-2 border-amber-500/80 overflow-hidden relative flex items-center justify-center bg-muted/10 transition-transform hover:scale-105">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-amber-500" />
         </div>

         {/* 4. Done (Checkmark circle) */}
         <div className="size-8 rounded-full bg-[#5E6AD2]/20 border-2 border-[#5E6AD2] flex items-center justify-center transition-transform hover:scale-105">
            <Check className="size-4 text-[#5E6AD2] stroke-[2.5]" />
         </div>
      </div>
   );
}

export function EmptyIssuesState({
   title = 'Add issues to the project',
   subtitle = 'Start building your project by creating an issue.',
   description = 'You can also add teams, team members, and project dates in the project sidebar.',
   actionLabel = 'Create new issue',
   contextOptions,
   hasActiveFilters = false,
   className,
}: EmptyIssuesStateProps) {
   const { openModal } = useCreateIssueStore();
   const { clearFilters } = useFilterStore();

   if (hasActiveFilters) {
      return (
         <div
            className={cn(
               'flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto my-auto animate-in fade-in-50 duration-200',
               className
            )}
         >
            <div className="size-10 rounded-full bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
               <FilterX className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
               No issues match the active filters
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
               Try clearing filters or creating a new issue matching this scope.
            </p>
            <div className="flex items-center gap-2 mt-5">
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs font-medium border-border/80"
               >
                  Clear filters
               </Button>
               <Button
                  type="button"
                  size="sm"
                  onClick={() => openModal(contextOptions)}
                  className="h-8 text-xs font-medium bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white gap-2 shadow-sm"
               >
                  <span>{actionLabel}</span>
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div
         className={cn(
            'flex flex-col items-center sm:items-start text-center sm:text-left p-8 sm:p-12 max-w-lg my-auto animate-in fade-in-50 duration-200',
            className
         )}
      >
         {/* 2x2 Status Icons */}
         <LinearStatusIconsGrid className="mb-6" />

         {/* Title & Subtitle */}
         <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
         <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>

         {/* Additional Guidance Note */}
         {description && (
            <p className="text-xs text-muted-foreground/80 mt-3 leading-relaxed max-w-sm">
               {description}
            </p>
         )}

         <div className="mt-6">
            <Button
               type="button"
               size="sm"
               onClick={() => openModal(contextOptions)}
               className="h-8 text-xs font-medium bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white px-3.5 rounded-md flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
               <span>{actionLabel}</span>
            </Button>
         </div>
      </div>
   );
}

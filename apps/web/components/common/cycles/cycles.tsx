'use client';

import { useCycles } from '@/hooks/queries/use-cycles-query';
import { format, parseISO } from 'date-fns';
import { Fragment } from 'react';
import CycleLine from './cycle-line';
import { CycleBurnupChart, CycleProgressLegend } from './cycle-burnup-chart';
import { Skeleton } from '@/components/ui/skeleton';
import QueryErrorState from '@/components/common/query-error-state';

/**
 * Cycles timeline: a date rail on the left and one row per cycle,
 * newest first. The current cycle is expanded with its burn-up chart.
 */
export default function Cycles({ teamId }: { teamId?: string }) {
   const { data: cycles = [], isLoading, isError, error, refetch } = useCycles(teamId);

   if (isLoading) {
      return (
         <div className="w-full p-6 space-y-4">
            {[1, 2, 3].map((i) => (
               <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border/40"
               >
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                     <Skeleton className="h-4 w-1/3" />
                     <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
               </div>
            ))}
         </div>
      );
   }

   if (isError) {
      return <QueryErrorState subject="cycles" error={error} onRetry={refetch} />;
   }

   if (cycles.length === 0) {
      return (
         <div className="w-full flex items-center justify-center p-12 text-sm text-muted-foreground">
            No cycles yet. Enable Cycles in team settings to generate a recurring schedule.
         </div>
      );
   }

   const nextUpcomingCycle = cycles
      .filter((cycle) => cycle.status === 'upcoming' || cycle.status === 'planned')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

   return (
      <div className="w-full py-4">
         {cycles.map((cycle) => (
            <Fragment key={cycle.id}>
               <div className="w-full flex items-stretch">
                  {/* Date rail */}
                  <div className="relative w-14 sm:w-20 shrink-0 flex flex-col items-end pr-4">
                     {/* Vertical rail, centered on the dots (pr-4 = 16px + half dot 5px - half line) */}
                     <div className="absolute right-[20.5px] top-0 bottom-0 w-px bg-border" />
                     <div className="flex items-center gap-2 h-12">
                        <span className="text-[11px] leading-tight text-muted-foreground text-right">
                           {format(parseISO(cycle.startDate), 'MMM')}
                           <br />
                           {format(parseISO(cycle.startDate), 'd')}
                        </span>
                        <span
                           className={
                              'relative z-10 size-2.5 rounded-full border-2 bg-background ' +
                              (cycle.status === 'current'
                                 ? 'border-indigo-400 bg-indigo-400'
                                 : 'border-muted-foreground/40')
                           }
                        />
                     </div>
                  </div>

                  {/* Cycle row + expanded chart for the current cycle */}
                  <div className="flex-1 min-w-0 border-b border-border/60">
                     <CycleLine cycle={cycle} canStartToday={cycle.id === nextUpcomingCycle?.id} />

                     {cycle.status === 'current' && (
                        <div className="flex flex-col lg:flex-row items-stretch gap-8 px-6 pb-6 pt-2">
                           <div className="flex-1 min-w-0">
                              <CycleBurnupChart cycle={cycle} height={220} />
                           </div>
                           <div className="lg:w-64 shrink-0 flex items-center">
                              <CycleProgressLegend cycle={cycle} />
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </Fragment>
         ))}
      </div>
   );
}

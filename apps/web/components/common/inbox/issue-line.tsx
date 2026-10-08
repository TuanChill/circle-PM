'use client';

import type { InboxItem } from '@/mock-data/inbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { renderStatusIcon } from '@/lib/status-utils';
import { getNotificationIcon } from '@/lib/notification-utils';
import { Button } from '@/components/ui/button';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Clock3, MoreHorizontal } from 'lucide-react';

interface IssueLineProps {
   notification: InboxItem;
   layoutId?: boolean;
   isSelected?: boolean;
   onClick?: () => void;
   showId?: boolean;
   showStatusIcon?: boolean;
   onSnooze?: (until: string | null) => void;
}

function tomorrowAtNine() {
   const date = new Date();
   date.setDate(date.getDate() + 1);
   date.setHours(9, 0, 0, 0);
   return date.toISOString();
}

export default function IssueLine({
   notification,
   layoutId = false,
   isSelected = false,
   onClick,
   showId = true,
   showStatusIcon = true,
   onSnooze,
}: IssueLineProps) {
   const actor = notification.user;

   return (
      <motion.div
         {...(layoutId && { layoutId: `notification-line-${notification.id}` })}
         onClick={onClick}
         className="w-full px-0.75 py-0.25"
      >
         <div
            className={cn(
               'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sidebar/80 dark:hover:bg-sidebar/50 transition-colors cursor-pointer rounded-lg',
               isSelected && 'bg-accent/80 dark:bg-accent/50'
            )}
         >
            <div className="relative flex-shrink-0">
               {actor ? (
                  <Avatar className="size-8">
                     <AvatarImage src={actor.avatarUrl} alt={actor.name} />
                     <AvatarFallback className="text-xs">
                        {actor.name
                           .split(' ')
                           .map((n) => n[0])
                           .join('')}
                     </AvatarFallback>
                  </Avatar>
               ) : (
                  <Avatar className="size-8">
                     <AvatarFallback className="text-xs">?</AvatarFallback>
                  </Avatar>
               )}

               <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-accent border-2 border-background flex items-center justify-center">
                  {getNotificationIcon(notification.type, 'size-3')}
               </div>
            </div>

            <div className="w-full">
               <div className="flex items-center gap-1.5">
                  {!notification.read && (
                     <div className="size-2 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                  {showId && (
                     <span
                        className={cn(
                           'text-sm font-medium text-muted-foreground shrink-0',
                           notification.read && 'opacity-50'
                        )}
                     >
                        {notification.identifier}
                     </span>
                  )}

                  <h4
                     className={cn(
                        'text-sm font-medium text-foreground line-clamp-1 flex-grow',
                        notification.read && 'opacity-50'
                     )}
                  >
                     {notification.title}
                  </h4>

                  {showStatusIcon && (
                     <div className="shrink-0">
                        {renderStatusIcon(notification.status.id, notification.status)}
                     </div>
                  )}
                  {onSnooze && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Notification actions"
                              onClick={(event) => event.stopPropagation()}
                           >
                              <MoreHorizontal className="size-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                           align="end"
                           onClick={(event) => event.stopPropagation()}
                        >
                           {notification.snoozedUntil ? (
                              <DropdownMenuItem onClick={() => onSnooze(null)}>
                                 <Clock3 className="size-4 mr-2" />
                                 Unsnooze
                              </DropdownMenuItem>
                           ) : (
                              <>
                                 <DropdownMenuItem
                                    onClick={() =>
                                       onSnooze(new Date(Date.now() + 60 * 60 * 1000).toISOString())
                                    }
                                 >
                                    <Clock3 className="size-4 mr-2" />
                                    Snooze for 1 hour
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => onSnooze(tomorrowAtNine())}>
                                    <Clock3 className="size-4 mr-2" />
                                    Snooze until tomorrow
                                 </DropdownMenuItem>
                              </>
                           )}
                        </DropdownMenuContent>
                     </DropdownMenu>
                  )}
               </div>

               <div
                  className={cn(
                     'flex items-center justify-between gap-1.5 transition-opacity duration-200',
                     notification.read && 'opacity-50'
                  )}
               >
                  <p className="text-sm text-muted-foreground line-clamp-1">
                     {notification.content}
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">
                     {notification.timestamp}
                  </span>
               </div>
            </div>
         </div>
      </motion.div>
   );
}

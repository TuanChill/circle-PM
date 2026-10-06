'use client';

import { LinearEditor } from '@/components/common/editor/linear-editor';
import { contentBlocksToMarkdown } from '@/lib/content-blocks-to-markdown';
import { ActivityFeed } from '@/components/common/issues/details/activity-feed';
import { IssuePropertiesPanel } from '@/components/common/issues/details/issue-properties-panel';
import { LabelBadge } from '@/components/common/issues/label-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getNotificationIcon } from '@/lib/notification-utils';
import { renderStatusIcon } from '@/lib/status-utils';
import { renderPriorityIcon } from '@/lib/priority-utils';
import type { InboxItem } from '@/mock-data/inbox';
import { useIssueDetail, useIssues } from '@/hooks/queries/use-issues-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import { useNotificationsStore } from '@/store/notifications-store';
import { ArrowUpRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { NotificationBox } from './icons/motification-box';
import QueryErrorState from '@/components/common/query-error-state';

interface IssuePreviewProps {
   notification?: InboxItem;
   onMarkAsRead?: (id: string) => void;
}

/**
 * Inbox preview pane: shows the REAL issue behind the selected
 * notification (live status/assignee from the store, rich description
 * from issue-details) plus the notification context.
 */
export default function IssuePreview({ notification, onMarkAsRead }: IssuePreviewProps) {
   const { orgId } = useParams<{ orgId: string }>();
   const { getUnreadCount } = useNotificationsStore();
   const { data: issues = [] } = useIssues();
   const notificationIdentifier = notification?.identifier ?? '';
   const {
      data: detail,
      isError: isDetailError,
      error: detailError,
   } = useIssueDetail(notificationIdentifier, Boolean(notificationIdentifier));
   const { data: members = [] } = useMembers();

   if (!notification) {
      const unreadCount = getUnreadCount();

      return (
         <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <NotificationBox className="w-16 h-16 mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
               {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
               Select a notification from the list to view its details and take action.
            </p>
         </div>
      );
   }

   // Live issue from the store (falls back to the notification snapshot).
   const issue = issues.find((candidate) => candidate.identifier === notification.identifier);
   const displayIssue = issue ?? notification;
   const actor = notification.user;

   return (
      <div className="flex flex-col h-full overflow-hidden">
         {/* Header */}
         <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
               {renderStatusIcon(displayIssue.status?.id)}
               <span className="text-sm font-medium truncate">{displayIssue.identifier}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
               {!notification.read && onMarkAsRead && (
                  <Button
                     variant="outline"
                     size="xs"
                     onClick={() => onMarkAsRead(notification.id)}
                     className="gap-1"
                  >
                     <Check className="size-4" />
                     Mark as read
                  </Button>
               )}
               <Button variant="ghost" size="xs" asChild>
                  <Link href={`/${orgId ?? ''}/issue/${displayIssue.identifier}`}>
                     Open
                     <ArrowUpRight className="size-3.5 ml-0.5" />
                  </Link>
               </Button>
            </div>
         </div>

         {/* Real issue preview + properties column (Linear-style) */}
         <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto">
               <div className="pt-8 pb-6 px-6 w-full max-w-3xl mx-auto">
                  {/* Notification context */}
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg mb-8">
                     <div className="relative shrink-0">
                        {actor ? (
                           <Avatar className="size-7">
                              <AvatarImage src={actor.avatarUrl} alt={actor.name} />
                              <AvatarFallback className="text-xs">{actor.name[0]}</AvatarFallback>
                           </Avatar>
                        ) : (
                           <Avatar className="size-7">
                              <AvatarFallback className="text-xs">?</AvatarFallback>
                           </Avatar>
                        )}
                        <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-accent border border-background flex items-center justify-center">
                           {getNotificationIcon(notification.type, 'size-2.5')}
                        </div>
                     </div>
                     <div className="min-w-0 text-sm">
                        <span className="font-medium">{actor?.name ?? 'Unknown member'}</span>{' '}
                        <span className="text-muted-foreground">· {notification.timestamp}</span>
                        <p className="text-foreground/90 mt-0.5">{notification.content}</p>
                     </div>
                  </div>

                  <h3 className="text-2xl font-semibold text-foreground text-balance">
                     {displayIssue.title}
                  </h3>

                  {/* Properties row */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 text-sm xl:hidden">
                     <span className="flex items-center gap-1.5">
                        {renderStatusIcon(displayIssue.status?.id)}
                        {displayIssue.status?.name}
                     </span>
                     <span className="flex items-center gap-1.5 text-muted-foreground">
                        {renderPriorityIcon(displayIssue.priority?.id, 'size-3.5')}
                        {displayIssue.priority?.name}
                     </span>
                     {displayIssue.assignee && (
                        <span className="flex items-center gap-1.5">
                           <Avatar className="size-4">
                              <AvatarImage
                                 src={displayIssue.assignee.avatarUrl}
                                 alt={displayIssue.assignee.name}
                              />
                              <AvatarFallback className="text-[9px]">
                                 {displayIssue.assignee.name[0]}
                              </AvatarFallback>
                           </Avatar>
                           {displayIssue.assignee.name}
                        </span>
                     )}
                     <LabelBadge label={displayIssue.labels} />
                  </div>

                  {/* Real description */}
                  <div className="mt-6">
                     <LinearEditor
                        value={
                           displayIssue.description && displayIssue.description.trim()
                              ? displayIssue.description
                              : detail?.description
                                ? contentBlocksToMarkdown(detail.description)
                                : ''
                        }
                        editable={false}
                        className="px-0 py-0"
                     />
                  </div>

                  {isDetailError ? (
                     <QueryErrorState subject="issue activity" error={detailError} />
                  ) : (
                     <ActivityFeed
                        activity={detail?.activity ?? []}
                        comments={detail?.comments ?? []}
                        issueIdentifier={displayIssue.identifier}
                        members={members}
                     />
                  )}
               </div>
            </div>

            {issue && detail && (
               <aside className="hidden xl:block w-64 shrink-0 border-l overflow-y-auto bg-container px-4 py-5">
                  <IssuePropertiesPanel issue={issue} detail={detail} />
               </aside>
            )}
         </div>
      </div>
   );
}

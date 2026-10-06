'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import type { IssueActivityEvent, IssueComment } from '@/mock-data/issue-details';
import type { Member } from '@/services/members.service';
import { useAuthStore } from '@/store/auth-store';
import { addIssueComment, addIssueReaction, removeIssueReaction } from '@/lib/api/issues';
import { toast } from 'sonner';
import {
   Ban,
   CircleDot,
   ChevronDown,
   ExternalLink,
   FileText,
   Loader2,
   GitPullRequestArrow,
   Link2,
   PenLine,
   Paperclip,
   RefreshCw,
   RefreshCcw,
   SmilePlus,
   Tag,
   Unlock,
   X,
} from 'lucide-react';
import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ContentBlocks } from './content-blocks';
import {
   MAX_ATTACHMENT_SIZE,
   uploadsService,
   validateAttachment,
} from '@/services/uploads.service';

type DraftAttachment = {
   localId: string;
   file: File;
   status: 'uploading' | 'ready' | 'failed';
   id?: string;
   error?: string;
};

const MAX_COMMENT_ATTACHMENTS = 10;

function formatFileSize(bytes: number) {
   if (bytes < 1024) return `${bytes} B`;
   if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EVENT_ICONS: Record<string, ReactNode> = {
   created: <PenLine className="size-3.5" />,
   status: <CircleDot className="size-3.5" />,
   label: <Tag className="size-3.5" />,
   priority: <CircleDot className="size-3.5" />,
   cycle: <RefreshCcw className="size-3.5" />,
   blocked: <Ban className="size-3.5" />,
   unblocked: <Unlock className="size-3.5" />,
   related: <Link2 className="size-3.5" />,
   pr: <GitPullRequestArrow className="size-3.5" />,
};

function EventRow({ item }: { item: IssueActivityEvent }) {
   return (
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-1.5">
         <span className="size-5 rounded-full bg-accent flex items-center justify-center shrink-0">
            {EVENT_ICONS[item.event] ?? <CircleDot className="size-3.5" />}
         </span>
         <span className="min-w-0 truncate">
            <span className="text-foreground/90 font-medium">
               {item.actor?.name || 'Unknown member'}
            </span>{' '}
            {item.text}
         </span>
         <span className="shrink-0 text-xs">· {item.timeAgo}</span>
      </div>
   );
}

function CommentCard({
   item,
   onReact,
   onDownload,
   downloadingId,
   members,
}: {
   item: IssueComment;
   onReact?: (commentId: string, emoji: string) => void;
   onDownload?: (attachmentId: string) => void;
   downloadingId?: string | null;
   members?: Map<string, { name: string }>;
}) {
   return (
      <div className="my-2 rounded-lg border border-border/60 bg-container p-3.5">
         <div className="flex items-center gap-2 mb-1.5">
            <Avatar className="size-5">
               <AvatarImage src={item.actor?.avatarUrl} alt={item.actor?.name} />
               <AvatarFallback>{item.actor?.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{item.actor?.name || 'Unknown member'}</span>
            <span className="text-xs text-muted-foreground">{item.timeAgo}</span>
         </div>
         <div className="text-sm [&_p]:my-1.5">
            <ContentBlocks blocks={item.body} members={members} />
         </div>
         {(item.attachments?.length ?? 0) > 0 && (
            <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border/70">
               {item.attachments?.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2 px-2.5 py-2">
                     <FileText className="size-4 shrink-0 text-muted-foreground" />
                     <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                           {attachment.fileName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                           {formatFileSize(attachment.fileSize)}
                        </span>
                     </div>
                     <button
                        type="button"
                        onClick={() => onDownload?.(attachment.id)}
                        disabled={downloadingId === attachment.id}
                        aria-label={`Download ${attachment.fileName}`}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
                     >
                        {downloadingId === attachment.id ? (
                           <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                           <ExternalLink className="size-3.5" />
                        )}
                     </button>
                  </li>
               ))}
            </ul>
         )}
         <div className="flex items-center gap-1.5 mt-1">
            {item.reactions?.map((reaction) => (
               <button
                  key={reaction.emoji}
                  onClick={() => onReact?.(item.id, reaction.emoji)}
                  className="inline-flex items-center gap-1 text-xs bg-accent/60 hover:bg-accent border border-border/60 rounded-full px-2 py-0.5 transition-colors cursor-pointer"
               >
                  {reaction.emoji} {reaction.count}
               </button>
            ))}
            <button
               onClick={() => onReact?.(item.id, '👍')}
               className="text-muted-foreground hover:text-foreground p-1 transition-colors"
               title="Add thumbs up"
            >
               <SmilePlus className="size-3.5" />
            </button>
         </div>
      </div>
   );
}

export function ActivityFeed({
   activity,
   comments,
   issueIdentifier,
   members = [],
   isSubscribed = false,
   isSubscriptionPending = false,
   onToggleSubscription,
}: {
   activity: IssueActivityEvent[];
   comments: IssueComment[];
   issueIdentifier?: string;
   members?: Member[];
   isSubscribed?: boolean;
   isSubscriptionPending?: boolean;
   onToggleSubscription?: () => void;
}) {
   const [items, setItems] = useState<IssueComment[]>(comments);
   const [isActivityExpanded, setIsActivityExpanded] = useState(false);
   const [draft, setDraft] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [submitError, setSubmitError] = useState<string | null>(null);
   const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
   const [attachmentError, setAttachmentError] = useState<string | null>(null);
   const [downloadingId, setDownloadingId] = useState<string | null>(null);
   const activityTimelineId = useId();
   const commentsTitleId = useId();
   const attachmentInputRef = useRef<HTMLInputElement>(null);
   const skipNextActivitySyncRef = useRef(false);
   const { user } = useAuthStore();
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   // Active `@` mention query, if the caret is right after an in-progress `@token`.
   const [mentionQuery, setMentionQuery] = useState<string | null>(null);
   const [mentionStart, setMentionStart] = useState(-1);

   useEffect(() => {
      setIsActivityExpanded(false);
   }, [issueIdentifier]);

   const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

   const mentionMatches = useMemo(() => {
      if (mentionQuery === null) return [];
      const q = mentionQuery.toLowerCase();
      return members
         .filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
         .slice(0, 6);
   }, [mentionQuery, members]);

   useEffect(() => {
      if (!comments || isSubmitting) return;

      if (skipNextActivitySyncRef.current) {
         skipNextActivitySyncRef.current = false;
         return;
      }

      // Activity is refetched after issue mutations. Do not replace the local
      // feed while the composer is focused or contains unsent text: that
      // update can reset the subtree and make typing lose its caret.
      const composerIsActive = Boolean(draft) || textareaRef.current === document.activeElement;
      if (composerIsActive) return;
      setItems(comments);
   }, [comments, draft, isSubmitting]);

   const orderedActivity = useMemo(
      () =>
         activity
            .map((item, index) => ({ item, index, timestamp: Date.parse(item.createdAt ?? '') }))
            .sort((left, right) => {
               if (Number.isFinite(left.timestamp) && Number.isFinite(right.timestamp)) {
                  return left.timestamp - right.timestamp;
               }
               return left.index - right.index;
            })
            .map(({ item }) => item),
      [activity]
   );

   const handleDraftChange = (value: string, cursorPos: number) => {
      setDraft(value);
      const uptoCursor = value.slice(0, cursorPos);
      const match = uptoCursor.match(/(?:^|\s)@([a-z0-9_.-]*)$/i);
      if (match) {
         setMentionQuery(match[1]);
         setMentionStart(cursorPos - match[1].length - 1);
      } else {
         setMentionQuery(null);
         setMentionStart(-1);
      }
   };

   const uploadDraftFile = async (localId: string, file: File) => {
      setDraftAttachments((current) =>
         current.map((item) =>
            item.localId === localId ? { ...item, status: 'uploading', error: undefined } : item
         )
      );
      try {
         validateAttachment(file);
         if (!issueIdentifier) throw new Error('Issue is not available for file upload');
         const uploaded = await uploadsService.upload({ issueIdentifier }, file);
         setDraftAttachments((current) =>
            current.map((item) =>
               item.localId === localId
                  ? { ...item, status: 'ready', id: uploaded.id, error: undefined }
                  : item
            )
         );
      } catch (error) {
         setDraftAttachments((current) =>
            current.map((item) =>
               item.localId === localId
                  ? {
                       ...item,
                       status: 'failed',
                       error: error instanceof Error ? error.message : 'Upload failed',
                    }
                  : item
            )
         );
      }
   };

   const selectFiles = (files: FileList | null) => {
      const allSelected = Array.from(files ?? []);
      const remaining = MAX_COMMENT_ATTACHMENTS - draftAttachments.length;
      const selected = allSelected.slice(0, Math.max(remaining, 0));
      setAttachmentError(
         allSelected.length > selected.length
            ? `A comment can include up to ${MAX_COMMENT_ATTACHMENTS} files`
            : null
      );
      if (selected.length === 0) return;
      const newDrafts = selected.map((file) => ({
         localId: crypto.randomUUID(),
         file,
         status: 'uploading' as const,
      }));
      setDraftAttachments((current) => [...current, ...newDrafts]);
      newDrafts.forEach((item) => void uploadDraftFile(item.localId, item.file));
   };

   const selectMention = (member: Member) => {
      if (mentionStart < 0 || mentionQuery === null) return;
      const before = draft.slice(0, mentionStart);
      const after = draft.slice(mentionStart + 1 + mentionQuery.length);
      const inserted = `@${member.id} `;
      const newDraft = `${before}${inserted}${after}`;
      setDraft(newDraft);
      setMentionQuery(null);
      setMentionStart(-1);

      requestAnimationFrame(() => {
         const el = textareaRef.current;
         if (el) {
            const pos = before.length + inserted.length;
            el.focus();
            el.setSelectionRange(pos, pos);
         }
      });
   };

   const submitComment = async () => {
      const text = draft.trim();
      if (
         !text ||
         !user ||
         draftAttachments.some((item) => item.status === 'uploading' || item.status === 'failed')
      )
         return;
      if (!issueIdentifier) {
         const message = 'Unable to post a comment without an issue identifier';
         setSubmitError(message);
         toast.error(message);
         return;
      }
      setIsSubmitting(true);
      setSubmitError(null);
      try {
         const updated = await addIssueComment(issueIdentifier, {
            textContent: text,
            commentBlocks: [{ type: 'paragraph', text }],
            attachmentIds: draftAttachments.flatMap((item) => (item.id ? [item.id] : [])),
         });
         if (updated?.comments) {
            skipNextActivitySyncRef.current = true;
            setItems(updated.comments);
         }
         setDraft('');
         setDraftAttachments([]);
         setAttachmentError(null);
         setMentionQuery(null);
         setMentionStart(-1);
      } catch (err) {
         const message = err instanceof Error ? err.message : 'Failed to post comment';
         setSubmitError(message);
         toast.error(message);
         console.error(`Failed to post comment on ${issueIdentifier}:`, err);
      } finally {
         setIsSubmitting(false);
      }
   };

   const openCommentAttachment = async (attachmentId: string) => {
      setDownloadingId(attachmentId);
      try {
         const downloadUrl = await uploadsService.getDownloadUrl(attachmentId);
         window.location.assign(downloadUrl);
      } catch (error) {
         toast.error(error instanceof Error ? error.message : 'Failed to open attachment');
      } finally {
         setDownloadingId(null);
      }
   };

   const handleReact = async (activityId: string, emoji: string) => {
      if (!user) return;
      const currentItem = items.find((item) => item.id === activityId);
      const currentReaction = currentItem?.reactions?.find((reaction) => reaction.emoji === emoji);
      const hasReacted = Boolean(currentReaction?.userIds?.includes(user.id));
      // Optimistic update
      const previousItems = items;
      setItems((prev) =>
         prev.map((item) => {
            if (item.id !== activityId) return item;
            const reactions = item.reactions ? [...item.reactions] : [];
            const existing = reactions.find((r) => r.emoji === emoji);
            if (hasReacted && existing) {
               const userIds = (existing.userIds || []).filter((userId) => userId !== user.id);
               if (userIds.length === 0) {
                  return { ...item, reactions: reactions.filter((r) => r.emoji !== emoji) };
               }
               existing.userIds = userIds;
               existing.count = userIds.length;
            } else if (existing) {
               const userIds = [...(existing.userIds || []), user.id];
               existing.userIds = userIds;
               existing.count = userIds.length;
            } else {
               reactions.push({ emoji, count: 1, userIds: [user.id] });
            }
            return { ...item, reactions };
         })
      );

      try {
         if (hasReacted) {
            await removeIssueReaction(activityId, emoji);
         } else {
            await addIssueReaction(activityId, emoji, user.id);
         }
      } catch (err) {
         setItems(previousItems);
         toast.error(err instanceof Error ? err.message : 'Failed to update reaction');
      }
   };

   return (
      <div className="mt-10">
         <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
               <h2 className="text-base font-semibold">Activity</h2>
               {orderedActivity.length > 0 && (
                  <button
                     type="button"
                     aria-expanded={isActivityExpanded}
                     aria-controls={activityTimelineId}
                     aria-label={
                        isActivityExpanded
                           ? 'Collapse activity timeline'
                           : 'Expand activity timeline'
                     }
                     onClick={() => setIsActivityExpanded((expanded) => !expanded)}
                     className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                     <ChevronDown
                        className={`size-4 transition-transform ${isActivityExpanded ? 'rotate-180' : ''}`}
                     />
                  </button>
               )}
            </div>
            <button
               type="button"
               onClick={onToggleSubscription}
               disabled={!onToggleSubscription || isSubscriptionPending}
               aria-pressed={isSubscribed}
               className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
               {isSubscriptionPending ? 'Saving...' : isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
         </div>
         {orderedActivity.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No activity yet.</p>
         ) : (
            <div id={activityTimelineId} className="flex flex-col">
               {(isActivityExpanded
                  ? orderedActivity
                  : [orderedActivity[orderedActivity.length - 1]]
               ).map((item) => (
                  <EventRow key={item.id} item={item} />
               ))}
            </div>
         )}

         <section className="mt-7" aria-labelledby={commentsTitleId}>
            <h2 id={commentsTitleId} className="mb-2 text-base font-semibold">
               Comments
            </h2>
            {submitError && <p className="mb-2 text-xs text-destructive">{submitError}</p>}
            {items.map((item) => (
               <CommentCard
                  key={item.id}
                  item={item}
                  onReact={handleReact}
                  onDownload={openCommentAttachment}
                  downloadingId={downloadingId}
                  members={membersById}
               />
            ))}

            {/* Composer */}
            <div className="relative mt-3 rounded-lg border border-border/60 bg-container p-3 flex flex-col gap-2">
               {mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border/60 bg-popover shadow-md z-10">
                     <Command>
                        <CommandList>
                           <CommandGroup>
                              {mentionMatches.map((member) => (
                                 <CommandItem
                                    key={member.id}
                                    value={member.id}
                                    onSelect={() => selectMention(member)}
                                    className="cursor-pointer"
                                 >
                                    {member.name}
                                 </CommandItem>
                              ))}
                           </CommandGroup>
                        </CommandList>
                     </Command>
                  </div>
               )}
               <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) =>
                     handleDraftChange(event.target.value, event.target.selectionStart)
                  }
                  onKeyDown={(event) => {
                     if (mentionQuery !== null && mentionMatches.length > 0) {
                        if (event.key === 'Enter' || event.key === 'Tab') {
                           event.preventDefault();
                           selectMention(mentionMatches[0]);
                           return;
                        }
                        if (event.key === 'Escape') {
                           event.preventDefault();
                           setMentionQuery(null);
                           setMentionStart(-1);
                           return;
                        }
                     }
                     if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        submitComment();
                     }
                  }}
                  placeholder="Leave a comment..."
                  rows={2}
                  className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground"
               />
               {draftAttachments.length > 0 && (
                  <ul className="divide-y divide-border/60 rounded-md border border-border/70">
                     {draftAttachments.map((item) => (
                        <li key={item.localId} className="flex items-center gap-2 px-2.5 py-2">
                           {item.status === 'uploading' ? (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                           ) : (
                              <FileText className="size-4 text-muted-foreground" />
                           )}
                           <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                 {item.file.name} · {formatFileSize(item.file.size)}
                              </span>
                              {item.status === 'failed' ? (
                                 <span className="text-[11px] text-destructive">{item.error}</span>
                              ) : (
                                 <span className="text-[11px] text-muted-foreground">
                                    {item.status === 'ready' ? 'Ready to attach' : 'Uploading…'}
                                 </span>
                              )}
                           </div>
                           {item.status === 'failed' && (
                              <button
                                 type="button"
                                 onClick={() => void uploadDraftFile(item.localId, item.file)}
                                 aria-label={`Retry ${item.file.name}`}
                                 className="rounded p-1 text-muted-foreground hover:bg-accent"
                              >
                                 <RefreshCw className="size-3.5" />
                              </button>
                           )}
                           <button
                              type="button"
                              onClick={() => {
                                 setDraftAttachments((current) =>
                                    current.filter(
                                       (draftFile) => draftFile.localId !== item.localId
                                    )
                                 );
                                 setAttachmentError(null);
                              }}
                              aria-label={`Remove ${item.file.name}`}
                              className="rounded p-1 text-muted-foreground hover:bg-accent"
                           >
                              <X className="size-3.5" />
                           </button>
                        </li>
                     ))}
                  </ul>
               )}
               {attachmentError && (
                  <p role="alert" className="text-xs text-destructive">
                     {attachmentError}
                  </p>
               )}
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                           selectFiles(event.target.files);
                           event.target.value = '';
                        }}
                     />
                     <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={
                           !issueIdentifier ||
                           isSubmitting ||
                           draftAttachments.length >= MAX_COMMENT_ATTACHMENTS
                        }
                     >
                        <Paperclip className="size-3.5" /> Attach files
                     </Button>
                     <span className="text-[11px] text-muted-foreground">
                        Up to {Math.round(MAX_ATTACHMENT_SIZE / 1024 / 1024)} MB each
                     </span>
                  </div>
                  <Button
                     size="xs"
                     onClick={submitComment}
                     disabled={
                        !draft.trim() ||
                        isSubmitting ||
                        draftAttachments.some((item) => item.status !== 'ready')
                     }
                  >
                     Comment
                  </Button>
               </div>
            </div>
         </section>
      </div>
   );
}

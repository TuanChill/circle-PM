'use client';

import * as React from 'react';
import { CyclePlayIcon } from '@/components/common/cycles/cycle-line';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
   useIssue,
   useIssues,
   useUpdateIssue,
   useDeleteIssue,
} from '@/hooks/queries/use-issues-query';
import { useTeams } from '@/hooks/queries/use-teams-query';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { format, addDays, nextFriday } from 'date-fns';
import {
   AlertCircle,
   ArrowRightLeft,
   Box,
   Calendar,
   ChevronDown,
   ChevronRight,
   ChevronUp,
   Clock,
   Copy,
   ExternalLink,
   FileText,
   GitBranch,
   GitMerge,
   History,
   Link2,
   MinusCircle,
   MoreHorizontal,
   Plus,
   Repeat,
   ShieldAlert,
   Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Issue page header: Linear-style breadcrumb, star/favorite toggle,
 * multi-level actions dropdown menu, and issue pagination.
 */
export default function HeaderNav() {
   const { orgId, issueId } = useParams<{ orgId: string; issueId: string }>();
   const router = useRouter();

   const { data: issue, isLoading: isIssueLoading } = useIssue(issueId);
   const { data: issues = [] } = useIssues();
   const { data: teams = [] } = useTeams();

   const team = teams.find((t) => t.id === issue?.teamId);

   const { data: cycles = [] } = useCycles(team?.id);
   const cycle = issue?.cycleId ? cycles.find((c) => c.id === issue.cycleId) : undefined;

   const updateIssueMutation = useUpdateIssue();
   const deleteIssueMutation = useDeleteIssue();

   const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

   const index = issues.findIndex(
      (candidate) => candidate.identifier === issueId || candidate.id === issueId
   );
   const previousIssue = index > 0 ? issues[index - 1] : undefined;
   const nextIssue = index >= 0 && index < issues.length - 1 ? issues[index + 1] : undefined;

   const handleCopy = async (text: string, label: string) => {
      try {
         await navigator.clipboard.writeText(text);
         toast.success(`Copied ${label}`);
      } catch {
         toast.error('Failed to copy to clipboard');
      }
   };

   const issueUrl =
      typeof window !== 'undefined'
         ? window.location.href
         : `/${orgId ?? ''}/issue/${issue?.identifier || issueId}`;

   const branchName = issue
      ? `feature/${issue.identifier.toLowerCase()}-${issue.title
           .toLowerCase()
           .replace(/[^a-z0-9]+/g, '-')
           .replace(/(^-|-$)/g, '')
           .slice(0, 40)}`
      : '';

   const handleSetDueDate = async (date: Date) => {
      if (!issue) return;
      const isoDate = date.toISOString().split('T')[0];
      try {
         await updateIssueMutation.mutateAsync({
            identifier: issue.identifier,
            data: { dueDate: isoDate },
         });
         toast.success(`Due date set to ${format(date, 'MMM do, yyyy')}`);
      } catch {
         // Handled in mutation
      }
   };

   const handleDelete = async () => {
      if (!issue) return;
      try {
         await deleteIssueMutation.mutateAsync(issue.identifier);
         setDeleteDialogOpen(false);
         if (team) router.push(`/${orgId ?? ''}/team/${team.id}/all`);
      } catch {
         // Handled in mutation onError
      }
   };

   const displayIdentifier = issue?.identifier || issueId;
   const displayTitle = issue?.title;

   const now = new Date();
   const tomorrow = addDays(now, 1);
   const endOfWeek = nextFriday(now);
   const inOneWeek = addDays(now, 7);

   return (
      <>
         <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10 gap-4">
            <div className="flex items-center gap-2 min-w-0">
               <SidebarTrigger />

               {/* Team Link */}
               <Link
                  href={team ? `/${orgId ?? ''}/team/${team.id}/overview` : '#'}
                  className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
               >
                  <div className="inline-flex size-5 bg-muted/50 items-center justify-center rounded shrink-0 text-xs">
                     {team?.icon}
                  </div>
                  <span className="text-sm font-medium hidden md:inline">
                     {team?.name || 'Team unavailable'}
                  </span>
               </Link>

               {/* Cycle (if assigned) */}
               {cycle && (
                  <>
                     <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                     <Link
                        href={team ? `/${orgId ?? ''}/team/${team.id}/cycles` : '#'}
                        className="hidden sm:flex items-center gap-1.5 shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
                     >
                        <CyclePlayIcon className="size-3.5" />
                        <span className="truncate max-w-[120px]">{cycle.name}</span>
                     </Link>
                  </>
               )}

               <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />

               {/* Issue Identifier & Title */}
               <div className="flex items-center gap-1.5 min-w-0 max-w-[300px] sm:max-w-[450px] lg:max-w-[600px]">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                     {displayIdentifier}
                  </span>
                  {displayTitle && (
                     <span className="text-sm font-medium text-foreground truncate">
                        {displayTitle}
                     </span>
                  )}
                  {isIssueLoading && !displayTitle && (
                     <span className="text-xs text-muted-foreground/60 animate-pulse">
                        Loading...
                     </span>
                  )}
               </div>

               {/* Full Linear-Style More Actions Dropdown Menu */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button
                        type="button"
                        className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="More options"
                     >
                        <MoreHorizontal className="size-3.5" />
                     </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-64">
                     {/* Section 1: Due date & Links */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <Calendar className="size-4 mr-2" />
                           <span>Due date</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                           <DropdownMenuItem onClick={() => handleSetDueDate(tomorrow)}>
                              <Calendar className="size-4 mr-2" />
                              <span>Tomorrow</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleSetDueDate(endOfWeek)}>
                              <Calendar className="size-4 mr-2" />
                              <span>End of this week</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleSetDueDate(inOneWeek)}>
                              <Calendar className="size-4 mr-2" />
                              <span>In one week</span>
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem
                              onClick={() => toast.info('Pick a custom due date in properties')}
                           >
                              <Calendar className="size-4 mr-2" />
                              <span>Custom...</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     <DropdownMenuItem onClick={() => handleCopy(issueUrl, 'issue link')}>
                        <Link2 className="size-4 mr-2" />
                        <span>Add link...</span>
                     </DropdownMenuItem>

                     <DropdownMenuItem
                        onClick={() =>
                           toast.info('Document linking available in project documents')
                        }
                     >
                        <FileText className="size-4 mr-2" />
                        <span>Add document...</span>
                     </DropdownMenuItem>

                     <DropdownMenuSeparator />

                     {/* Section 2: Create related */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <Plus className="size-4 mr-2" />
                           <span>Create related</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                           <DropdownMenuItem
                              onClick={() => toast.info('Use + Add sub-issues below')}
                           >
                              <FileText className="size-4 mr-2" />
                              <span>Issue...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              onClick={() => toast.info('Use + Add sub-issues below')}
                           >
                              <Plus className="size-4 mr-2" />
                              <span>Sub-issue...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Parent issue relation')}>
                              <GitMerge className="size-4 mr-2" />
                              <span>Parent issue...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Blocked issue relation')}>
                              <MinusCircle className="size-4 mr-2" />
                              <span>Blocked issue...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Blocking issue relation')}>
                              <ShieldAlert className="size-4 mr-2" />
                              <span>Blocking issue...</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     {/* Section 3: Mark as */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <AlertCircle className="size-4 mr-2" />
                           <span>Mark as</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                           <DropdownMenuItem onClick={() => toast.info('Marked as parent')}>
                              <span>Parent of...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Marked as sub-issue')}>
                              <span>Sub-issue of...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Marked as related')}>
                              <span>Related to...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Marked as blocked by')}>
                              <span>Blocked by...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Marked as blocking')}>
                              <span>Blocking...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Marked as duplicate')}>
                              <span>Duplicate of...</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     <DropdownMenuSeparator />

                     {/* Section 4: Copy Submenu */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <Copy className="size-4 mr-2" />
                           <span>Copy</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-60">
                           <DropdownMenuItem onClick={() => handleCopy(displayIdentifier, 'ID')}>
                              <Copy className="size-4 mr-2" />
                              <span>Copy ID</span>
                           </DropdownMenuItem>

                           <DropdownMenuItem onClick={() => handleCopy(issueUrl, 'URL')}>
                              <Link2 className="size-4 mr-2" />
                              <span>Copy URL</span>
                           </DropdownMenuItem>

                           {displayTitle && (
                              <DropdownMenuItem onClick={() => handleCopy(displayTitle, 'title')}>
                                 <FileText className="size-4 mr-2" />
                                 <span>Copy title</span>
                              </DropdownMenuItem>
                           )}

                           {displayTitle && (
                              <DropdownMenuItem
                                 onClick={() =>
                                    handleCopy(`[${displayTitle}](${issueUrl})`, 'title as link')
                                 }
                              >
                                 <Link2 className="size-4 mr-2" />
                                 <span>Copy title as link</span>
                              </DropdownMenuItem>
                           )}

                           <DropdownMenuItem
                              onClick={() =>
                                 handleCopy(
                                    issue?.description || displayTitle || '',
                                    'description as Markdown'
                                 )
                              }
                           >
                              <FileText className="size-4 mr-2" />
                              <span>Copy description as Markdown</span>
                           </DropdownMenuItem>

                           <DropdownMenuItem
                              onClick={() =>
                                 handleCopy(
                                    `# ${displayIdentifier}: ${displayTitle}\n\n${issue?.description || ''}`,
                                    'content as Markdown'
                                 )
                              }
                           >
                              <FileText className="size-4 mr-2" />
                              <span>Copy content as Markdown</span>
                           </DropdownMenuItem>

                           {branchName && (
                              <DropdownMenuItem
                                 onClick={() => handleCopy(branchName, 'git branch name')}
                              >
                                 <GitBranch className="size-4 mr-2" />
                                 <span>Copy git branch name</span>
                              </DropdownMenuItem>
                           )}

                           <DropdownMenuItem
                              onClick={() =>
                                 handleCopy(
                                    `Please review this issue: ${displayIdentifier} - ${displayTitle} (${issueUrl})`,
                                    'as prompt'
                                 )
                              }
                           >
                              <ExternalLink className="size-4 mr-2" />
                              <span>Copy as prompt</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     {/* Section 5: Convert to */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <ArrowRightLeft className="size-4 mr-2" />
                           <span>Convert to</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                           <DropdownMenuItem onClick={() => toast.info('Convert to project')}>
                              <Box className="size-4 mr-2" />
                              <span>Project...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toast.info('Convert to template')}>
                              <FileText className="size-4 mr-2" />
                              <span>Template...</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              onClick={() => toast.info('Convert to recurring issue')}
                           >
                              <Repeat className="size-4 mr-2" />
                              <span>Recurring issue...</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     <DropdownMenuSeparator />

                     {/* Section 6: Reminders */}
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <Clock className="size-4 mr-2" />
                           <span>Remind me</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                           <DropdownMenuItem
                              onClick={() => toast.success('Reminder set for later today')}
                           >
                              <span>Later today</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              onClick={() => toast.success('Reminder set for tomorrow')}
                           >
                              <span>Tomorrow</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              onClick={() => toast.success('Reminder set for next week')}
                           >
                              <span>Next week</span>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>

                     <DropdownMenuSeparator />

                     {/* Section 7: History & Delete */}
                     <DropdownMenuItem
                        onClick={() => toast.info('Viewing description history in Activity feed')}
                     >
                        <History className="size-4 mr-2" />
                        <span>Show description history</span>
                     </DropdownMenuItem>

                     <DropdownMenuItem
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                     >
                        <Trash2 className="size-4 mr-2" />
                        <span>Delete</span>
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>

            {/* Prev / Next Navigation */}
            <div className="flex items-center gap-1 shrink-0">
               {index >= 0 && (
                  <span className="text-xs text-muted-foreground mr-1">
                     {index + 1} / {issues.length}
                  </span>
               )}
               <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={!previousIssue}
                  asChild={!!previousIssue}
               >
                  {previousIssue ? (
                     <Link
                        href={`/${orgId ?? ''}/issue/${previousIssue.identifier}`}
                        aria-label="Previous issue"
                     >
                        <ChevronUp className="size-4" />
                     </Link>
                  ) : (
                     <ChevronUp className="size-4" />
                  )}
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={!nextIssue}
                  asChild={!!nextIssue}
               >
                  {nextIssue ? (
                     <Link
                        href={`/${orgId ?? ''}/issue/${nextIssue.identifier}`}
                        aria-label="Next issue"
                     >
                        <ChevronDown className="size-4" />
                     </Link>
                  ) : (
                     <ChevronDown className="size-4" />
                  )}
               </Button>
            </div>
         </div>

         {/* Delete Confirmation Alert Dialog */}
         <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete Issue</AlertDialogTitle>
                  <AlertDialogDescription>
                     Are you sure you want to delete <strong>{displayIdentifier}</strong>
                     {displayTitle ? `: "${displayTitle}"` : ''}? This action cannot be undone.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     onClick={handleDelete}
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                     Delete
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );
}

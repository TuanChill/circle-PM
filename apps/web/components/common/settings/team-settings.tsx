'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
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
   ChevronRight,
   Lock,
   RefreshCcw,
   Repeat,
   Settings,
   Tag,
   Target,
   Users,
   Workflow,
   Zap,
   Loader2,
   Trash2,
   AlertTriangle,
   SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SettingsCard, SettingsRow, SettingsSection } from './shared';
import { toast } from 'sonner';

interface TeamSettingsProps {
   teamId: string;
}

const EMOJI_PRESETS = ['🛠️', '🎨', '⚡', '🚀', '🔒', '📱', '🌐', '📊', '💡', '🧪', '📦', '🎯'];

function TeamSettingsSkeleton() {
   return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 animate-in fade-in-50 duration-200">
         <div className="flex items-center gap-3">
            <div className="size-9 bg-muted/40 rounded-md animate-pulse" />
            <div className="space-y-2 flex-1">
               <div className="h-6 w-48 bg-muted/40 rounded animate-pulse" />
               <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
            </div>
         </div>
         <div className="space-y-4">
            <div className="h-32 w-full bg-muted/20 rounded-lg border border-border/40 animate-pulse" />
            <div className="h-28 w-full bg-muted/20 rounded-lg border border-border/40 animate-pulse" />
            <div className="h-36 w-full bg-muted/20 rounded-lg border border-border/40 animate-pulse" />
         </div>
      </div>
   );
}

import {
   useTeam,
   useUpdateTeam,
   useDeleteTeam,
   useToggleJoinTeam,
} from '@/hooks/queries/use-teams-query';
import { Team } from '@/services/teams.service';
import { useCycles } from '@/hooks/queries/use-cycles-query';
import { useLabels } from '@/hooks/queries/use-labels-query';
import { CycleSettingsDialog } from '@/components/common/cycles/cycle-settings-dialog';

export default function TeamSettings({ teamId }: TeamSettingsProps) {
   const { orgId } = useParams<{ orgId: string }>();
   const router = useRouter();
   const { data: team, isLoading } = useTeam(teamId);
   const { data: cycles = [] } = useCycles(teamId);
   const { data: labels = [] } = useLabels('issue');
   const updateTeamMutation = useUpdateTeam();
   const deleteTeamMutation = useDeleteTeam();
   const toggleJoinMutation = useToggleJoinTeam();
   const updateTeam = (id: string, data: Partial<Team>) =>
      updateTeamMutation.mutateAsync({ id, data });
   const deleteTeam = (id: string) => deleteTeamMutation.mutateAsync(id);
   const toggleJoin = (id: string) => toggleJoinMutation.mutateAsync(id);

   // Dialog states
   const [generalOpen, setGeneralOpen] = React.useState(false);
   const [permissionsOpen, setPermissionsOpen] = React.useState(false);
   const [leaveOpen, setLeaveOpen] = React.useState(false);
   const [retireOpen, setRetireOpen] = React.useState(false);
   const [deleteOpen, setDeleteOpen] = React.useState(false);
   const [cycleSettingsOpen, setCycleSettingsOpen] = React.useState(false);
   const [estimateSettingsOpen, setEstimateSettingsOpen] = React.useState(false);

   // General form state
   const [name, setName] = React.useState(team?.name || '');
   const [icon, setIcon] = React.useState(team?.icon || '⚡');
   const [description, setDescription] = React.useState(team?.description || '');
   const [isUpdating, setIsUpdating] = React.useState(false);
   const [estimateEnabled, setEstimateEnabled] = React.useState(false);
   const [estimateScale, setEstimateScale] = React.useState<
      'exponential' | 'fibonacci' | 'linear' | 't-shirt'
   >('fibonacci');
   const [estimateExtended, setEstimateExtended] = React.useState(false);
   const [estimateZero, setEstimateZero] = React.useState(false);
   const [unestimatedAsOne, setUnestimatedAsOne] = React.useState(true);

   // Delete confirmation state
   const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
   const [isDeleting, setIsDeleting] = React.useState(false);

   React.useEffect(() => {
      if (team) {
         setName(team.name);
         setIcon(team.icon);
         setDescription(team.description || '');
         setEstimateEnabled(team.estimateEnabled ?? false);
         setEstimateScale(team.estimateScale ?? 'fibonacci');
         setEstimateExtended(team.estimateExtended ?? false);
         setEstimateZero(team.estimateZero ?? false);
         setUnestimatedAsOne(team.unestimatedAsOne ?? true);
      }
   }, [team]);

   if (isLoading) {
      return <TeamSettingsSkeleton />;
   }

   if (!team) {
      return (
         <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in-50 duration-200">
            <h1 className="text-xl font-semibold">Team not found</h1>
            <p className="text-sm text-muted-foreground">
               The requested team does not exist or has been deleted.
            </p>
            <Link
               href={`/${orgId ?? ''}/teams`}
               className="mt-2 text-xs px-3 py-1.5 rounded-md border border-border/80 bg-accent hover:bg-accent/80 transition-colors font-medium text-foreground"
            >
               Back to teams
            </Link>
         </div>
      );
   }

   const handleSaveGeneral = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
         toast.error('Team name cannot be empty');
         return;
      }
      setIsUpdating(true);
      try {
         await updateTeam(team.id, {
            name: name.trim(),
            icon,
            description: description.trim() || undefined,
         });
         toast.success('Team settings updated');
         setGeneralOpen(false);
      } catch (err: unknown) {
         toast.error(err instanceof Error ? err.message : 'Could not update team');
      } finally {
         setIsUpdating(false);
      }
   };

   const handleLeaveTeam = async () => {
      try {
         await toggleJoin(team.id);
         toast.success(`You left team "${team.name}"`);
         setLeaveOpen(false);
         router.push(`/${orgId}/teams`);
      } catch (err: unknown) {
         toast.error(err instanceof Error ? err.message : 'Could not leave team');
      }
   };

   const handleJoinTeam = async () => {
      try {
         await toggleJoin(team.id);
         toast.success(`You joined team "${team.name}"`);
      } catch (err: unknown) {
         toast.error(err instanceof Error ? err.message : 'Could not join team');
      }
   };

   const handleSaveEstimates = async () => {
      try {
         await updateTeam(team.id, {
            estimateEnabled,
            estimateScale,
            estimateExtended,
            estimateZero,
            unestimatedAsOne,
         });
         toast.success('Estimate settings updated');
         setEstimateSettingsOpen(false);
      } catch (err: unknown) {
         toast.error(err instanceof Error ? err.message : 'Could not update estimate settings');
      }
   };

   const handleRetireTeam = async () => {
      toast.error('Team retirement is not supported by the current API');
   };

   const handleDeleteTeam = async () => {
      if (deleteConfirmText.trim() !== team.id) {
         toast.error(`Please type "${team.id}" to confirm deletion`);
         return;
      }
      setIsDeleting(true);
      try {
         await deleteTeam(team.id);
         toast.success(`Team "${team.name}" permanently deleted`);
         setDeleteOpen(false);
         router.push(`/${orgId}/teams`);
      } catch (err: unknown) {
         toast.error(err instanceof Error ? err.message : 'Could not delete team');
      } finally {
         setIsDeleting(false);
      }
   };

   return (
      <div className="w-full overflow-y-auto h-full">
         <div className="max-w-2xl mx-auto px-6 py-10 pb-20">
            <div className="flex items-center gap-3">
               <span className="inline-flex size-9 bg-muted/50 items-center justify-center rounded-md text-lg">
                  {team.icon}
               </span>
               <div className="flex-1">
                  <h1 className="text-2xl font-medium">{team.name}</h1>
                  <p className="text-sm text-muted-foreground">
                     {team.description || 'Accessible to all workspace members'}
                  </p>
               </div>
               <Link
                  href={`/${orgId}/team/${team.id}/overview`}
                  className="text-sm inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
               >
                  Team overview
                  <ChevronRight className="size-4" />
               </Link>
            </div>

            <div className="flex flex-col gap-10 mt-10">
               <SettingsSection>
                  <SettingsCard>
                     <SettingsRow
                        icon={<Settings className="size-4" />}
                        title="General"
                        description="Name, identifier, icon, and description"
                        chevron
                        onClick={() => setGeneralOpen(true)}
                     />
                     <SettingsRow
                        icon={<Lock className="size-4" />}
                        title="Access and permissions"
                        description="Manage team visibility and member permissions"
                        chevron
                        onClick={() => setPermissionsOpen(true)}
                     />
                     <Link href={`/${orgId}/team/${team.id}/members`} className="block">
                        <SettingsRow
                           icon={<Users className="size-4" />}
                           title="Members"
                           description="Manage team members"
                           trailing={<span>{team.members.length} members</span>}
                           chevron
                        />
                     </Link>
                     <SettingsRow
                        icon={<Zap className="size-4" />}
                        title="Slack notifications"
                        description="Broadcast notifications to Slack"
                        trailing={<span>Unavailable</span>}
                        chevron
                        onClick={() => toast.info('Connect Slack from Integrations settings')}
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Issues, projects, and docs">
                  <SettingsCard>
                     <Link href={`/${orgId}/settings/issue-labels`} className="block">
                        <SettingsRow
                           icon={<Tag className="size-4" />}
                           title="Issue labels"
                           description="Labels available to this team's issues"
                           trailing={<span>{labels.length} labels</span>}
                           chevron
                        />
                     </Link>
                     <SettingsRow
                        icon={<Repeat className="size-4" />}
                        title="Recurring issues"
                        description="Automatically create issues on a schedule"
                        trailing={<span>Unavailable</span>}
                        chevron
                        onClick={() =>
                           toast.error('Recurring issues are not enabled for this team')
                        }
                     />
                     <SettingsRow
                        icon={<Target className="size-4" />}
                        title="Estimates"
                        description="Measure issue effort and cycle capacity"
                        trailing={<span>{team.estimateEnabled ? 'Enabled' : 'Off'}</span>}
                        chevron
                        onClick={() => setEstimateSettingsOpen(true)}
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Workflow">
                  <SettingsCard>
                     <SettingsRow
                        icon={<Target className="size-4" />}
                        title="Issue statuses"
                        description="Customize this team’s issue workflow"
                        trailing={<span>Manage workflow</span>}
                        chevron
                        onClick={() =>
                           router.push(`/${orgId}/settings/teams/${team.id}/issue-statuses`)
                        }
                     />
                     <SettingsRow
                        icon={<Workflow className="size-4" />}
                        title="Workflows & automations"
                        description="Manage issue automations and git workflows"
                        chevron
                        onClick={() => toast.error('Team automations are not configured')}
                     />
                     <Link href={`/${orgId}/team/${team.id}/cycles`} className="block">
                        <SettingsRow
                           icon={<RefreshCcw className="size-4" />}
                           title="Cycles"
                           description="Focus your team over short, time-boxed windows"
                           trailing={<span>{cycles.length > 0 ? 'Active' : 'Off'}</span>}
                           chevron
                        />
                     </Link>
                     <SettingsRow
                        icon={<SlidersHorizontal className="size-4" />}
                        title="Cycle settings"
                        description="Configure cadence, cooldown, and upcoming cycles"
                        chevron
                        onClick={() => setCycleSettingsOpen(true)}
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Membership">
                  <SettingsCard>
                     {team.joined ? (
                        <SettingsRow
                           title="Leave team"
                           description="Remove yourself as a member of this team"
                           trailing={
                              <Button
                                 size="xs"
                                 variant="ghost"
                                 disabled={toggleJoinMutation.isPending}
                                 onClick={() => setLeaveOpen(true)}
                              >
                                 Leave team...
                              </Button>
                           }
                        />
                     ) : (
                        <SettingsRow
                           title="Join team"
                           description="Join this team to receive team-level updates and work with its issues"
                           trailing={
                              <Button
                                 size="xs"
                                 variant="secondary"
                                 disabled={toggleJoinMutation.isPending}
                                 onClick={handleJoinTeam}
                              >
                                 {toggleJoinMutation.isPending ? 'Joining...' : 'Join team'}
                              </Button>
                           }
                        />
                     )}
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Danger zone">
                  <SettingsCard>
                     <SettingsRow
                        title="Retire team"
                        description="Prevent creating and updating issues in this team while preserving all historical data"
                        muted
                        trailing={
                           <Button size="xs" variant="ghost" onClick={() => setRetireOpen(true)}>
                              Retire...
                           </Button>
                        }
                     />
                     <SettingsRow
                        title="Delete team"
                        description="Permanently delete this team and all its data"
                        muted
                        trailing={
                           <Button
                              size="xs"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                 setDeleteConfirmText('');
                                 setDeleteOpen(true);
                              }}
                           >
                              Delete...
                           </Button>
                        }
                     />
                  </SettingsCard>
               </SettingsSection>
            </div>
         </div>

         {/* General Settings Dialog */}
         <Dialog open={generalOpen} onOpenChange={setGeneralOpen}>
            <DialogContent className="sm:max-w-[480px]">
               <form onSubmit={handleSaveGeneral}>
                  <DialogHeader>
                     <DialogTitle>Team General Settings</DialogTitle>
                     <DialogDescription>Update team name, icon and description.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="edit-team-name">Team name</Label>
                        <Input
                           id="edit-team-name"
                           value={name}
                           onChange={(e) => setName(e.target.value)}
                           disabled={isUpdating}
                           required
                        />
                     </div>
                     <div className="space-y-1.5">
                        <Label>Team icon</Label>
                        <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-border/40">
                           {EMOJI_PRESETS.map((emoji) => (
                              <button
                                 key={emoji}
                                 type="button"
                                 onClick={() => setIcon(emoji)}
                                 className={`size-8 rounded flex items-center justify-center text-base transition-all ${
                                    icon === emoji
                                       ? 'bg-primary/20 ring-2 ring-primary'
                                       : 'hover:bg-sidebar'
                                 }`}
                              >
                                 {emoji}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="edit-team-desc">Description</Label>
                        <Textarea
                           id="edit-team-desc"
                           value={description}
                           onChange={(e) => setDescription(e.target.value)}
                           disabled={isUpdating}
                           rows={2}
                        />
                     </div>
                  </div>
                  <DialogFooter>
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setGeneralOpen(false)}
                     >
                        Cancel
                     </Button>
                     <Button type="submit" size="sm" disabled={isUpdating || !name.trim()}>
                        {isUpdating ? (
                           <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                           'Save changes'
                        )}
                     </Button>
                  </DialogFooter>
               </form>
            </DialogContent>
         </Dialog>

         {/* Access and Permissions Dialog */}
         <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
            <DialogContent className="sm:max-w-[480px]">
               <DialogHeader>
                  <DialogTitle>Access & Permissions</DialogTitle>
                  <DialogDescription>
                     Control who can view, join, and post issues in this team.
                  </DialogDescription>
               </DialogHeader>
               <div className="space-y-4 py-4">
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                     <span className="font-medium text-xs">Public to workspace</span>
                     <p className="text-xs text-muted-foreground">
                        Any member in the workspace can view issues, cycles, and projects of this
                        team.
                     </p>
                  </div>
               </div>
               <DialogFooter>
                  <Button type="button" size="sm" onClick={() => setPermissionsOpen(false)}>
                     Done
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>

         <CycleSettingsDialog
            teamId={team.id}
            open={cycleSettingsOpen}
            onOpenChange={setCycleSettingsOpen}
         />

         <Dialog open={estimateSettingsOpen} onOpenChange={setEstimateSettingsOpen}>
            <DialogContent className="sm:max-w-[480px]">
               <DialogHeader>
                  <DialogTitle>Issue estimates</DialogTitle>
                  <DialogDescription>
                     Enable team estimates to use effort points in issues and cycle capacity.
                  </DialogDescription>
               </DialogHeader>
               <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                     <div>
                        <Label>Enable estimates</Label>
                        <p className="text-xs text-muted-foreground">
                           Estimate values are stored on each issue.
                        </p>
                     </div>
                     <Switch checked={estimateEnabled} onCheckedChange={setEstimateEnabled} />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Scale</Label>
                     <Select
                        value={estimateScale}
                        onValueChange={(value) => setEstimateScale(value as typeof estimateScale)}
                        disabled={!estimateEnabled}
                     >
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="exponential">Exponential · 1, 2, 4, 8, 16</SelectItem>
                           <SelectItem value="fibonacci">Fibonacci · 1, 2, 3, 5, 8</SelectItem>
                           <SelectItem value="linear">Linear · 1, 2, 3, 4, 5</SelectItem>
                           <SelectItem value="t-shirt">T-shirt · XS, S, M, L, XL</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                     <Label>Extended scale</Label>
                     <Switch
                        checked={estimateExtended}
                        onCheckedChange={setEstimateExtended}
                        disabled={!estimateEnabled}
                     />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                     <Label>Allow zero estimates</Label>
                     <Switch
                        checked={estimateZero}
                        onCheckedChange={setEstimateZero}
                        disabled={!estimateEnabled}
                     />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                     <div>
                        <Label>Count unestimated issues as 1</Label>
                        <p className="text-xs text-muted-foreground">
                           Used for cycle effort until an issue receives an estimate.
                        </p>
                     </div>
                     <Switch
                        checked={unestimatedAsOne}
                        onCheckedChange={setUnestimatedAsOne}
                        disabled={!estimateEnabled}
                     />
                  </div>
               </div>
               <DialogFooter>
                  <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={() => setEstimateSettingsOpen(false)}
                  >
                     Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleSaveEstimates}>
                     Save settings
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>

         {/* Leave Team Alert Dialog */}
         <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Leave team &ldquo;{team.name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                     You will be removed from this team. You will no longer receive team-level
                     updates or issues assigned by default.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     disabled={toggleJoinMutation.isPending}
                     onClick={handleLeaveTeam}
                  >
                     {toggleJoinMutation.isPending ? 'Leaving...' : 'Leave team'}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         {/* Retire Team Alert Dialog */}
         <AlertDialog open={retireOpen} onOpenChange={setRetireOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Retire team &ldquo;{team.name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                     Retiring a team prevents creating and updating issues while preserving
                     historical data.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRetireTeam}>Retire team</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         {/* Delete Team Dialog */}
         <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-[480px]">
               <DialogHeader>
                  <div className="flex items-center gap-2 text-destructive">
                     <AlertTriangle className="size-5" />
                     <DialogTitle className="text-destructive">
                        Delete team &ldquo;{team.name}&rdquo;
                     </DialogTitle>
                  </div>
                  <DialogDescription className="pt-1 text-xs">
                     This action cannot be undone. All issues, projects, and documents associated
                     with this team will be deleted.
                  </DialogDescription>
               </DialogHeader>
               <div className="space-y-3 py-3">
                  <Label className="text-xs">
                     Please type{' '}
                     <strong className="font-semibold text-foreground">{team.id}</strong> to
                     confirm:
                  </Label>
                  <Input
                     placeholder={team.id}
                     value={deleteConfirmText}
                     onChange={(e) => setDeleteConfirmText(e.target.value)}
                     disabled={isDeleting}
                     className="h-8 text-xs font-mono"
                  />
               </div>
               <DialogFooter>
                  <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={() => setDeleteOpen(false)}
                     disabled={isDeleting}
                  >
                     Cancel
                  </Button>
                  <Button
                     type="button"
                     variant="destructive"
                     size="sm"
                     disabled={isDeleting || deleteConfirmText.trim() !== team.id}
                     onClick={handleDeleteTeam}
                     className="gap-1.5"
                  >
                     {isDeleting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                     ) : (
                        <Trash2 className="size-3.5" />
                     )}
                     Permanently delete
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   );
}

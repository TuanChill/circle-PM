'use client';

import * as React from 'react';
import {
   AlertCircle,
   Check,
   ChevronsUpDown,
   LogOut,
   Plus,
   Settings,
   Sparkles,
   UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuPortal,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { RiEditLine } from '@remixicon/react';
import { useCreateIssueStore } from '@/store/create-issue-store';
import { ThemeToggle } from '../theme-toggle';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaces } from '@/hooks/queries';
import { CreateOrJoinWorkspaceDialog } from '@/components/common/workspaces/create-or-join-workspace-dialog';
import { ROUTES } from '@/constants/routes';
import { saveActiveWorkspace } from '@/lib/utils/workspace-persistence';

export function OrgSwitcher() {
   const router = useRouter();
   const params = useParams<{ orgId?: string }>();
   const currentOrgId = params?.orgId;

   const { user, logout } = useAuthStore();
   const {
      data: workspaces,
      isLoading,
      isError: isWorkspacesError,
      refetch: refetchWorkspaces,
   } = useWorkspaces();
   const { openModal } = useCreateIssueStore();
   const [dialogOpen, setDialogOpen] = React.useState(false);
   const [defaultTab, setDefaultTab] = React.useState<'create' | 'join'>('create');

   if (!currentOrgId) return null;

   if (isWorkspacesError) {
      return (
         <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton
                  type="button"
                  onClick={() => void refetchWorkspaces()}
                  className="text-destructive"
               >
                  <AlertCircle className="size-4" />
                  <span>Workspace unavailable — retry</span>
               </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      );
   }

   // Determine active workspace
   const activeWorkspace =
      workspaces?.find((ws) => ws.slug === currentOrgId || ws.id === currentOrgId) ||
      workspaces?.[0];

   const workspaceName = activeWorkspace?.name || currentOrgId;
   const workspaceIcon = activeWorkspace?.icon || 'from-muted-foreground/70 to-muted-foreground';
   const initials = workspaceName.slice(0, 2).toUpperCase();

   const handleSelectWorkspace = (slug: string) => {
      saveActiveWorkspace(slug);
      if (slug !== currentOrgId) {
         router.push(ROUTES.WORKSPACE.MY_ISSUES(slug));
      }
   };

   const openCreateOrJoin = (tab: 'create' | 'join') => {
      setDefaultTab(tab);
      setDialogOpen(true);
   };

   return (
      <>
         <SidebarMenu>
            <SidebarMenuItem>
               <DropdownMenu>
                  <div className="w-full flex gap-1 items-center pt-2">
                     <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                           size="lg"
                           className="h-8 p-1 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                           <div
                              className={`flex aspect-square size-6 items-center justify-center rounded bg-gradient-to-tr ${workspaceIcon} text-white text-xs font-bold shadow-sm`}
                           >
                              {initials}
                           </div>
                           <div className="grid flex-1 text-left text-sm leading-tight">
                              <span className="truncate font-semibold">{workspaceName}</span>
                           </div>
                           <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                        </SidebarMenuButton>
                     </DropdownMenuTrigger>

                     <ThemeToggle />

                     <Button
                        className="size-8 shrink-0"
                        variant="secondary"
                        size="icon"
                        onClick={() => openModal()}
                     >
                        <RiEditLine />
                     </Button>
                  </div>
                  <DropdownMenuContent
                     className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
                     side="bottom"
                     align="end"
                     sideOffset={4}
                  >
                     <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                           <Link href={ROUTES.WORKSPACE.SETTINGS(currentOrgId)}>
                              <Settings className="size-4 mr-2" />
                              Settings
                           </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                           <Link href={ROUTES.WORKSPACE.MEMBERS(currentOrgId)}>
                              <UserPlus className="size-4 mr-2" />
                              Invite and manage members
                           </Link>
                        </DropdownMenuItem>
                     </DropdownMenuGroup>
                     <DropdownMenuSeparator />
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                           <Sparkles className="size-4 mr-2 text-orange-500" />
                           Switch Workspace
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                           <DropdownMenuSubContent className="min-w-56">
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                                 {user?.email || 'workspace@circle.internal'}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Live Workspaces List */}
                              {workspaces && workspaces.length > 0 ? (
                                 workspaces.map((ws) => {
                                    const isCurrent =
                                       ws.slug === currentOrgId || ws.id === currentOrgId;
                                    const wsInitials = ws.name.slice(0, 2).toUpperCase();
                                    const wsGrad = ws.icon || 'from-orange-600 to-amber-500';

                                    return (
                                       <DropdownMenuItem
                                          key={ws.id}
                                          onClick={() => handleSelectWorkspace(ws.slug)}
                                          className="cursor-pointer flex items-center justify-between"
                                       >
                                          <div className="flex items-center gap-2 min-w-0">
                                             <div
                                                className={`flex aspect-square size-6 shrink-0 items-center justify-center rounded bg-gradient-to-tr ${wsGrad} text-white text-[10px] font-bold`}
                                             >
                                                {wsInitials}
                                             </div>
                                             <span className="truncate text-xs font-medium">
                                                {ws.name}
                                             </span>
                                          </div>
                                          {isCurrent && (
                                             <Check className="size-3.5 text-primary shrink-0 ml-2" />
                                          )}
                                       </DropdownMenuItem>
                                    );
                                 })
                              ) : (
                                 <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    {isLoading ? 'Loading workspaces...' : 'No workspaces found'}
                                 </div>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                 onClick={() => openCreateOrJoin('create')}
                                 className="cursor-pointer text-xs font-medium text-primary focus:text-primary"
                              >
                                 <Plus className="size-3.5 mr-2" />
                                 Create or join workspace
                              </DropdownMenuItem>
                           </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                     </DropdownMenuSub>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        onClick={() => logout()}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                     >
                        <LogOut className="size-4 mr-2" />
                        Log out
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </SidebarMenuItem>
         </SidebarMenu>

         <CreateOrJoinWorkspaceDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            defaultTab={defaultTab}
         />
      </>
   );
}

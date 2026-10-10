'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAddTeamMember, useTeam } from '@/hooks/queries/use-teams-query';
import { useMembers } from '@/hooks/queries/use-members-query';
import QueryErrorState from '@/components/common/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Team Home — "Members" tab: members of the current team with
 * their email and role.
 */
export default function TeamMembers() {
   const { teamId } = useParams<{ orgId: string; teamId: string }>();
   const { data: team, isLoading, isError, error, refetch } = useTeam(teamId);
   const { data: allMembers = [] } = useMembers();
   const currentUserId = useAuthStore((state) => state.user?.id);
   const addTeamMemberMutation = useAddTeamMember();
   const [addOpen, setAddOpen] = useState(false);

   if (isError) {
      return <QueryErrorState subject="team members" error={error} onRetry={() => refetch()} />;
   }

   if (isLoading || !team) {
      return (
         <div className="w-full px-6 py-4 space-y-3">
            {[1, 2, 3].map((i) => (
               <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
               </div>
            ))}
         </div>
      );
   }

   const members = [...team.members].sort((a, b) => a.name.localeCompare(b.name));
   const memberIds = new Set(members.map((m) => m.id));
   const addableMembers = allMembers.filter(
      (member) => member.id !== currentUserId && !memberIds.has(member.id)
   );

   const handleAddMember = (memberId: string) => {
      addTeamMemberMutation.mutate({ teamId, memberId });
      setAddOpen(false);
   };

   return (
      <div className="w-full">
         <div className="flex items-center justify-between px-6 py-3">
            <span className="text-sm text-muted-foreground font-medium">Name ↓</span>
            <div className="flex items-center gap-2">
               {team.canManageMembers && (
                  <Popover open={addOpen} onOpenChange={setAddOpen}>
                     <PopoverTrigger asChild>
                        <Button size="xs" variant="secondary">
                           <Plus className="size-4 mr-1" />
                           Add a member
                        </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-64 p-0" align="end">
                        <Command>
                           <CommandInput placeholder="Search members..." />
                           <CommandList>
                              <CommandEmpty>
                                 {addableMembers.length === 0
                                    ? 'All other members are already on this team.'
                                    : 'No members found.'}
                              </CommandEmpty>
                              <CommandGroup>
                                 {addableMembers.map((member) => (
                                    <CommandItem
                                       key={member.id}
                                       value={member.name}
                                       onSelect={() => handleAddMember(member.id)}
                                    >
                                       <Avatar className="size-5">
                                          <AvatarImage src={member.avatarUrl} alt={member.name} />
                                          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                       </Avatar>
                                       {member.name}
                                    </CommandItem>
                                 ))}
                              </CommandGroup>
                           </CommandList>
                        </Command>
                     </PopoverContent>
                  </Popover>
               )}
               <Button
                  size="xs"
                  variant="ghost"
                  disabled
                  aria-label="Member filters unavailable"
                  title="Member filters are not available in this deployment"
               >
                  <SlidersHorizontal className="size-4" />
               </Button>
            </div>
         </div>

         <div className="bg-container px-6 py-1.5 text-sm flex items-center text-muted-foreground border-b sticky top-0 z-10">
            <div className="w-[55%] md:w-[45%]">Name</div>
            <div className="hidden md:block md:w-[35%]">Email</div>
            <div className="w-[45%] md:w-[20%]">Role</div>
         </div>

         {members.map((member) => (
            <div
               key={member.id}
               className="w-full flex items-center px-6 h-12 hover:bg-sidebar/50 border-b border-border/30 text-sm"
            >
               <div className="w-[55%] md:w-[45%] flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-6 shrink-0">
                     <AvatarImage src={member.avatarUrl} alt={member.name} />
                     <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                     <span className="font-medium truncate">{member.name}</span>
                  </div>
               </div>
               <div className="hidden md:block md:w-[35%] text-muted-foreground truncate">
                  {member.email}
               </div>
               <div className="w-[45%] md:w-[20%]">
                  <span className="text-xs px-2 py-1 rounded-md bg-accent text-muted-foreground">
                     {member.role}
                  </span>
               </div>
            </div>
         ))}
      </div>
   );
}

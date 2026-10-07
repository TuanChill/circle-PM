'use client';

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
import { useIssuesStore } from '@/store/issues-store';
import { useMembers } from '@/hooks/queries/use-members-query';
import type { User } from '@/mock-data/users';
import { CheckIcon, UserCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AssigneeSelectorProps {
   assignee: User | null;
   onOpenChange?: (open: boolean) => void;
   onInteractionStart?: () => void;
   onChange: (assignee: User | null) => void;
}

export function AssigneeSelector({
   assignee,
   onOpenChange,
   onInteractionStart,
   onChange,
}: AssigneeSelectorProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string | null>(assignee?.id || null);

   const { filterByAssignee } = useIssuesStore();
   const { data: members = [] } = useMembers();

   const allMembers = members as unknown as User[];

   useEffect(() => {
      setValue(assignee?.id || null);
   }, [assignee]);

   const handleAssigneeChange = (userId: string) => {
      if (userId === 'unassigned') {
         setValue(null);
         onChange(null);
      } else {
         setValue(userId);
         const newAssignee = allMembers.find((u) => u.id === userId);
         if (newAssignee) {
            onChange(newAssignee);
         }
      }
      setOpen(false);
   };

   const selectedUser = allMembers.find((user) => user.id === value);

   return (
      <div className="*:not-first:mt-2">
         <Popover
            open={open}
            onOpenChange={(nextOpen) => {
               setOpen(nextOpen);
               onOpenChange?.(nextOpen);
            }}
         >
            <PopoverTrigger asChild>
               <Button
                  id={id}
                  className="flex items-center justify-center"
                  size="xs"
                  variant="secondary"
                  role="combobox"
                  aria-expanded={open}
               >
                  {value && selectedUser ? (
                     <Avatar className="size-5">
                        <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} />
                        <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                     </Avatar>
                  ) : (
                     <UserCircle className="size-5" />
                  )}
                  <span>{value && selectedUser ? selectedUser.name : 'Unassigned'}</span>
               </Button>
            </PopoverTrigger>
            <PopoverContent
               className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
               align="start"
               onPointerDownCapture={() => onInteractionStart?.()}
            >
               <Command>
                  <CommandInput placeholder="Assign to..." />
                  <CommandList>
                     <CommandEmpty>No users found.</CommandEmpty>
                     <CommandGroup>
                        <CommandItem
                           value="unassigned"
                           onSelect={() => handleAssigneeChange('unassigned')}
                           className="flex items-center justify-between"
                        >
                           <div className="flex items-center gap-2">
                              <UserCircle className="size-5" />
                              Unassigned
                           </div>
                           {value === null && <CheckIcon size={16} className="ml-auto" />}
                           <span className="text-muted-foreground text-xs">
                              {filterByAssignee(null).length}
                           </span>
                        </CommandItem>
                        {allMembers.map((user) => (
                           <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={() => handleAssigneeChange(user.id)}
                              className="flex items-center justify-between"
                           >
                              <div className="flex items-center gap-2">
                                 <Avatar className="size-5">
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                 </Avatar>
                                 {user.name}
                              </div>
                              {value === user.id && <CheckIcon size={16} className="ml-auto" />}
                              <span className="text-muted-foreground text-xs">
                                 {filterByAssignee(user.id).length}
                              </span>
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}

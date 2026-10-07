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
import { useProjects } from '@/hooks/queries/use-projects-query';
import type { Project } from '@/mock-data/projects';
import { Box, CheckIcon, FolderIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

interface ProjectSelectorProps {
   project: Project | undefined;
   onOpenChange?: (open: boolean) => void;
   onInteractionStart?: () => void;
   onChange: (project: Project | undefined) => void;
}

export function ProjectSelector({
   project,
   onOpenChange,
   onInteractionStart,
   onChange,
}: ProjectSelectorProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string | undefined>(project?.id);

   const { filterByProject } = useIssuesStore();
   const { data: projects = [] } = useProjects();

   const allProjects = projects;

   useEffect(() => {
      setValue(project?.id);
   }, [project]);

   const handleProjectChange = (projectId: string) => {
      if (projectId === 'no-project') {
         setValue(undefined);
         onChange(undefined);
      } else {
         setValue(projectId);
         const newProject = allProjects.find((p) => p.id === projectId);
         if (newProject) {
            onChange(newProject);
         }
      }
      setOpen(false);
   };

   const selectedProject = allProjects.find((p) => p.id === value);

   return (
      <div className="*:not-first:mt-2">
         <Popover
            modal
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
                  {value && selectedProject ? (
                     (() => {
                        const Icon = selectedProject.icon || Box;
                        return <Icon className="size-4" />;
                     })()
                  ) : (
                     <Box className="size-4" />
                  )}
                  <span>{value && selectedProject ? selectedProject.name : 'No project'}</span>
               </Button>
            </PopoverTrigger>
            <PopoverContent
               className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
               align="start"
               onPointerDownCapture={() => onInteractionStart?.()}
            >
               <Command>
                  <CommandInput placeholder="Set project..." />
                  <CommandList>
                     <CommandEmpty>No projects found.</CommandEmpty>
                     <CommandGroup>
                        <CommandItem
                           value="no-project"
                           onSelect={() => handleProjectChange('no-project')}
                           className="flex items-center justify-between"
                        >
                           <div className="flex items-center gap-2">
                              <FolderIcon className="size-4" />
                              No Project
                           </div>
                           {value === undefined && <CheckIcon size={16} className="ml-auto" />}
                        </CommandItem>
                        {allProjects.map((proj) => {
                           const Icon = proj.icon || Box;
                           return (
                              <CommandItem
                                 key={proj.id}
                                 value={proj.id}
                                 onSelect={() => handleProjectChange(proj.id)}
                                 className="flex items-center justify-between"
                              >
                                 <div className="flex items-center gap-2">
                                    <Icon className="size-4" />
                                    {proj.name}
                                 </div>
                                 {value === proj.id && <CheckIcon size={16} className="ml-auto" />}
                                 <span className="text-muted-foreground text-xs">
                                    {filterByProject(proj.id).length}
                                 </span>
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}

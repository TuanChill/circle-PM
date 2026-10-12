'use client';

import * as React from 'react';
import { BookOpen, HelpCircle, MessageSquare, Search } from 'lucide-react';

import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function HelpButton() {
   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               size="icon"
               variant="ghost"
               className="size-7 text-muted-foreground hover:text-foreground"
            >
               <HelpCircle className="size-4" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="start" className="w-56">
            <div className="p-2">
               <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                     type="search"
                     placeholder="Search documentation..."
                     className="pl-7 h-8 text-xs"
                  />
               </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
               Resources
            </DropdownMenuLabel>
            <DropdownMenuItem className="text-xs">
               <BookOpen className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
               <span>Documentation</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs">
               <MessageSquare className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
               <span>Send feedback</span>
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

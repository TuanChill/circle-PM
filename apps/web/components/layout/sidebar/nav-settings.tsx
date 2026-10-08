'use client';

import {
   SidebarGroup,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
   Bell,
   Blocks,
   Compass,
   FileText,
   Flame,
   HeartHandshake,
   KeyRound,
   LucideIcon,
   MessageCircleQuestion,
   Rocket,
   Settings,
   Smile,
   Tag,
   Target,
   UserRound,
   Users,
   Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { PLACEHOLDER_SECTIONS } from '@/components/common/settings/placeholder-sections';

interface SettingsNavItem {
   name: string;
   /** Path under /{orgId}. */
   url: string;
   icon: LucideIcon;
}

/** Keep unsupported settings out of the production navigation. */
const HIDDEN_SETTINGS_SECTIONS = new Set(Object.keys(PLACEHOLDER_SECTIONS));

interface SettingsNavGroup {
   label: string;
   items: SettingsNavItem[];
}

/** Linear-style settings navigation. */
export const settingsNav: SettingsNavGroup[] = [
   {
      label: 'Personal',
      items: [
         { name: 'Preferences', url: '/settings/preferences', icon: Settings },
         { name: 'Profile', url: '/settings/profile', icon: UserRound },
         { name: 'Notifications', url: '/settings/notifications', icon: Bell },
         // { name: 'Code & reviews', url: '/settings/code-and-reviews', icon: Code },
         { name: 'Security & access', url: '/settings/security', icon: KeyRound },
         { name: 'Connected accounts', url: '/settings/connected-accounts', icon: Users },
      ],
   },
   {
      label: 'Issues',
      items: [
         { name: 'Labels', url: '/settings/issue-labels', icon: Tag },
         { name: 'Templates', url: '/settings/issue-templates', icon: FileText },
         { name: 'SLAs', url: '/settings/slas', icon: Flame },
      ],
   },
   {
      label: 'Projects',
      items: [
         { name: 'Labels', url: '/settings/project-labels', icon: Tag },
         { name: 'Templates', url: '/settings/project-templates', icon: FileText },
         { name: 'Statuses', url: '/settings/project-statuses', icon: Target },
         { name: 'Updates', url: '/settings/project-updates', icon: Zap },
      ],
   },
   {
      label: 'Features',
      items: [
         { name: 'Initiatives', url: '/settings/initiatives', icon: Compass },
         { name: 'Documents', url: '/settings/documents', icon: FileText },
         { name: 'Customer requests', url: '/settings/customer-requests', icon: HeartHandshake },
         { name: 'Releases', url: '/settings/releases', icon: Rocket },
         { name: 'Pulse', url: '/settings/pulse', icon: Zap },
         { name: 'Asks', url: '/settings/asks', icon: MessageCircleQuestion },
         { name: 'Emojis', url: '/settings/emojis', icon: Smile },
         { name: 'Integrations', url: '/settings/integrations', icon: Blocks },
      ],
   },
];

export function NavSettings() {
   const { orgId } = useParams<{ orgId: string }>();
   const pathname = usePathname();

   return (
      <>
         {settingsNav.map((group) => {
            const visibleItems = group.items.filter(
               (item) => !HIDDEN_SETTINGS_SECTIONS.has(item.url.replace('/settings/', ''))
            );
            if (visibleItems.length === 0) return null;
            return (
               <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:hidden">
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarMenu>
                     {visibleItems.map((item) => {
                        const href = `/${orgId}${item.url}`;
                        const isActive = pathname === href;
                        return (
                           <SidebarMenuItem key={`${group.label}-${item.name}`}>
                              <SidebarMenuButton asChild isActive={isActive}>
                                 <Link href={href}>
                                    <item.icon className="size-4" />
                                    <span>{item.name}</span>
                                 </Link>
                              </SidebarMenuButton>
                           </SidebarMenuItem>
                        );
                     })}
                  </SidebarMenu>
               </SidebarGroup>
            );
         })}
      </>
   );
}

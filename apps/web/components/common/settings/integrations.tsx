'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSection, SettingsShell } from './shared';
import { larkIntegrationService } from '@/services/lark-integration.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const LARK_DOMAINS = [
   { label: 'Lark Global', value: 'https://open.larksuite.com' },
   { label: 'Feishu China', value: 'https://open.feishu.cn' },
];

export default function Integrations() {
   const { orgId } = useParams<{ orgId: string }>();
   const queryClient = useQueryClient();
   const query = useQuery({
      queryKey: ['workspace-lark-integration', orgId],
      queryFn: () => larkIntegrationService.get(orgId),
      enabled: Boolean(orgId),
   });
   const [appId, setAppId] = useState('');
   const [appSecret, setAppSecret] = useState('');
   const [domain, setDomain] = useState(LARK_DOMAINS[0].value);
   const [groupChatId, setGroupChatId] = useState('');
   const [enabled, setEnabled] = useState(false);
   const [openIds, setOpenIds] = useState<Record<string, string>>({});
   const [saveError, setSaveError] = useState('');
   const [saved, setSaved] = useState(false);

   useEffect(() => {
      const settings = query.data;
      if (!settings) return;
      setAppId(settings.appId);
      setDomain(settings.domain);
      setGroupChatId(settings.groupChatId);
      setEnabled(settings.enabled);
      setOpenIds(Object.fromEntries(settings.members.map((member) => [member.id, member.openId])));
   }, [query.data]);

   const mutation = useMutation({
      mutationFn: () =>
         larkIntegrationService.update(orgId, {
            appId: appId.trim(),
            ...(appSecret ? { appSecret } : {}),
            domain,
            groupChatId: groupChatId.trim(),
            enabled,
            memberMappings: (query.data?.members ?? []).map((member) => ({
               memberId: member.id,
               openId: openIds[member.id]?.trim() ?? '',
            })),
         }),
      onSuccess: async () => {
         setAppSecret('');
         setSaveError('');
         setSaved(true);
         await queryClient.invalidateQueries({ queryKey: ['workspace-lark-integration', orgId] });
      },
      onError: (error: Error) => {
         setSaved(false);
         setSaveError(error.message || 'Could not save the Lark settings.');
      },
   });

   function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setSaved(false);
      setSaveError('');
      mutation.mutate();
   }

   if (query.isLoading) {
      return (
         <SettingsShell title="Integrations" description="Loading workspace connections…">
            <p className="text-sm text-muted-foreground">Loading Lark settings…</p>
         </SettingsShell>
      );
   }

   if (query.isError || !query.data) {
      return (
         <SettingsShell
            title="Integrations"
            description="Workspace integrations are available to workspace owners and admins."
         >
            <p className="text-sm text-destructive">
               {query.error instanceof Error
                  ? query.error.message
                  : 'Could not load workspace integration settings.'}
            </p>
         </SettingsShell>
      );
   }

   return (
      <SettingsShell
         title="Integrations"
         description="Connect a Lark bot for assignment notices in this workspace."
      >
         <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <SettingsSection
               title="Lark bot"
               description="Issue assignments are sent to this workspace’s Lark group."
            >
               <label className="flex items-center gap-2 text-sm">
                  <input
                     type="checkbox"
                     checked={enabled}
                     onChange={(event) => setEnabled(event.target.checked)}
                  />
                  Enable assignment notifications
               </label>
               <label className="block text-sm font-medium">
                  Lark domain
                  <select
                     value={domain}
                     onChange={(event) => setDomain(event.target.value)}
                     className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                     {LARK_DOMAINS.map((option) => (
                        <option key={option.value} value={option.value}>
                           {option.label}
                        </option>
                     ))}
                  </select>
               </label>
               <label className="block text-sm font-medium">
                  App ID
                  <Input
                     className="mt-1"
                     value={appId}
                     onChange={(event) => setAppId(event.target.value)}
                     autoComplete="off"
                  />
               </label>
               <label className="block text-sm font-medium">
                  App Secret{' '}
                  {query.data.appSecretConfigured && (
                     <span className="font-normal text-muted-foreground">
                        (saved; leave blank to keep it)
                     </span>
                  )}
                  <Input
                     className="mt-1"
                     type="password"
                     value={appSecret}
                     onChange={(event) => setAppSecret(event.target.value)}
                     autoComplete="new-password"
                     placeholder={query.data.appSecretConfigured ? '••••••••••••' : ''}
                  />
               </label>
               <label className="block text-sm font-medium">
                  Group chat ID
                  <Input
                     className="mt-1"
                     value={groupChatId}
                     onChange={(event) => setGroupChatId(event.target.value)}
                     autoComplete="off"
                  />
               </label>
            </SettingsSection>

            <SettingsSection
               title="Member mentions"
               description="Add each Circle member’s Lark open_id from the same app/tenant. Names and email addresses are not used to guess identity."
            >
               {query.data.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                     No members are available in this workspace yet.
                  </p>
               ) : (
                  <div className="rounded-lg border divide-y divide-border/60">
                     {query.data.members.map((member) => (
                        <label
                           key={member.id}
                           className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr] sm:items-center"
                        >
                           <span className="min-w-0">
                              <span className="block font-medium">{member.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                 {member.email}
                              </span>
                           </span>
                           <Input
                              aria-label={`Lark open_id for ${member.name}`}
                              value={openIds[member.id] ?? ''}
                              onChange={(event) =>
                                 setOpenIds((current) => ({
                                    ...current,
                                    [member.id]: event.target.value,
                                 }))
                              }
                              placeholder="ou_…"
                              autoComplete="off"
                           />
                        </label>
                     ))}
                  </div>
               )}
            </SettingsSection>

            <SettingsSection title="Delivery status">
               <p className="text-sm text-muted-foreground">
                  {query.data.pendingDeliveries} waiting to send · {query.data.needsConfiguration}{' '}
                  waiting for workspace setup · {query.data.failedDeliveries} failed after retries
               </p>
            </SettingsSection>

            {saveError && (
               <p role="alert" className="text-sm text-destructive">
                  {saveError}
               </p>
            )}
            {saved && (
               <p role="status" className="text-sm text-emerald-600">
                  Lark workspace settings saved.
               </p>
            )}
            <div>
               <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Saving…' : 'Save settings'}
               </Button>
            </div>
         </form>
      </SettingsShell>
   );
}

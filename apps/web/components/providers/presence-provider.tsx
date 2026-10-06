'use client';

import * as React from 'react';
import { usePresenceHeartbeat } from '@/hooks/use-presence-heartbeat';
import { usePresenceStream } from '@/hooks/use-presence-stream';

interface PresenceProviderProps {
   workspaceId?: string;
   children: React.ReactNode;
}

export function PresenceProvider({ workspaceId, children }: PresenceProviderProps) {
   usePresenceHeartbeat(workspaceId);
   usePresenceStream(workspaceId);

   return <>{children}</>;
}

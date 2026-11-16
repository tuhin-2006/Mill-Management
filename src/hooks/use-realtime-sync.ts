"use client";

import * as React from "react";
import { useRealtime, RealtimeEntity } from "@/lib/realtime/realtime-provider";

/**
 * Subscribes the caller component to real-time sync events for specified entities.
 * Automatically cleans up subscription on unmount and triggers callback on remote changes.
 */
export function useRealtimeSync(
  entities: RealtimeEntity[],
  onSync: () => void | Promise<void>,
  enabled = true
) {
  const { subscribeToEntity } = useRealtime();
  const onSyncRef = React.useRef(onSync);
  onSyncRef.current = onSync;

  React.useEffect(() => {
    if (!enabled) return;

    return subscribeToEntity(entities, () => {
      if (onSyncRef.current) {
        void onSyncRef.current();
      }
    });
  }, [entities, enabled, subscribeToEntity]);
}

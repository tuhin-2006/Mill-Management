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
  const entitiesRef = React.useRef(entities);

  React.useEffect(() => {
    onSyncRef.current = onSync;
    entitiesRef.current = entities;
  });

  // Stable serialized key for entities array to avoid re-subscribing on every render
  const entitiesKey = React.useMemo(() => {
    return [...entities].sort().join(",");
  }, [entities]);

  React.useEffect(() => {
    if (!enabled) return;

    return subscribeToEntity(entitiesRef.current, () => {
      if (onSyncRef.current) {
        void onSyncRef.current();
      }
    });
  }, [entitiesKey, enabled, subscribeToEntity]);
}

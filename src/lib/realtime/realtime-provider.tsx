"use client";

import * as React from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { invalidateCache, onCacheInvalidated } from "@/lib/services";
import { UserRole } from "@/types";

export type RealtimeEntity = "meals" | "deposits" | "members" | "settings" | "aggregate" | "all";
export type RealtimeConnectionState = "connected" | "connecting" | "disconnected";

interface RealtimeContextValue {
  connectionState: RealtimeConnectionState;
  userRole: UserRole;
  memberId: string | null;
  broadcastGroupSync: () => void;
  triggerSync: (entity?: RealtimeEntity) => void;
  subscribeToEntity: (entities: RealtimeEntity[], callback: () => void) => () => void;
}

const RealtimeContext = React.createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: React.ReactNode;
  userRole?: UserRole;
  memberId?: string | null;
  userEmail?: string | null;
}

export function RealtimeProvider({
  children,
  userRole = "admin",
  memberId = null,
  userEmail,
}: RealtimeProviderProps) {
  const [connectionState, setConnectionState] = React.useState<RealtimeConnectionState>("connecting");
  const entityListenersRef = React.useRef<Map<RealtimeEntity, Set<() => void>>>(new Map());
  const debounceTimersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const broadcastChannelRef = React.useRef<RealtimeChannel | null>(null);

  // Initialize entity listener sets
  React.useEffect(() => {
    const map = entityListenersRef.current;
    if (!map.has("meals")) map.set("meals", new Set());
    if (!map.has("deposits")) map.set("deposits", new Set());
    if (!map.has("members")) map.set("members", new Set());
    if (!map.has("settings")) map.set("settings", new Set());
    if (!map.has("aggregate")) map.set("aggregate", new Set());
    if (!map.has("all")) map.set("all", new Set());
  }, []);

  // Debounced notification helper
  const notifyEntity = React.useCallback((entity: RealtimeEntity) => {
    const existingTimer = debounceTimersRef.current.get(entity);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      debounceTimersRef.current.delete(entity);

      // Invalidate in-memory caches relevant to this entity
      if (entity === "meals") {
        invalidateCache("meal");
        invalidateCache("period_ledger");
        invalidateCache("dashboard");
        invalidateCache("group_aggregate");
      } else if (entity === "deposits") {
        invalidateCache("deposit");
        invalidateCache("period_ledger");
        invalidateCache("dashboard");
        invalidateCache("group_aggregate");
      } else if (entity === "members") {
        invalidateCache("member");
        invalidateCache("dashboard");
      } else if (entity === "settings") {
        invalidateCache("settings");
      } else if (entity === "aggregate") {
        invalidateCache("group_aggregate");
      } else if (entity === "all") {
        invalidateCache();
      }

      // Notify registered subscribers
      const listeners = entityListenersRef.current.get(entity);
      if (listeners) {
        listeners.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            console.error(`Error in realtime subscriber callback for ${entity}:`, err);
          }
        });
      }

      // Also notify "all" subscribers
      if (entity !== "all") {
        const allListeners = entityListenersRef.current.get("all");
        if (allListeners) {
          allListeners.forEach((cb) => {
            try {
              cb();
            } catch (err) {
              console.error(`Error in realtime subscriber callback for all:`, err);
            }
          });
        }
      }
    }, 280); // 280ms debounce window prevents UI thrashing on batch updates

    debounceTimersRef.current.set(entity, timer);
  }, []);

  // Broadcast group sync to viewers without exposing any member identities or amounts
  const broadcastGroupSync = React.useCallback(() => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: "broadcast",
        event: "sync_aggregate",
        payload: { t: Date.now() },
      });
    }
  }, []);

  // Local sync trigger
  const triggerSync = React.useCallback((entity: RealtimeEntity = "all") => {
    notifyEntity(entity);
    if (userRole === "admin" && (entity === "meals" || entity === "deposits" || entity === "all")) {
      broadcastGroupSync();
    }
  }, [notifyEntity, userRole, broadcastGroupSync]);

  // Subscribe to entity changes helper
  const subscribeToEntity = React.useCallback((entities: RealtimeEntity[], callback: () => void) => {
    entities.forEach((ent) => {
      let set = entityListenersRef.current.get(ent);
      if (!set) {
        set = new Set();
        entityListenersRef.current.set(ent, set);
      }
      set.add(callback);
    });

    return () => {
      entities.forEach((ent) => {
        const set = entityListenersRef.current.get(ent);
        if (set) {
          set.delete(callback);
        }
      });
    };
  }, []);

  // Listen to in-memory cache invalidation events (e.g. from local service mutations)
  React.useEffect(() => {
    return onCacheInvalidated((prefix) => {
      if (!prefix) {
        notifyEntity("all");
      } else if (prefix.startsWith("meal")) {
        notifyEntity("meals");
      } else if (prefix.startsWith("deposit")) {
        notifyEntity("deposits");
      } else if (prefix.startsWith("member")) {
        notifyEntity("members");
      } else if (prefix.startsWith("settings")) {
        notifyEntity("settings");
      } else if (prefix.startsWith("group_aggregate")) {
        notifyEntity("aggregate");
      }
    });
  }, [notifyEntity]);

  // Establish Supabase Realtime Channels based on User Role
  React.useEffect(() => {
    const supabase = createClient();
    const channels: RealtimeChannel[] = [];
    setConnectionState("connecting");

    try {
      // 1. Group Broadcast Channel (For privacy-compliant aggregate sync)
      const groupBroadcastChannel = supabase.channel("group_aggregate_sync");
      groupBroadcastChannel
        .on("broadcast", { event: "sync_aggregate" }, () => {
          notifyEntity("aggregate");
          notifyEntity("meals");
          notifyEntity("deposits");
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            setConnectionState("connected");
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnectionState("disconnected");
          }
        });

      broadcastChannelRef.current = groupBroadcastChannel;
      channels.push(groupBroadcastChannel);

      // 2. Role-specific Subscriptions
      if (userRole === "admin") {
        // ADMIN: Receives all authorized management updates
        const adminChannel = supabase.channel("admin_realtime_sync");

        adminChannel
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "meal_entries" },
            () => {
              notifyEntity("meals");
              broadcastGroupSync();
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "deposits" },
            () => {
              notifyEntity("deposits");
              broadcastGroupSync();
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "members" },
            () => {
              notifyEntity("members");
            }
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "settings" },
            () => {
              notifyEntity("settings");
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setConnectionState("connected");
            }
          });

        channels.push(adminChannel);
      } else if (userRole === "member") {
        // MEMBER: Receives only their own authorized records
        const memberChannelName = `member_sync_${memberId || userEmail || "me"}`;
        const memberChannel = supabase.channel(memberChannelName);

        if (memberId) {
          // Strictly filtered by member_id
          memberChannel
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "meal_entries",
                filter: `member_id=eq.${memberId}`,
              },
              () => {
                notifyEntity("meals");
              }
            )
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "deposits",
                filter: `member_id=eq.${memberId}`,
              },
              () => {
                notifyEntity("deposits");
              }
            )
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "members",
                filter: `id=eq.${memberId}`,
              },
              () => {
                notifyEntity("members");
              }
            );
        }

        // Global settings (meal pricing changes affect all members)
        memberChannel
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "settings" },
            () => {
              notifyEntity("settings");
              notifyEntity("meals");
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setConnectionState("connected");
            }
          });

        channels.push(memberChannel);
      } else if (userRole === "group_ledger_viewer") {
        // GROUP_LEDGER_VIEWER:
        // STRICT PRIVACY: NEVER subscribes to raw individual rows.
        // Listens ONLY to the broadcast signal or settings updates.
        const viewerChannel = supabase.channel("viewer_settings_sync");
        viewerChannel
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "settings" },
            () => {
              notifyEntity("settings");
              notifyEntity("aggregate");
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setConnectionState("connected");
            }
          });

        channels.push(viewerChannel);
      }
    } catch (err) {
      console.error("Realtime subscription initialization error:", err);
      setConnectionState("disconnected");
    }

    // Cleanup channels on unmount or user change
    return () => {
      broadcastChannelRef.current = null;
      channels.forEach((ch) => {
        try {
          supabase.removeChannel(ch);
        } catch {
          // ignore cleanup errors
        }
      });
    };
  }, [userRole, memberId, userEmail, notifyEntity, broadcastGroupSync]);

  const value = React.useMemo<RealtimeContextValue>(
    () => ({
      connectionState,
      userRole,
      memberId,
      broadcastGroupSync,
      triggerSync,
      subscribeToEntity,
    }),
    [connectionState, userRole, memberId, broadcastGroupSync, triggerSync, subscribeToEntity]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = React.useContext(RealtimeContext);
  if (!ctx) {
    // Return safe fallback if rendered outside provider
    return {
      connectionState: "disconnected",
      userRole: "admin",
      memberId: null,
      broadcastGroupSync: () => {},
      triggerSync: () => {},
      subscribeToEntity: () => () => {},
    };
  }
  return ctx;
}

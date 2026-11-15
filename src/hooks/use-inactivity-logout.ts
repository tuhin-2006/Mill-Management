"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { invalidateCache } from "@/lib/services";

interface UseInactivityLogoutOptions {
  timeoutMs?: number; // default: 15 minutes = 900,000 ms
  warningMs?: number; // default: 60 seconds before timeout = 60,000 ms
  enabled?: boolean;
}

export function useInactivityLogout({
  timeoutMs = 15 * 60 * 1000, // 15 minutes
  warningMs = 60 * 1000,       // 1 minute warning
  enabled = true,
}: UseInactivityLogoutOptions = {}) {
  const router = useRouter();
  const warningToastIdRef = useRef<string | number | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimersRef = useRef<() => void>(() => {});

  const performLogout = useCallback(async () => {
    try {
      if (warningToastIdRef.current) {
        toast.dismiss(warningToastIdRef.current);
      }
      invalidateCache();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login?reason=timeout");
      router.refresh();
    } catch (e) {
      console.error("Auto logout error:", e);
      router.push("/login?reason=timeout");
    }
  }, [router]);

  const resetTimers = useCallback(() => {
    if (warningToastIdRef.current) {
      toast.dismiss(warningToastIdRef.current);
      warningToastIdRef.current = null;
    }

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    if (!enabled) return;

    // Set warning timer (14 minutes)
    const timeUntilWarning = timeoutMs - warningMs;
    if (timeUntilWarning > 0) {
      warningTimerRef.current = setTimeout(() => {
        warningToastIdRef.current = toast.warning(
          "নিষ্ক্রিয়তার সতর্কতা: আপনার সেশন ১ মিনিটের মধ্যে বন্ধ হয়ে যাবে।",
          {
            description: "সেশন সক্রিয় রাখতে স্ক্রিনে যেকোনো স্থানে ক্লিক করুন।",
            duration: warningMs,
            action: {
              label: "সক্রিয় রাখুন",
              onClick: () => {
                resetTimersRef.current();
              },
            },
          }
        );
      }, timeUntilWarning);
    }

    // Set auto-logout timer (15 minutes)
    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningMs, performLogout]);

  useEffect(() => {
    resetTimersRef.current = resetTimers;
  }, [resetTimers]);

  useEffect(() => {
    if (!enabled) return;

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          resetTimers();
        }, 1000);
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    // Initial setup
    resetTimers();

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [enabled, resetTimers]);
}

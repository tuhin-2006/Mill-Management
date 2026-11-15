import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getSettings, updateSettings } from "@/lib/services";

export async function POST(req: Request) {
  try {
    // 1. Verify caller is authenticated Admin
    const supabase = await createServerClient();
    const callerProfile = await getCurrentUserProfile(supabase);

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can control email reporting." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, autoEmailEnabled, targetEmail } = body as {
      action?: "toggle_auto_email" | "test_preview" | "manual_dispatch";
      autoEmailEnabled?: boolean;
      targetEmail?: string;
    };

    // Action A: Toggle Automatic Sending Switch (ON / OFF)
    if (action === "toggle_auto_email") {
      const nextState = Boolean(autoEmailEnabled);
      await updateSettings(supabase, { auto_email_enabled: nextState });

      return NextResponse.json({
        success: true,
        auto_email_enabled: nextState,
        message: nextState
          ? "Automatic weekly email reporting is now ENABLED. Reports will send every Friday at 8:00 PM."
          : "Automatic weekly email reporting is now PAUSED (Safety Lock Active).",
      });
    }

    // Action B: Fetch preview test payload from Supabase Edge Function
    if (action === "test_preview") {
      const functionUrl = "https://hnmvuopdpubdlsveojrq.supabase.co/functions/v1/hyper-action";
      const sharedSecret = "mill_sec_9e21a4f08c3d7b6a12e5f804";

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-secret": sharedSecret,
        },
        body: JSON.stringify({
          action: "test",
          testRecipient: targetEmail || "mdmostofarahmantuhin2001@gmail.com",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Edge Function returned an error");
      }

      return NextResponse.json({
        success: true,
        message: "Test reports generated successfully.",
        reports: data.reports,
      });
    }

    // Action C: Prepare manual reports
    if (action === "manual_dispatch") {
      const functionUrl = "https://hnmvuopdpubdlsveojrq.supabase.co/functions/v1/hyper-action";
      const sharedSecret = "mill_sec_9e21a4f08c3d7b6a12e5f804";

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-secret": sharedSecret,
        },
        body: JSON.stringify({
          action: "prepare",
          isManualRun: true,
          force: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Edge Function returned an error");
      }

      return NextResponse.json({
        success: true,
        message: `Prepared ${data.reports?.length || 0} reports for dispatch.`,
        reportsCount: data.reports?.length || 0,
        period: data.period,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, updateSettings } from "@/lib/services";

const EDGE_FUNCTION_URL =
  process.env.SUPABASE_FUNCTION_URL ||
  "https://hnmvuopdpubdlsveojrq.supabase.co/functions/v1/hyper-action";

const GAS_WEBAPP_URL =
  process.env.GAS_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbwzIV8bQDk50rjvWV0QOw-hdw1P-13F6f4b7gwr2E5Rn8TzTmVtfd6mGAUMF9-oq8Xu4A/exec";

const REPORT_SHARED_SECRET =
  process.env.REPORT_SHARED_SECRET || "mill_sec_9e21a4f08c3d7b6a12e5f804";

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
    const { action, autoEmailEnabled, targetEmail, memberId, startDate, endDate, force } = body as {
      action?: "toggle_auto_email" | "test_preview" | "manual_dispatch" | "single_member_statement";
      autoEmailEnabled?: boolean;
      targetEmail?: string;
      memberId?: string;
      startDate?: string;
      endDate?: string;
      force?: boolean;
    };

    // Action A: Toggle Automatic Sending Switch (ON / OFF)
    if (action === "toggle_auto_email") {
      const nextState = Boolean(autoEmailEnabled);
      await updateSettings(supabase, { auto_email_enabled: nextState });

      return NextResponse.json({
        success: true,
        auto_email_enabled: nextState,
        message: nextState
          ? "Automatic weekly email reporting is now ENABLED."
          : "Automatic weekly email reporting is now PAUSED (Safety Lock Active).",
      });
    }

    // Action B: Send Test Email via Google Apps Script (MailApp) & return preview payload
    if (action === "test_preview") {
      const recipient = (targetEmail || "mdmostofarahmantuhin2001@gmail.com").trim();

      // 1. Generate preview data from Supabase Edge Function
      let previewReports: any[] = [];
      let periodInfo: any = {};
      try {
        const edgeRes = await fetch(EDGE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-report-secret": REPORT_SHARED_SECRET,
          },
          body: JSON.stringify({
            action: "test",
            testRecipient: recipient,
          }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          previewReports = edgeData.reports || [];
          periodInfo = edgeData.period || {};
        }
      } catch (edgeErr) {
        console.warn("Edge function preview fetch warning:", edgeErr);
      }

      // 2. Dispatch real test email via Google Apps Script MailApp
      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "test_preview",
          targetEmail: recipient,
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));

      // 3. Log test delivery in email_logs
      await supabase.from("email_logs").insert({
        report_period_start: periodInfo?.startDate || new Date().toISOString().slice(0, 10),
        report_period_end: periodInfo?.endDate || new Date().toISOString().slice(0, 10),
        recipient_type: "test",
        recipient_email: recipient,
        status: gasRes.ok && (gasData.success !== false) ? "sent" : "failed",
        metadata: {
          is_test: true,
          gas_response: gasData,
          generated_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Test email dispatched directly to ${recipient} via Gmail.`,
        reports: previewReports,
        gasResult: gasData,
      });
    }

    // Action C: Single Member Statement On-Demand Dispatch
    if (action === "single_member_statement") {
      if (!memberId) {
        return NextResponse.json({ error: "Missing required parameter 'memberId'." }, { status: 400 });
      }

      // 1. Prepare exact statement payload from Edge Function
      const edgeRes = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-secret": REPORT_SHARED_SECRET,
        },
        body: JSON.stringify({
          action: "prepare",
          memberId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          isManualRun: true,
          force: true,
        }),
      });

      const data = await edgeRes.json();
      if (!edgeRes.ok) {
        throw new Error(data.error || "Edge Function returned an error preparing statement");
      }

      const report = data.reports?.[0];
      if (!report || !report.recipient_email) {
        throw new Error("No report generated. Please check that the member has a valid email address configured.");
      }

      // 2. Dispatch email directly via Google Apps Script MailApp
      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_single_email",
          to: report.recipient_email,
          subject: report.subject,
          htmlBody: report.htmlBody,
          senderName: "Mill Management System",
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));
      const isSent = gasRes.ok && gasData.success !== false;

      // 3. Log single statement dispatch to public.email_logs
      await supabase.from("email_logs").insert({
        report_period_start: data.period?.startDate || startDate || new Date().toISOString().slice(0, 10),
        report_period_end: data.period?.endDate || endDate || new Date().toISOString().slice(0, 10),
        recipient_type: "member",
        recipient_email: report.recipient_email,
        member_id: memberId,
        status: isSent ? "sent" : "failed",
        error_message: isSent ? null : JSON.stringify(gasData),
        metadata: {
          is_on_demand: true,
          member_name: report.member_name,
          totalWeeklyMeals: report.metadata?.totalWeeklyMeals,
          totalWeeklyCost: report.metadata?.totalWeeklyCost,
          currentBalance: report.metadata?.currentBalance,
          gas_response: gasData,
        },
      });

      if (!isSent) {
        throw new Error(`Gmail delivery failed: ${gasData.error || "Google Apps Script rejected the delivery request"}`);
      }

      return NextResponse.json({
        success: true,
        message: `Statement for ${report.member_name} (${report.recipient_email}) delivered successfully via Gmail.`,
        report,
      });
    }

    // Action D: Prepare and dispatch weekly reports to all members & viewer
    if (action === "manual_dispatch") {
      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_weekly",
          force: Boolean(force),
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));

      if (!gasRes.ok || gasData.success === false) {
        throw new Error(gasData.error || "Google Apps Script reported an error during dispatch.");
      }

      const result = gasData.result || {};

      return NextResponse.json({
        success: true,
        message: `Weekly report dispatch completed: ${result.sentCount ?? 0} sent, ${result.skippedCount ?? 0} skipped, ${result.failedCount ?? 0} failed.`,
        result,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

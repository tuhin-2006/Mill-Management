import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getSettings, updateSettings } from "@/lib/services";

const EDGE_FUNCTION_URL = "https://hnmvuopdpubdlsveojrq.supabase.co/functions/v1/hyper-action";
const REPORT_SHARED_SECRET = "mill_sec_9e21a4f08c3d7b6a12e5f804";

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

    // Action B: Fetch preview test payload from Supabase Edge Function
    if (action === "test_preview") {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-secret": REPORT_SHARED_SECRET,
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

      // Log test delivery in email_logs
      await supabase.from("email_logs").insert({
        report_period_start: data.period?.startDate || new Date().toISOString().slice(0, 10),
        report_period_end: data.period?.endDate || new Date().toISOString().slice(0, 10),
        recipient_type: "test",
        recipient_email: targetEmail || "mdmostofarahmantuhin2001@gmail.com",
        status: "sent",
        metadata: { is_test: true, generated_at: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: "Test reports generated successfully.",
        reports: data.reports,
      });
    }

    // Action C: Single Member Statement On-Demand Dispatch
    if (action === "single_member_statement") {
      if (!memberId) {
        return NextResponse.json({ error: "Missing required parameter 'memberId'." }, { status: 400 });
      }

      const res = await fetch(EDGE_FUNCTION_URL, {
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Edge Function returned an error preparing statement");
      }

      const report = data.reports?.[0];
      if (!report) {
        throw new Error("No report generated. Please check that the member has an email configured.");
      }

      // Log single statement dispatch to public.email_logs
      await supabase.from("email_logs").insert({
        report_period_start: data.period?.startDate || startDate || new Date().toISOString().slice(0, 10),
        report_period_end: data.period?.endDate || endDate || new Date().toISOString().slice(0, 10),
        recipient_type: "member",
        recipient_email: report.recipient_email,
        member_id: memberId,
        status: "sent",
        metadata: {
          is_on_demand: true,
          member_name: report.member_name,
          totalWeeklyMeals: report.metadata?.totalWeeklyMeals,
          totalWeeklyCost: report.metadata?.totalWeeklyCost,
          currentBalance: report.metadata?.currentBalance,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Statement for ${report.member_name} (${report.recipient_email}) prepared and logged successfully.`,
        report,
      });
    }

    // Action D: Prepare and dispatch weekly reports
    if (action === "manual_dispatch") {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-secret": REPORT_SHARED_SECRET,
        },
        body: JSON.stringify({
          action: "prepare",
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          isManualRun: true,
          force: Boolean(force),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Edge Function returned an error");
      }

      const preparedList = data.reports || [];

      // Log all prepared reports into email_logs
      if (preparedList.length > 0) {
        const logEntries = preparedList.map((r: any) => ({
          report_period_start: data.period?.startDate,
          report_period_end: data.period?.endDate,
          recipient_type: r.recipient_type,
          recipient_email: r.recipient_email,
          member_id: r.member_id || null,
          status: r.is_duplicate ? "skipped_duplicate" : "sent",
          metadata: {
            member_name: r.member_name,
            totalWeeklyMeals: r.metadata?.totalWeeklyMeals,
            totalWeeklyCost: r.metadata?.totalWeeklyCost,
            currentBalance: r.metadata?.currentBalance,
          },
        }));

        await supabase.from("email_logs").insert(logEntries);
      }

      return NextResponse.json({
        success: true,
        message: `Prepared and recorded ${preparedList.length} reports for dispatch.`,
        reportsCount: preparedList.length,
        period: data.period,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

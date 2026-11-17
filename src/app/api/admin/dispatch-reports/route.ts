import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, updateSettings } from "@/lib/services";
import {
  renderMemberStatementHtml,
  renderMemberStatementText,
  getDayName,
  formatReadableDate,
  formatMonthYearBangla,
  StatementDailyItem,
} from "@/lib/email-statement";
import { formatBDT, getTodayInDhaka } from "@/lib/date";

const GAS_WEBAPP_URL =
  process.env.GAS_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbwzIV8bQDk50rjvWV0QOw-hdw1P-13F6f4b7gwr2E5Rn8TzTmVtfd6mGAUMF9-oq8Xu4A/exec";

const REPORT_SHARED_SECRET =
  process.env.REPORT_SHARED_SECRET || "mill_sec_9e21a4f08c3d7b6a12e5f804";

// Calculate Saturday to Friday weekly cycle in Asia/Dhaka
function getWeeklyPeriod(targetDateStr?: string): { startDate: string; endDate: string } {
  const todayDhaka = targetDateStr || getTodayInDhaka();
  const [y, m, d] = todayDhaka.split("-").map(Number);
  const baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = baseDate.getUTCDay(); // 0 = Sun, ..., 5 = Fri, 6 = Sat

  const diffToFriday = 5 - dayOfWeek;
  const endDateObj = new Date(baseDate.getTime() + diffToFriday * 86400000);
  const startDateObj = new Date(endDateObj.getTime() - 6 * 86400000);

  const endStr = `${endDateObj.getUTCFullYear()}-${String(endDateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(endDateObj.getUTCDate()).padStart(2, "0")}`;
  const startStr = `${startDateObj.getUTCFullYear()}-${String(startDateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(startDateObj.getUTCDate()).padStart(2, "0")}`;

  return { startDate: startStr, endDate: endStr };
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

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
    const {
      action,
      autoEmailEnabled,
      targetEmail,
      memberId,
      periodType = "this_month",
      month,
      year,
      startDate: rawStartDate,
      endDate: rawEndDate,
      force,
      previewOnly,
      logId,
      clearMode = "all",
    } = body as {
      action?:
        | "toggle_auto_email"
        | "test_preview"
        | "manual_dispatch"
        | "single_member_statement"
        | "delete_single_log"
        | "clear_email_logs";
      autoEmailEnabled?: boolean;
      targetEmail?: string;
      memberId?: string;
      periodType?: "all" | "month" | "week" | "custom" | "this_month" | "last_month" | "this_week";
      month?: number;
      year?: number;
      startDate?: string;
      endDate?: string;
      force?: boolean;
      previewOnly?: boolean;
      logId?: string;
      clearMode?: "all" | "failed_or_skipped" | "older_than_30_days";
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

    // Action B: Send Test Email via Google Apps Script (MailApp)
    if (action === "test_preview") {
      const recipient = (targetEmail || callerProfile.email || "mdmostofarahmantuhin2001@gmail.com").trim();

      const testData = {
        periodType: "week" as const,
        periodTitle: "সাপ্তাহিক মিল ও ব্যালেন্স বিবরণী [টেস্ট]",
        periodSubtitle: "সাপ্তাহিক মিল ও ব্যালেন্স বিবরণী (Test Preview)",
        startDate: getTodayInDhaka(),
        endDate: getTodayInDhaka(),
        memberName: "Administrator Preview",
        recipientEmail: recipient,
        dailyBreakdown: [
          {
            date: getTodayInDhaka(),
            dayName: getDayName(getTodayInDhaka()),
            lunch: 1,
            dinner: 1,
            totalMeals: 2,
            cost: 120,
          },
        ],
        totalPeriodMeals: 2,
        totalPeriodCost: 120,
        totalPeriodDeposits: 500,
        lifetimeDeposits: 2000,
        lifetimeCost: 1200,
        currentBalance: 800,
        appName: "Mill Manager [TEST PREVIEW]",
      };

      const testHtml = renderMemberStatementHtml(testData);
      const testText = renderMemberStatementText(testData);

      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_single_email",
          to: recipient,
          subject: `[Mill Manager TEST] Email Delivery Verification: ${getTodayInDhaka()}`,
          body: testText,
          htmlBody: testHtml,
          senderName: "Mill Manager System",
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));
      const isSent = gasRes.ok && gasData.success !== false;

      // Log test delivery in email_logs
      await supabase.from("email_logs").insert({
        report_period_start: getTodayInDhaka(),
        report_period_end: getTodayInDhaka(),
        recipient_type: "test",
        recipient_email: recipient,
        status: isSent ? "sent" : "failed",
        metadata: {
          is_test: true,
          gas_response: gasData,
          generated_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: isSent,
        message: isSent
          ? `Test email dispatched to ${recipient} via Gmail! If not visible in Inbox, please check the Spam or Promotions folder.`
          : `Failed to deliver test email: ${gasData.error || "GAS error"}`,
        gasResult: gasData,
      });
    }

    // Action C: Single Member Statement On-Demand Dispatch (FAST & DIRECT)
    if (action === "single_member_statement") {
      if (!memberId) {
        return NextResponse.json({ error: "Missing required parameter 'memberId'." }, { status: 400 });
      }

      // Fetch member, settings, meals, deposits, and adjustments in parallel directly from database
      const [memberRes, settingsRes, mealsRes, depositsRes, adjustmentsRes] = await Promise.all([
        supabase.from("members").select("*").eq("id", memberId).single(),
        supabase.from("settings").select("*").eq("id", 1).single(),
        supabase.from("meal_entries").select("*").eq("member_id", memberId).order("meal_date", { ascending: true }),
        supabase.from("deposits").select("*").eq("member_id", memberId).order("deposit_date", { ascending: true }),
        supabase.from("adjustments").select("*").eq("member_id", memberId).order("adjustment_date", { ascending: true }),
      ]);

      if (memberRes.error || !memberRes.data) {
        return NextResponse.json({ error: `Member not found: ${memberRes.error?.message}` }, { status: 404 });
      }

      const member = memberRes.data;
      const settings = settingsRes.data || { app_name: "Mill Manager" };
      const recipientEmail = (targetEmail || member.email || "").trim();

      if (!previewOnly && !recipientEmail) {
        return NextResponse.json(
          { error: `Member "${member.name}" does not have an email address configured. Please provide an email address.` },
          { status: 400 }
        );
      }

      // If a new or updated email was provided for the member, persist it so future dispatches work seamlessly
      if (targetEmail && targetEmail.trim() !== (member.email || "").trim()) {
        await supabase.from("members").update({ email: targetEmail.trim() }).eq("id", member.id);
      }

      const meals = mealsRes.data || [];
      const deposits = depositsRes.data || [];
      const adjustments = adjustmentsRes.data || [];

      // Determine date range and labels based on periodType
      let startDate = rawStartDate || "";
      let endDate = rawEndDate || "";
      let resolvedType: "all" | "month" | "week" | "custom" = "custom";
      let periodTitle = "মেস মিল ও ব্যালেন্স বিবরণী";
      let periodSubtitle = "ব্যক্তিগত মিল ও জমার খতিয়ান";
      let subject = "";

      const today = getTodayInDhaka();
      const [currentYearStr, currentMonthStr] = today.split("-");
      const currentYear = parseInt(currentYearStr, 10);
      const currentMonth = parseInt(currentMonthStr, 10);

      if (periodType === "all") {
        resolvedType = "all";
        // Find earliest transaction date
        const allDates = [
          ...meals.map((m) => m.meal_date),
          ...deposits.map((d) => d.deposit_date),
          ...adjustments.map((a) => a.adjustment_date),
        ].sort();
        startDate = allDates[0] || `${currentYear}-01-01`;
        endDate = today;
        periodTitle = "সার্বিক মেস হিসাব বিবরণী (All-Time Complete Statement)";
        periodSubtitle = "মেসে যোগদানের পর থেকে অদ্যাবধি সর্বমোট হিসাব বিবরণী";
      } else if (periodType === "month" || (month && year)) {
        resolvedType = "month";
        const targetYear = year || currentYear;
        const targetMonth = month || currentMonth;
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
        endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const monthLabel = formatMonthYearBangla(targetYear, targetMonth);
        periodTitle = `মাসিক মিল ও ব্যালেন্স বিবরণী — ${monthLabel}`;
        periodSubtitle = `${monthLabel} মাসের সম্পূর্ণ মেস হিসাব বিবরণী`;
      } else if (periodType === "this_month") {
        resolvedType = "month";
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
        endDate = today; // up to today for current month
        const monthLabel = formatMonthYearBangla(currentYear, currentMonth);
        periodTitle = `মাসিক মিল ও ব্যালেন্স বিবরণী — ${monthLabel}`;
        periodSubtitle = `${monthLabel} মাসের বর্তমান তারিখ পর্যন্ত হিসাব`;
      } else if (periodType === "last_month") {
        resolvedType = "month";
        let lastM = currentMonth - 1;
        let lastY = currentYear;
        if (lastM < 1) {
          lastM = 12;
          lastY -= 1;
        }
        const lastDay = new Date(lastY, lastM, 0).getDate();
        startDate = `${lastY}-${String(lastM).padStart(2, "0")}-01`;
        endDate = `${lastY}-${String(lastM).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const monthLabel = formatMonthYearBangla(lastY, lastM);
        periodTitle = `মাসিক মিল ও ব্যালেন্স বিবরণী — ${monthLabel}`;
        periodSubtitle = `${monthLabel} মাসের সম্পূর্ণ মেস হিসাব বিবরণী`;
      } else if (periodType === "week" || periodType === "this_week") {
        resolvedType = "week";
        const weekly = getWeeklyPeriod(today);
        startDate = weekly.startDate;
        endDate = weekly.endDate;
        periodTitle = "সাপ্তাহিক মিল ও ব্যালেন্স বিবরণী (Weekly Statement)";
        periodSubtitle = `সাপ্তাহিক হিসাব: ${formatReadableDate(startDate)} থেকে ${formatReadableDate(endDate)}`;
      } else {
        resolvedType = "custom";
        if (!startDate || !endDate) {
          startDate = startDate || `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
          endDate = endDate || today;
        }
        periodTitle = "মেস হিসাব বিবরণী (Custom Statement)";
        periodSubtitle = `হিসাবের সময়কাল: ${formatReadableDate(startDate)} থেকে ${formatReadableDate(endDate)}`;
      }

      // Build daily breakdown
      const datesInRange = getDateRange(startDate, endDate);
      const dailyBreakdown: StatementDailyItem[] = datesInRange.map((date) => {
        const dayMeals = meals.filter((m) => m.meal_date === date && m.quantity > 0);
        let lunch = 0;
        let dinner = 0;
        let cost = 0;

        for (const m of dayMeals) {
          const qty = Number(m.quantity) || 0;
          const price = Number(m.unit_price) || 0;
          if (m.session === "lunch") lunch += qty;
          if (m.session === "dinner") dinner += qty;
          cost += qty * price;
        }

        return {
          date,
          dayName: getDayName(date),
          lunch,
          dinner,
          totalMeals: lunch + dinner,
          cost,
        };
      });

      const totalPeriodMeals = dailyBreakdown.reduce((acc, r) => acc + r.totalMeals, 0);
      const totalPeriodCost = dailyBreakdown.reduce((acc, r) => acc + r.cost, 0);

      // Period deposits and adjustments
      const totalPeriodDeposits = deposits
        .filter((d) => (!startDate || d.deposit_date >= startDate) && (!endDate || d.deposit_date <= endDate))
        .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

      const totalPeriodAdjustments = adjustments
        .filter((a) => (!startDate || a.adjustment_date >= startDate) && (!endDate || a.adjustment_date <= endDate))
        .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

      // Lifetime financials (up to endDate) including initial balance adjustments
      const lifetimeDeposits = deposits
        .filter((d) => !endDate || d.deposit_date <= endDate)
        .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

      const lifetimeAdjustments = adjustments
        .filter((a) => !endDate || a.adjustment_date <= endDate)
        .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

      const lifetimeCost = meals
        .filter((m) => (!endDate || m.meal_date <= endDate) && m.quantity > 0)
        .reduce((acc, m) => acc + (Number(m.quantity) || 0) * (Number(m.unit_price) || 0), 0);

      // Balance strictly includes initial / previous balance: deposits + adjustments - cost
      const currentBalance = lifetimeDeposits + lifetimeAdjustments - lifetimeCost;
      const initialBalance = lifetimeAdjustments;

      // Subject line
      if (resolvedType === "all") {
        subject = `[${settings.app_name || "Mill Manager"}] সার্বিক হিসাব বিবরণী - ${member.name} (ব্যালেন্স: ${formatBDT(currentBalance)})`;
      } else if (resolvedType === "month") {
        subject = `[${settings.app_name || "Mill Manager"}] মাসিক মিল বিবরণী: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)} (${member.name})`;
      } else if (resolvedType === "week") {
        subject = `[${settings.app_name || "Mill Manager"}] সাপ্তাহিক মিল বিবরণী: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)} (${member.name})`;
      } else {
        subject = `[${settings.app_name || "Mill Manager"}] মেস হিসাব বিবরণী: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)} (${member.name})`;
      }

      // Generate HTML & Plain Text with initial / previous balance support
      const statementParams = {
        periodType: resolvedType,
        periodTitle,
        periodSubtitle,
        startDate,
        endDate,
        memberName: member.name,
        recipientEmail,
        dailyBreakdown,
        totalPeriodMeals,
        totalPeriodCost,
        totalPeriodDeposits,
        initialBalance,
        lifetimeDeposits,
        lifetimeCost,
        currentBalance,
        appName: settings.app_name || "Mill Manager",
      };

      const htmlBody = renderMemberStatementHtml(statementParams);
      const textBody = renderMemberStatementText(statementParams);

      // If user only requested a preview, return without dispatching
      if (previewOnly) {
        return NextResponse.json({
          success: true,
          preview: {
            memberId: member.id,
            memberName: member.name,
            recipientEmail,
            periodType: resolvedType,
            startDate,
            endDate,
            subject,
            totalPeriodMeals,
            totalPeriodCost,
            totalPeriodDeposits,
            initialBalance,
            currentBalance,
            htmlBody,
            textBody,
          },
        });
      }

      // Dispatch directly via Google Apps Script MailApp
      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_single_email",
          to: recipientEmail,
          subject,
          body: textBody,
          htmlBody,
          senderName: settings.app_name || "Mill Management System",
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));
      const isSent = gasRes.ok && gasData.success !== false;

      // Log dispatch to public.email_logs
      await supabase.from("email_logs").insert({
        report_period_start: startDate,
        report_period_end: endDate,
        recipient_type: "member",
        recipient_email: recipientEmail,
        member_id: member.id,
        status: isSent ? "sent" : "failed",
        error_message: isSent ? null : JSON.stringify(gasData),
        metadata: {
          periodType: resolvedType,
          member_name: member.name,
          totalMeals: totalPeriodMeals,
          totalCost: totalPeriodCost,
          totalDeposits: totalPeriodDeposits,
          initialBalance,
          currentBalance,
          gas_response: gasData,
          sent_at: new Date().toISOString(),
        },
      });

      if (!isSent) {
        throw new Error(`Gmail delivery failed: ${gasData.error || "Google Apps Script rejected delivery"}`);
      }

      return NextResponse.json({
        success: true,
        message: `Statement for ${member.name} delivered to ${recipientEmail} via Gmail! If not visible in Inbox, please check Spam / Promotions folder.`,
        summary: {
          memberName: member.name,
          recipientEmail,
          periodType: resolvedType,
          startDate,
          endDate,
          totalPeriodMeals,
          totalPeriodCost,
          totalPeriodDeposits,
          initialBalance,
          currentBalance,
        },
      });
    }

    // Action D: Prepare and dispatch weekly reports to all members & viewer
    if (action === "manual_dispatch") {
      // For manual admin button clicks, default force to true so duplicate suppression does not silently swallow the send
      const forceDispatch = force !== undefined ? Boolean(force) : true;

      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_weekly",
          force: forceDispatch,
        }),
        redirect: "follow",
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));

      if (!gasRes.ok || gasData.success === false) {
        throw new Error(gasData.error || "Google Apps Script reported an error during dispatch.");
      }

      const result = gasData.result || {};
      const sentCount = result.sentCount ?? 0;
      const skippedCount = result.skippedCount ?? 0;
      const failedCount = result.failedCount ?? 0;

      let message = `Report dispatch completed: ${sentCount} sent, ${skippedCount} skipped, ${failedCount} failed.`;
      if (sentCount > 0) {
        message += " If not visible in Inbox, please check Spam / Promotions folder.";
      } else if (skippedCount > 0) {
        message += " (Reports were skipped as duplicates because they were already sent for this period. Use 'Force Re-send' to send them again).";
      }

      return NextResponse.json({
        success: true,
        message,
        result,
      });
    }

    // Action E: Delete single audit log
    if (action === "delete_single_log") {
      if (!logId) {
        return NextResponse.json({ error: "Missing required parameter 'logId'." }, { status: 400 });
      }

      const { error } = await supabase.from("email_logs").delete().eq("id", logId);
      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        message: "Log entry deleted successfully.",
      });
    }

    // Action F: Clear audit logs (all, failed_or_skipped, or older_than_30_days)
    if (action === "clear_email_logs") {
      let query = supabase.from("email_logs").delete();

      if (clearMode === "failed_or_skipped") {
        query = query.in("status", ["failed", "skipped_duplicate"]);
      } else if (clearMode === "older_than_30_days") {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        query = query.lt("created_at", thirtyDaysAgo);
      } else {
        // clear all rows
        query = query.neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        message:
          clearMode === "failed_or_skipped"
            ? "Cleared failed and duplicate suppressed logs."
            : clearMode === "older_than_30_days"
            ? "Cleared logs older than 30 days."
            : "All delivery audit logs cleared successfully.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

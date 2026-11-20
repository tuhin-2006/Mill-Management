import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderMemberStatementHtml,
  renderMemberStatementText,
  renderGroupLedgerViewerEmailHtml,
  renderGroupLedgerViewerEmailText,
  getDayName,
  formatReadableDate,
  StatementDailyItem,
  StatementDepositItem,
  GroupLedgerDailyItem,
} from "@/lib/email-statement";
import { getTodayInDhaka } from "@/lib/date";

const GAS_WEBAPP_URL =
  process.env.GAS_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbwzIV8bQDk50rjvWV0QOw-hdw1P-13F6f4b7gwr2E5Rn8TzTmVtfd6mGAUMF9-oq8Xu4A/exec";

const REPORT_SHARED_SECRET =
  process.env.REPORT_SHARED_SECRET || "mill_sec_9e21a4f08c3d7b6a12e5f804";

// Calculate Saturday to Friday weekly cycle in Asia/Dhaka
export function getWeeklyPeriod(targetDateStr?: string): { startDate: string; endDate: string } {
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

export function getDateRange(startDate: string, endDate: string): string[] {
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

export interface DispatchOptions {
  force?: boolean;
  isManual?: boolean;
  periodStartDate?: string;
  periodEndDate?: string;
  targetMemberId?: string;
  supabaseClient?: SupabaseClient;
}

export interface DispatchMemberResult {
  recipient: string;
  name: string;
  type: "member" | "group_viewer";
  status: "sent" | "failed" | "skipped_duplicate";
  openingBalance?: number;
  periodCost?: number;
  periodDeposits?: number;
  balance?: number;
  error?: string;
}

export interface DispatchExecutionResult {
  success: boolean;
  message: string;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  period: { startDate: string; endDate: string };
  details: DispatchMemberResult[];
}

/**
 * Centralized Weekly Report Dispatch Engine.
 * 
 * Performs 100% accurate financial reconciliation:
 * 1. Initial Opening Balance (from adjustments)
 * 2. Previous meals and deposits before weekly cycle
 * 3. Exact Net Opening Balance = initialBal + prevDeposits - prevMealsCost
 * 4. Weekly meal costs & daily breakdown
 * 5. Weekly deposits & detailed payment history table
 * 6. Closing Net Balance = openingBalance + weeklyDeposits - weeklyCost
 * 7. Dispatches through Google Apps Script MailApp directly.
 */
export async function executeWeeklyReportDispatch(
  options: DispatchOptions = {}
): Promise<DispatchExecutionResult> {
  const supabase = options.supabaseClient || createAdminClient();
  const isForce = Boolean(options.force);
  const isManual = Boolean(options.isManual);

  // 1. Fetch system settings
  const settingsRes = await supabase.from("settings").select("*").eq("id", 1).single();
  const settings = settingsRes.data || {
    app_name: "Mealora",
    auto_email_enabled: true,
    weekly_report_day: "Friday",
    weekly_report_time: "20:00",
    group_ledger_viewer_email: "creativezonebd2001@gmail.com",
  };

  // Safety switch check for automated runs
  if (!isManual && !settings.auto_email_enabled) {
    return {
      success: true,
      message: "Automatic weekly reporting is currently paused in settings.",
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      period: { startDate: "", endDate: "" },
      details: [],
    };
  }

  // 2. Determine Weekly Period (Saturday to Friday)
  const defaultPeriod = getWeeklyPeriod();
  const startDate = options.periodStartDate || defaultPeriod.startDate;
  const endDate = options.periodEndDate || defaultPeriod.endDate;
  const datesInRange = getDateRange(startDate, endDate);

  // 3. Load all required data in parallel
  const [membersRes, mealsRes, depositsRes, adjustmentsRes] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("meal_entries").select("*"),
    supabase.from("deposits").select("*"),
    supabase.from("adjustments").select("*"),
  ]);

  if (membersRes.error) {
    throw new Error(`Failed to load members: ${membersRes.error.message}`);
  }

  const allMembers = membersRes.data || [];
  const meals = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price) || 0,
    quantity: Number(m.quantity) || 0,
  }));
  const deposits = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount) || 0,
  }));
  const adjustments = (adjustmentsRes.data || []).map((a) => ({
    ...a,
    amount: Number(a.amount) || 0,
  }));

  // Filter members to dispatch
  let targetMembers = allMembers.filter((m) => m.status === "active" && m.email && m.email.trim() !== "");
  if (options.targetMemberId) {
    targetMembers = targetMembers.filter((m) => m.id === options.targetMemberId);
  }

  const details: DispatchMemberResult[] = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 4. Process each individual member statement (Always dispatch as requested)
  for (const member of targetMembers) {
    const memberEmail = member.email.trim();

    const memberMeals = meals.filter((m) => m.member_id === member.id);
    const memberDeposits = deposits.filter((d) => d.member_id === member.id);
    const memberAdjustments = adjustments.filter((a) => a.member_id === member.id);

    // Initial starting balance from adjustments table
    const initialBal = memberAdjustments.reduce((acc, a) => acc + a.amount, 0);

    // Previous activity strictly BEFORE startDate
    const prevMealsCost = memberMeals
      .filter((m) => m.meal_date < startDate)
      .reduce((acc, m) => acc + m.quantity * m.unit_price, 0);

    const prevDepositsTotal = memberDeposits
      .filter((d) => d.deposit_date < startDate)
      .reduce((acc, d) => acc + d.amount, 0);

    // Exact Opening Balance before the weekly cycle begins
    const openingBalance = initialBal + prevDepositsTotal - prevMealsCost;

    // Daily breakdown for the weekly period
    const dailyBreakdown: StatementDailyItem[] = datesInRange.map((date) => {
      const dayMeals = memberMeals.filter((m) => m.meal_date === date && m.quantity > 0);
      let lunch = 0;
      let dinner = 0;
      let cost = 0;

      for (const m of dayMeals) {
        if (m.session === "lunch") lunch += m.quantity;
        if (m.session === "dinner") dinner += m.quantity;
        cost += m.quantity * m.unit_price;
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

    // Deposits made during the weekly period
    const weeklyDeposits = memberDeposits.filter(
      (d) => d.deposit_date >= startDate && d.deposit_date <= endDate
    );
    const totalPeriodDeposits = weeklyDeposits.reduce((acc, d) => acc + d.amount, 0);
    const periodDepositsList: StatementDepositItem[] = weeklyDeposits.map((d) => ({
      id: d.id,
      date: d.deposit_date,
      amount: d.amount,
      note: d.note,
    }));

    // New Current Net Balance
    const currentBalance = openingBalance + totalPeriodDeposits - totalPeriodCost;

    // Lifetime financials up to endDate
    const lifetimeDeposits = memberDeposits
      .filter((d) => d.deposit_date <= endDate)
      .reduce((acc, d) => acc + d.amount, 0);
    const lifetimeCost = memberMeals
      .filter((m) => m.meal_date <= endDate)
      .reduce((acc, m) => acc + m.quantity * m.unit_price, 0);

    const subject = `[${settings.app_name || "Mealora"}] সাপ্তাহিক মিল বিবরণী: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)} (${member.name})`;

    const statementParams = {
      periodType: "week" as const,
      periodTitle: "সাপ্তাহিক মিল ও ব্যালেন্স বিবরণী (Weekly Statement)",
      periodSubtitle: `সাপ্তাহিক হিসাব: ${formatReadableDate(startDate)} থেকে ${formatReadableDate(endDate)}`,
      startDate,
      endDate,
      memberName: member.name,
      recipientEmail: memberEmail,
      dailyBreakdown,
      totalPeriodMeals,
      totalPeriodCost,
      totalPeriodDeposits,
      openingBalance,
      periodDepositsList,
      initialBalance: initialBal,
      lifetimeDeposits,
      lifetimeCost,
      currentBalance,
      appName: settings.app_name || "Mealora",
    };

    const htmlBody = renderMemberStatementHtml(statementParams);
    const textBody = renderMemberStatementText(statementParams);

    // Send single email via Google Apps Script MailApp
    try {
      const gasRes = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: REPORT_SHARED_SECRET,
          action: "send_single_email",
          to: memberEmail,
          subject,
          body: textBody,
          htmlBody,
          senderName: settings.app_name || "Mealora Mess Management",
        }),
      });

      const gasData = await gasRes.json().catch(() => ({ success: false }));
      const isSent = gasRes.ok && gasData.success !== false;

      // Log delivery in public.email_logs
      await supabase.from("email_logs").insert({
        report_period_start: startDate,
        report_period_end: endDate,
        recipient_type: "member",
        recipient_email: memberEmail,
        member_id: member.id,
        status: isSent ? "sent" : "failed",
        error_message: isSent ? null : JSON.stringify(gasData),
        metadata: {
          member_name: member.name,
          openingBalance,
          totalWeeklyMeals: totalPeriodMeals,
          totalWeeklyCost: totalPeriodCost,
          totalWeeklyDeposits: totalPeriodDeposits,
          currentBalance,
          is_weekly_batch: true,
          is_manual: isManual,
          gas_response: gasData,
          sent_at: new Date().toISOString(),
        },
      });

      if (isSent) {
        sentCount++;
        details.push({
          recipient: memberEmail,
          name: member.name,
          type: "member",
          status: "sent",
          openingBalance,
          periodCost: totalPeriodCost,
          periodDeposits: totalPeriodDeposits,
          balance: currentBalance,
        });
      } else {
        failedCount++;
        details.push({
          recipient: memberEmail,
          name: member.name,
          type: "member",
          status: "failed",
          error: gasData.error || "GAS error",
        });
      }
    } catch (err: unknown) {
      failedCount++;
      const errMsg = err instanceof Error ? err.message : "Network error";
      details.push({
        recipient: memberEmail,
        name: member.name,
        type: "member",
        status: "failed",
        error: errMsg,
      });

      await supabase.from("email_logs").insert({
        report_period_start: startDate,
        report_period_end: endDate,
        recipient_type: "member",
        recipient_email: memberEmail,
        member_id: member.id,
        status: "failed",
        error_message: errMsg,
        metadata: {
          member_name: member.name,
          is_weekly_batch: true,
          sent_at: new Date().toISOString(),
        },
      });
    }
  }

  // 5. Process Group Ledger Viewer Aggregate Report
  const viewerEmail = (settings.group_ledger_viewer_email || "").trim();
  if (viewerEmail) {
    // Calculate group daily breakdown
    const dailyGroupBreakdown: GroupLedgerDailyItem[] = datesInRange.map((date) => {
        const dayMeals = meals.filter((m) => m.meal_date === date && m.quantity > 0);
        let lunchCount = 0;
        let dinnerCount = 0;
        let totalCost = 0;

        for (const m of dayMeals) {
          if (m.session === "lunch") lunchCount += m.quantity;
          if (m.session === "dinner") dinnerCount += m.quantity;
          totalCost += m.quantity * m.unit_price;
        }

        return {
          date,
          dayName: getDayName(date),
          lunchCount,
          dinnerCount,
          totalMeals: lunchCount + dinnerCount,
          totalCost,
        };
      });

      const totalGroupPeriodMeals = dailyGroupBreakdown.reduce((acc, r) => acc + r.totalMeals, 0);
      const totalGroupPeriodLunch = dailyGroupBreakdown.reduce((acc, r) => acc + r.lunchCount, 0);
      const totalGroupPeriodDinner = dailyGroupBreakdown.reduce((acc, r) => acc + r.dinnerCount, 0);
      const totalGroupPeriodCost = dailyGroupBreakdown.reduce((acc, r) => acc + r.totalCost, 0);

      const totalGroupPeriodDeposits = deposits
        .filter((d) => d.deposit_date >= startDate && d.deposit_date <= endDate)
        .reduce((acc, d) => acc + d.amount, 0);

      const totalGroupLifetimeDeposits = deposits
        .filter((d) => d.deposit_date <= endDate)
        .reduce((acc, d) => acc + d.amount, 0);

      const totalGroupLifetimeAdjustments = adjustments
        .filter((a) => a.adjustment_date <= endDate)
        .reduce((acc, a) => acc + a.amount, 0);

      const totalGroupLifetimeCost = meals
        .filter((m) => m.meal_date <= endDate)
        .reduce((acc, m) => acc + m.quantity * m.unit_price, 0);

      const currentGroupBalance =
        totalGroupLifetimeDeposits + totalGroupLifetimeAdjustments - totalGroupLifetimeCost;

      const groupViewerData = {
        appName: settings.app_name || "Mealora",
        startDate,
        endDate,
        dailyGroupBreakdown,
        totalPeriodMeals: totalGroupPeriodMeals,
        totalPeriodLunch: totalGroupPeriodLunch,
        totalPeriodDinner: totalGroupPeriodDinner,
        totalPeriodCost: totalGroupPeriodCost,
        totalPeriodDeposits: totalGroupPeriodDeposits,
        lifetimeDeposits: totalGroupLifetimeDeposits,
        lifetimeCost: totalGroupLifetimeCost,
        currentGroupBalance,
        activeMembersCount: targetMembers.length,
      };

      const viewerHtml = renderGroupLedgerViewerEmailHtml(groupViewerData);
      const viewerText = renderGroupLedgerViewerEmailText(groupViewerData);
      const viewerSubject = `[${settings.app_name || "Mealora"}] সাপ্তাহিক সম্মিলিত মেস খতিয়ান (Group Ledger): ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`;

      try {
        const gasRes = await fetch(GAS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: REPORT_SHARED_SECRET,
            action: "send_single_email",
            to: viewerEmail,
            subject: viewerSubject,
            body: viewerText,
            htmlBody: viewerHtml,
            senderName: settings.app_name || "Mealora Mess Management",
          }),
        });

        const gasData = await gasRes.json().catch(() => ({ success: false }));
        const isSent = gasRes.ok && gasData.success !== false;

        await supabase.from("email_logs").insert({
          report_period_start: startDate,
          report_period_end: endDate,
          recipient_type: "group_viewer",
          recipient_email: viewerEmail,
          status: isSent ? "sent" : "failed",
          error_message: isSent ? null : JSON.stringify(gasData),
          metadata: {
            is_weekly_batch: true,
            currentGroupBalance,
            totalPeriodMeals: totalGroupPeriodMeals,
            totalPeriodCost: totalGroupPeriodCost,
            totalPeriodDeposits: totalGroupPeriodDeposits,
            gas_response: gasData,
            sent_at: new Date().toISOString(),
          },
        });

        if (isSent) {
          sentCount++;
          details.push({
            recipient: viewerEmail,
            name: "Group Ledger Viewer",
            type: "group_viewer",
            status: "sent",
            balance: currentGroupBalance,
          });
        } else {
          failedCount++;
          details.push({
            recipient: viewerEmail,
            name: "Group Ledger Viewer",
            type: "group_viewer",
            status: "failed",
            error: gasData.error || "GAS error",
          });
        }
      } catch (err: unknown) {
        failedCount++;
        details.push({
          recipient: viewerEmail,
          name: "Group Ledger Viewer",
          type: "group_viewer",
          status: "failed",
          error: err instanceof Error ? err.message : "Network error",
        });
      }
    }

  let message = `Report dispatch completed: ${sentCount} sent, ${failedCount} failed.`;
  if (sentCount > 0) {
    message += " Delivered via Gmail MailApp.";
  }

  return {
    success: failedCount === 0 || sentCount > 0,
    message,
    sentCount,
    skippedCount,
    failedCount,
    period: { startDate, endDate },
    details,
  };
}

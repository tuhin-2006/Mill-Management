import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWeeklyReportDispatch, getWeeklyPeriod } from "@/lib/report-dispatcher";

const REPORT_SHARED_SECRET =
  process.env.REPORT_SHARED_SECRET || "mill_sec_9e21a4f08c3d7b6a12e5f804";

async function handleCron(req: Request) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const isVercelCron = Boolean(req.headers.get("x-vercel-cron"));
    const providedSecret =
      searchParams.get("secret") ||
      req.headers.get("x-report-secret") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    const isSecretAuthorized = providedSecret === REPORT_SHARED_SECRET;
    const isForce = searchParams.get("force") === "true";

    // Only allow Vercel Cron or authenticated secret calls
    if (!isVercelCron && !isSecretAuthorized && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing cron authentication." },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch scheduling settings
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: `Failed to load settings: ${settingsError?.message || "Not found"}` },
        { status: 500 }
      );
    }

    // Safety lock check: if disabled in web settings, exit safely without dispatching
    if (!settings.auto_email_enabled && !isForce) {
      return NextResponse.json({
        status: "paused",
        message: "Automatic weekly email reporting is paused in Admin Settings (Safety Lock Active).",
        auto_email_enabled: false,
      });
    }

    // 2. Compute current Bangladesh Asia/Dhaka time (UTC+6) accurately using Intl.DateTimeFormat
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

    const currentDayName = getPart("weekday"); // "Saturday", "Friday", etc.
    const currentHour = parseInt(getPart("hour"), 10) || 0;
    const currentMinute = parseInt(getPart("minute"), 10) || 0;
    const currentYear = parseInt(getPart("year"), 10) || now.getUTCFullYear();
    const currentMonth = parseInt(getPart("month"), 10) || now.getUTCMonth() + 1;
    const currentDay = parseInt(getPart("day"), 10) || now.getUTCDate();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const scheduledDay = (settings.weekly_report_day || "Friday").trim();
    const scheduledTimeStr = (settings.weekly_report_time || "20:00").trim();
    const [schedH, schedM] = scheduledTimeStr.split(":").map(Number);
    const scheduledHour = isNaN(schedH) ? 20 : schedH;
    const scheduledMin = isNaN(schedM) ? 0 : schedM;
    const scheduledTimeInMinutes = scheduledHour * 60 + scheduledMin;

    const currentTimeFormatted = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

    // 3. Day Check (unless force is requested)
    if (!isForce && currentDayName.toLowerCase() !== scheduledDay.toLowerCase()) {
      return NextResponse.json({
        status: "waiting",
        message: `Today is ${currentDayName}. Reports are scheduled for ${scheduledDay} at ${scheduledTimeStr}.`,
        currentTimeDhaka: `${currentDayName} ${currentTimeFormatted}`,
        scheduledDay,
        scheduledTime: scheduledTimeStr,
      });
    }

    // 4. Time Check: Has the scheduled time arrived today?
    if (!isForce && currentTimeInMinutes < scheduledTimeInMinutes) {
      return NextResponse.json({
        status: "waiting",
        message: `Current Dhaka time (${currentTimeFormatted}) is before the scheduled time (${scheduledTimeStr}).`,
        currentTimeDhaka: currentTimeFormatted,
        scheduledTime: scheduledTimeStr,
      });
    }

    // 5. Check if today's scheduled weekly batch dispatch has already run on or after scheduled time
    // Convert today's scheduled Dhaka time to UTC ISO string
    // Asia/Dhaka is UTC+6
    const scheduledUtcMs = Date.UTC(currentYear, currentMonth - 1, currentDay, scheduledHour - 6, scheduledMin, 0);
    const scheduledIsoString = new Date(scheduledUtcMs).toISOString();

    const { data: recentLogs } = await supabase
      .from("email_logs")
      .select("id, recipient_email, recipient_type, status, created_at, metadata")
      .eq("status", "sent")
      .gte("created_at", scheduledIsoString);

    // Only count automated weekly batch runs (do NOT block on single on-demand statements)
    const alreadyDispatchedToday = (recentLogs || []).filter((log) => {
      const meta = log.metadata as { is_weekly_batch?: boolean; is_on_demand_single?: boolean } | null;
      if (!meta) return false;
      if (meta.is_on_demand_single) return false;
      return meta.is_weekly_batch === true;
    });

    if (!isForce && alreadyDispatchedToday.length > 0) {
      return NextResponse.json({
        status: "already_completed_today",
        message: `Today's scheduled weekly report for ${scheduledDay} at ${scheduledTimeStr} was already dispatched (${alreadyDispatchedToday.length} emails delivered).`,
        scheduledDay,
        scheduledTime: scheduledTimeStr,
        currentTimeDhaka: currentTimeFormatted,
        sentCount: alreadyDispatchedToday.length,
      });
    }

    // 6. Time has arrived and today's schedule has not been dispatched yet -> DISPATCH!
    const result = await executeWeeklyReportDispatch({
      force: true, // Always dispatch to all members regardless of previous week logs
      isManual: false,
      supabaseClient: supabase,
    });

    return NextResponse.json({
      status: "dispatched",
      message: result.message,
      sentCount: result.sentCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      period: result.period,
      scheduledTime: scheduledTimeStr,
      dispatchedAtDhaka: currentTimeFormatted,
      details: result.details,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal cron error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

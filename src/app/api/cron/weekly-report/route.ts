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

    // 2. Compute current Bangladesh Asia/Dhaka time (UTC+6)
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const dhakaNow = new Date(utcMs + 6 * 3600000);

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = daysOfWeek[dhakaNow.getUTCDay()];
    const currentHour = dhakaNow.getUTCHours();
    const currentMinute = dhakaNow.getUTCMinutes();
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

    // 5. Duplicate Suppression Check: Check if reports for the current weekly period were already sent
    const period = getWeeklyPeriod();
    const { data: existingSentLogs } = await supabase
      .from("email_logs")
      .select("id, recipient_email, recipient_type, status, created_at")
      .eq("report_period_start", period.startDate)
      .eq("report_period_end", period.endDate)
      .eq("status", "sent");

    if (!isForce && existingSentLogs && existingSentLogs.length > 0) {
      return NextResponse.json({
        status: "already_completed",
        message: `Weekly reports for period ${period.startDate} to ${period.endDate} were already dispatched (${existingSentLogs.length} emails delivered).`,
        period,
        sentCount: existingSentLogs.length,
        scheduledDay,
        scheduledTime: scheduledTimeStr,
        currentTimeDhaka: currentTimeFormatted,
      });
    }

    // 6. Time has arrived and reports have not been sent yet -> DISPATCH!
    const result = await executeWeeklyReportDispatch({
      force: isForce,
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

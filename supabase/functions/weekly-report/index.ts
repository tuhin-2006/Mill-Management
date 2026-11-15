import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ==============================================================================
// CORS Headers for secure API consumption
// ==============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-report-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface PreparedReport {
  recipient_type: "member" | "group_viewer" | "test";
  recipient_email: string;
  member_id: string | null;
  member_name: string;
  subject: string;
  htmlBody: string;
  is_duplicate: boolean;
  metadata?: Record<string, unknown>;
}

interface DeliveryLogItem {
  report_period_start: string;
  report_period_end: string;
  recipient_type: "member" | "group_viewer" | "test";
  recipient_email: string;
  member_id?: string | null;
  status: "sent" | "failed" | "skipped_duplicate";
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

// Format numbers into BDT currency string
function formatBDT(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-৳${abs}` : `৳${abs}`;
}

// Compute Dhaka local date string (YYYY-MM-DD)
function getDhakaDateString(date: Date = new Date()): string {
  // Asia/Dhaka is UTC+6
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dhakaTime = new Date(utc + 6 * 3600000);
  const year = dhakaTime.getFullYear();
  const month = String(dhakaTime.getMonth() + 1).padStart(2, "0");
  const day = String(dhakaTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Get day name for date string
function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getUTCDay()];
}

// Format readable date e.g. "15 Nov 2026"
function formatReadableDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

// Calculate the weekly period (Saturday to Friday) in Asia/Dhaka
function getWeeklyPeriod(targetDateStr?: string): { startDate: string; endDate: string } {
  let baseDate: Date;
  if (targetDateStr) {
    const [y, m, d] = targetDateStr.split("-").map(Number);
    baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  } else {
    // Current Dhaka date
    const todayDhaka = getDhakaDateString();
    const [y, m, d] = todayDhaka.split("-").map(Number);
    baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  const dayOfWeek = baseDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  
  // In our mess schedule, weekly reporting ends on Friday (day 5)
  // If today is Friday (5), endDate is today.
  // If today is Saturday (6), endDate is Friday 7 days later or yesterday depending on time.
  // We align endDate to the current cycle's Friday:
  let diffToFriday = 5 - dayOfWeek;
  if (diffToFriday > 0 && dayOfWeek !== 5) {
    // e.g. Thursday (4) -> diff = +1 (Friday this week)
  } else if (diffToFriday < 0) {
    // Saturday (6) -> diff = -1 (Friday was yesterday)
  }

  const endDateObj = new Date(baseDate.getTime() + diffToFriday * 86400000);
  const startDateObj = new Date(endDateObj.getTime() - 6 * 86400000); // 7 days: Sat to Fri

  const endStr = `${endDateObj.getUTCFullYear()}-${String(endDateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(endDateObj.getUTCDate()).padStart(2, "0")}`;
  const startStr = `${startDateObj.getUTCFullYear()}-${String(startDateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(startDateObj.getUTCDate()).padStart(2, "0")}`;

  return { startDate: startStr, endDate: endStr };
}

// Generate list of all YYYY-MM-DD between start and end inclusive
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

// ==============================================================================
// HTML Email Templates (Responsive, modern, matching Mill Management design)
// ==============================================================================

function renderMemberEmailHtml(params: {
  appName: string;
  memberName: string;
  startDate: string;
  endDate: string;
  dailyBreakdown: Array<{
    date: string;
    dayName: string;
    lunch: number;
    dinner: number;
    totalMeals: number;
    cost: number;
  }>;
  totalWeeklyMeals: number;
  totalWeeklyCost: number;
  weeklyDeposit: number;
  lifetimeDeposits: number;
  lifetimeCost: number;
  currentBalance: number;
}): string {
  const isAdvance = params.currentBalance >= 0;
  const balanceColor = isAdvance ? "#059669" : "#e11d48";
  const balanceBg = isAdvance ? "#ecfdf5" : "#fff1f2";
  const balanceBorder = isAdvance ? "#a7f3d0" : "#fecdd3";
  const balanceBadgeText = isAdvance ? "Advance (জমা আছে)" : "Due (বকেয়া আছে)";

  const rowsHtml = params.dailyBreakdown
    .map((row) => {
      const isFri = row.dayName === "Friday";
      const highlightBg = isFri ? "#f8fafc" : "#ffffff";
      return `
        <tr style="background-color: ${highlightBg}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">
            ${formatReadableDate(row.date)}
            ${isFri ? '<span style="font-size: 10px; background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Friday</span>' : ""}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b;">${row.dayName}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${row.lunch > 0 ? row.lunch : "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${isFri ? '<span style="color:#94a3b8; font-size:11px;">Closed</span>' : row.dinner > 0 ? row.dinner : "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: center; font-weight: 600;">${row.totalMeals}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatBDT(row.cost)}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Mill Report - ${params.memberName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: left; border-bottom: 3px solid #059669;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
                      ${params.appName}
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">
                      সাপ্তাহিক মিল ও ব্যালেন্স বিবরণী (Weekly Member Statement)
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
                      Active Cycle
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personal Greeting & Statement Period -->
          <tr>
            <td style="padding: 24px 24px 12px 24px;">
              <p style="margin: 0 0 6px 0; font-size: 15px; color: #475569;">
                আসসালামু আলাইকুম, <strong>${params.memberName}</strong>
              </p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Reporting Period: <strong>${formatReadableDate(params.startDate)}</strong> to <strong>${formatReadableDate(params.endDate)}</strong>
              </p>
            </td>
          </tr>

          <!-- Primary Balance Card (High Visibility) -->
          <tr>
            <td style="padding: 12px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${balanceBg}; border: 1.5px solid ${balanceBorder}; border-radius: 10px; padding: 18px;">
                <tr>
                  <td>
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: ${balanceColor};">
                      বর্তমান ব্যালেন্স (Current Net Balance)
                    </span>
                    <div style="font-size: 28px; font-weight: 800; color: ${balanceColor}; margin: 4px 0 2px 0;">
                      ${formatBDT(params.currentBalance)}
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: ${balanceColor};">
                      ${balanceBadgeText}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: #64748b; line-height: 1.4; text-align: right;">
                      আজীবনের মোট জমা: <strong>${formatBDT(params.lifetimeDeposits)}</strong><br>
                      আজীবনের মোট মিল খরচ: <strong>${formatBDT(params.lifetimeCost)}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- KPI Metric Cards Grid -->
          <tr>
            <td style="padding: 8px 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="8" cellpadding="0">
                <tr>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">এ সপ্তাহের মিল</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${params.totalWeeklyMeals}
                    </div>
                  </td>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">এ সপ্তাহের খরচ</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${formatBDT(params.totalWeeklyCost)}
                    </div>
                  </td>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">এ সপ্তাহের জমা</span>
                    <div style="font-size: 18px; font-weight: 700; color: #059669; margin-top: 4px;">
                      ${formatBDT(params.weeklyDeposit)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Daily Meal Breakdown Table -->
          <tr>
            <td style="padding: 8px 24px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
                দৈনিক মিলের বিবরণ (Daily Meal Breakdown)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">তারিখ (Date)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">বার (Day)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">দুপুর</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">রাত</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">মোট মিল</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">খরচ (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0;">
                    <td colspan="4" style="padding: 12px; font-size: 13px; color: #0f172a;">সাপ্তাহিক মোট (Weekly Total)</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: center;">${params.totalWeeklyMeals}</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: right;">${formatBDT(params.totalWeeklyCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Lifetime Reconciliation Breakdown -->
          <tr>
            <td style="padding: 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    <strong>হিসাব সমন্বয় সূত্র (Reconciliation Formula):</strong><br>
                    সর্বমোট জমা (৳${params.lifetimeDeposits}) - সর্বমোট মিল খরচ (৳${params.lifetimeCost}) = বর্তমান ব্যালেন্স (<span style="color: ${balanceColor}; font-weight: 700;">${formatBDT(params.currentBalance)}</span>).
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Notice -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                This is an automated weekly report from <strong>${params.appName}</strong>.<br>
                For any meal adjustments or questions, please contact the Mill Administrator.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #94a3b8;">
                Generated at: ${new Date().toUTCString()} (Bangladesh Asia/Dhaka Timezone)
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function renderGroupLedgerViewerEmailHtml(params: {
  appName: string;
  startDate: string;
  endDate: string;
  dailyGroupBreakdown: Array<{
    date: string;
    dayName: string;
    lunchCount: number;
    dinnerCount: number;
    totalMeals: number;
    totalCost: number;
  }>;
  totalPeriodMeals: number;
  totalPeriodLunch: number;
  totalPeriodDinner: number;
  totalPeriodCost: number;
  totalPeriodDeposits: number;
  lifetimeDeposits: number;
  lifetimeCost: number;
  currentGroupBalance: number;
  activeMembersCount: number;
}): string {
  const isSurplus = params.currentGroupBalance >= 0;
  const balanceColor = isSurplus ? "#059669" : "#e11d48";
  const balanceBg = isSurplus ? "#ecfdf5" : "#fff1f2";
  const balanceBorder = isSurplus ? "#a7f3d0" : "#fecdd3";
  const balanceStatus = isSurplus ? "Surplus / জমা উদ্বৃত্ত" : "Deficit / ঘাটতি";

  const rowsHtml = params.dailyGroupBreakdown
    .map((row) => {
      const isFri = row.dayName === "Friday";
      const highlightBg = isFri ? "#f8fafc" : "#ffffff";
      return `
        <tr style="background-color: ${highlightBg}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">
            ${formatReadableDate(row.date)}
            ${isFri ? '<span style="font-size: 10px; background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Friday</span>' : ""}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b;">${row.dayName}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${row.lunchCount}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${isFri ? '<span style="color:#94a3b8; font-size:11px;">Closed</span>' : row.dinnerCount}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: center; font-weight: 600;">${row.totalMeals}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatBDT(row.totalCost)}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Group Aggregate Ledger</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: left; border-bottom: 3px solid #2563eb;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
                      ${params.appName} — Group Ledger
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">
                      সম্মিলিত সাপ্তাহিক মেস হিসাব বিবরণী (Aggregated Group Statement)
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
                      Confidential Aggregate
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Privacy Protection Notice (Strict Requirement) -->
          <tr>
            <td style="padding: 16px 24px 8px 24px;">
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.4;">
                  <strong>Privacy Notice:</strong> This report provides strictly aggregated statistics for group auditing. In compliance with privacy policies, no individual member names, meal records, or private account balances are included.
                </p>
              </div>
            </td>
          </tr>

          <!-- Period Details -->
          <tr>
            <td style="padding: 12px 24px 8px 24px;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Audit Period: <strong>${formatReadableDate(params.startDate)}</strong> to <strong>${formatReadableDate(params.endDate)}</strong>
                &nbsp;|&nbsp; Active Members: <strong>${params.activeMembersCount}</strong>
              </p>
            </td>
          </tr>

          <!-- Group Treasury Balance Card -->
          <tr>
            <td style="padding: 8px 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${balanceBg}; border: 1.5px solid ${balanceBorder}; border-radius: 10px; padding: 18px;">
                <tr>
                  <td>
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: ${balanceColor};">
                      গ্রুপের বর্তমান মোট তহবিল (Group Net Treasury Balance)
                    </span>
                    <div style="font-size: 28px; font-weight: 800; color: ${balanceColor}; margin: 4px 0 2px 0;">
                      ${formatBDT(params.currentGroupBalance)}
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: ${balanceColor};">
                      ${balanceStatus}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: #64748b; line-height: 1.4; text-align: right;">
                      গ্রুপের সর্বমোট জমা: <strong>${formatBDT(params.lifetimeDeposits)}</strong><br>
                      গ্রুপের সর্বমোট খরচ: <strong>${formatBDT(params.lifetimeCost)}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- KPI Metric Cards Grid -->
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="8" cellpadding="0">
                <tr>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">সাপ্তাহিক মোট মিল</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${params.totalPeriodMeals}
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">${params.totalPeriodLunch} Lunch / ${params.totalPeriodDinner} Dinner</span>
                  </td>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">সাপ্তাহিক মোট খরচ</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${formatBDT(params.totalPeriodCost)}
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">Mess Meal Expense</span>
                  </td>
                  <td width="33%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">সাপ্তাহিক সংগৃহীত জমা</span>
                    <div style="font-size: 18px; font-weight: 700; color: #059669; margin-top: 4px;">
                      ${formatBDT(params.totalPeriodDeposits)}
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">Collected Funds</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Daily Group Ledger Table -->
          <tr>
            <td style="padding: 8px 24px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
                সম্মিলিত দৈনিক মিলের খতিয়ান (Daily Group Ledger)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">তারিখ (Date)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">বার (Day)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">দুপুর</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">রাত</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">মোট মিল</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">মোট খরচ (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0;">
                    <td colspan="4" style="padding: 12px; font-size: 13px; color: #0f172a;">সাপ্তাহিক মোট (Weekly Total)</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: center;">${params.totalPeriodMeals}</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: right;">${formatBDT(params.totalPeriodCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Treasury Reconciliation Details -->
          <tr>
            <td style="padding: 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    <strong>সম্মিলিত তহবিল হিসাব সমন্বয় (Treasury Reconciliation):</strong><br>
                    গ্রুপের মোট সংগৃহীত জমা (৳${params.lifetimeDeposits}) - গ্রুপের সর্বমোট মিল খরচ (৳${params.lifetimeCost}) = অবশিষ্ট মোট তহবিল (<span style="color: ${balanceColor}; font-weight: 700;">${formatBDT(params.currentGroupBalance)}</span>).
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Notice -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                This is an automated weekly audit report from <strong>${params.appName}</strong>.<br>
                Issued for Group Ledger Viewer verification. Individual member identities remain strictly confidential.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #94a3b8;">
                Generated at: ${new Date().toUTCString()} (Bangladesh Asia/Dhaka Timezone)
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ==============================================================================
// Main Request Handler
// ==============================================================================

serve(async (req: Request) => {
  // 1. Handle CORS Pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Authenticate Shared Secret
    const expectedSecret = Deno.env.get("REPORT_SHARED_SECRET");
    if (!expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: REPORT_SHARED_SECRET is not configured in Edge Function secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("x-report-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader || authHeader !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing report secret header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Initialize Supabase Admin Client using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Body
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const url = new URL(req.url);
    const action = (body.action as string) || url.searchParams.get("action") || "prepare";

    // ==========================================================================
    // ACTION: LOG DELIVERY ATTEMPTS
    // ==========================================================================
    if (action === "log") {
      const logs = (body.logs as DeliveryLogItem[]) || [];
      if (!Array.isArray(logs) || logs.length === 0) {
        return new Response(
          JSON.stringify({ error: "Invalid payload: 'logs' must be a non-empty array." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rowsToInsert = logs.map((item) => ({
        report_period_start: item.report_period_start,
        report_period_end: item.report_period_end,
        recipient_type: item.recipient_type,
        recipient_email: item.recipient_email,
        member_id: item.member_id || null,
        status: item.status,
        error_message: item.error_message || null,
        metadata: item.metadata || {},
        sent_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from("email_logs").insert(rowsToInsert).select();
      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to insert email logs: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, count: data?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: TEST REPORT
    // ==========================================================================
    if (action === "test") {
      const testEmail = (body.testRecipient as string) || (body.testEmail as string) || "";
      if (!testEmail) {
        return new Response(
          JSON.stringify({ error: "Missing required parameter 'testRecipient' or 'testEmail'." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a preview with actual or dummy figures for the test recipient
      const { startDate, endDate } = getWeeklyPeriod();
      const sampleDays = getDateRange(startDate, endDate).map((date) => ({
        date,
        dayName: getDayName(date),
        lunch: 1,
        dinner: getDayName(date) === "Friday" ? 0 : 1,
        totalMeals: getDayName(date) === "Friday" ? 1 : 2,
        cost: getDayName(date) === "Friday" ? 120 : 120,
      }));

      const sampleMemberHtml = renderMemberEmailHtml({
        appName: "Mill Manager [TEST PREVIEW]",
        memberName: "Administrator Preview",
        startDate,
        endDate,
        dailyBreakdown: sampleDays,
        totalWeeklyMeals: 13,
        totalWeeklyCost: 840,
        weeklyDeposit: 1000,
        lifetimeDeposits: 5000,
        lifetimeCost: 4200,
        currentBalance: 800,
      });

      const sampleGroupHtml = renderGroupLedgerViewerEmailHtml({
        appName: "Mill Manager [TEST PREVIEW]",
        startDate,
        endDate,
        dailyGroupBreakdown: sampleDays.map((d) => ({
          date: d.date,
          dayName: d.dayName,
          lunchCount: 4,
          dinnerCount: d.dayName === "Friday" ? 0 : 4,
          totalMeals: d.dayName === "Friday" ? 4 : 8,
          totalCost: d.dayName === "Friday" ? 480 : 480,
        })),
        totalPeriodMeals: 52,
        totalPeriodLunch: 28,
        totalPeriodDinner: 24,
        totalPeriodCost: 3360,
        totalPeriodDeposits: 4000,
        lifetimeDeposits: 20000,
        lifetimeCost: 16800,
        currentGroupBalance: 3200,
        activeMembersCount: 4,
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "test",
          period: { startDate, endDate },
          reports: [
            {
              recipient_type: "test",
              recipient_email: testEmail,
              member_id: null,
              member_name: "Test Member Preview",
              subject: `[TEST] Mill Weekly Report Preview: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`,
              htmlBody: sampleMemberHtml,
              is_duplicate: false,
            },
            {
              recipient_type: "test",
              recipient_email: testEmail,
              member_id: null,
              member_name: "Test Group Ledger Preview",
              subject: `[TEST] Mill Weekly Group Aggregate Ledger: ${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`,
              htmlBody: sampleGroupHtml,
              is_duplicate: false,
            },
          ],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: PREPARE WEEKLY REPORTS
    // ==========================================================================
    let { startDate, endDate } = body as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      const computed = getWeeklyPeriod();
      startDate = startDate || computed.startDate;
      endDate = endDate || computed.endDate;
    }

    const force = Boolean(body.force); // If true, bypass duplicate suppression
    const isManualRun = Boolean(body.isManualRun); // If true, initiated manually by Admin

    // Fetch data in parallel
    const [membersRes, settingsRes, mealsRes, depositsRes, logsRes] = await Promise.all([
      supabase.from("members").select("*").order("name", { ascending: true }),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("meal_entries").select("*"),
      supabase.from("deposits").select("*"),
      supabase.from("email_logs").select("*")
        .eq("report_period_start", startDate)
        .eq("report_period_end", endDate)
        .eq("status", "sent"),
    ]);

    if (membersRes.error) {
      throw new Error(`Failed to fetch members: ${membersRes.error.message}`);
    }

    const members = membersRes.data || [];
    const settings = settingsRes.data || {
      app_name: "Mill Manager",
      meal_price: 60,
      friday_meal_price: 120,
      group_ledger_viewer_email: null,
      auto_email_enabled: false,
    };

    // Safety Switch Check: If automated trigger and auto_email_enabled is FALSE, exit cleanly without sending
    if (!isManualRun && !settings.auto_email_enabled) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "safety_locked",
          auto_email_enabled: false,
          message: "Automatic weekly reporting is currently turned OFF by Admin in Settings. Enable it in the dashboard to resume automated dispatches.",
          period: { startDate, endDate },
          reports: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const allMeals = (mealsRes.data || []).map((m: any) => ({
      ...m,
      unit_price: Number(m.unit_price),
      quantity: Number(m.quantity),
    }));
    const allDeposits = (depositsRes.data || []).map((d: any) => ({
      ...d,
      amount: Number(d.amount),
    }));
    const sentLogs = logsRes.data || [];

    // Set of emails already successfully sent for this period
    const alreadySentEmails = new Set(sentLogs.map((log: any) => log.recipient_email.toLowerCase().trim()));

    const datesInRange = getDateRange(startDate, endDate);
    const preparedReports: PreparedReport[] = [];

    const targetMemberId = (body.targetMemberId as string) || (body.memberId as string);
    const targetMembers = targetMemberId
      ? members.filter((m: any) => m.id === targetMemberId)
      : members;

    // --------------------------------------------------------------------------
    // 1. Process Individual Member Reports
    // --------------------------------------------------------------------------
    for (const member of targetMembers) {
      const email = member.email ? member.email.trim() : null;
      if (!email) {
        // Member has no configured email; skip generating report
        continue;
      }

      // Filter member's meals
      const memberMeals = allMeals.filter((m: any) => m.member_id === member.id);
      const memberDeposits = allDeposits.filter((d: any) => d.member_id === member.id);

      // Period meal breakdown
      const dailyBreakdown = datesInRange.map((date) => {
        const dayMeals = memberMeals.filter((m: any) => m.meal_date === date);
        let lunch = 0;
        let dinner = 0;
        let cost = 0;

        for (const m of dayMeals) {
          if (m.quantity > 0) {
            if (m.session === "lunch") lunch += m.quantity;
            if (m.session === "dinner") dinner += m.quantity;
            cost += m.quantity * m.unit_price;
          }
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

      const totalWeeklyMeals = dailyBreakdown.reduce((acc, r) => acc + r.totalMeals, 0);
      const totalWeeklyCost = dailyBreakdown.reduce((acc, r) => acc + r.cost, 0);

      // Weekly deposits (within startDate and endDate inclusive)
      const weeklyDeposit = memberDeposits
        .filter((d: any) => d.deposit_date >= startDate! && d.deposit_date <= endDate!)
        .reduce((acc: number, d: any) => acc + d.amount, 0);

      // Lifetime financials (up to endDate)
      const lifetimeDeposits = memberDeposits
        .filter((d: any) => !endDate || d.deposit_date <= endDate)
        .reduce((acc: number, d: any) => acc + d.amount, 0);

      const lifetimeCost = memberMeals
        .filter((m: any) => (!endDate || m.meal_date <= endDate) && m.quantity > 0)
        .reduce((acc: number, m: any) => acc + m.quantity * m.unit_price, 0);

      const currentBalance = lifetimeDeposits - lifetimeCost;

      const isDuplicate = alreadySentEmails.has(email.toLowerCase()) && !force;

      const html = renderMemberEmailHtml({
        appName: settings.app_name || "Mill Manager",
        memberName: member.name,
        startDate: startDate!,
        endDate: endDate!,
        dailyBreakdown,
        totalWeeklyMeals,
        totalWeeklyCost,
        weeklyDeposit,
        lifetimeDeposits,
        lifetimeCost,
        currentBalance,
      });

      preparedReports.push({
        recipient_type: "member",
        recipient_email: email,
        member_id: member.id,
        member_name: member.name,
        subject: `[${settings.app_name || "Mill Manager"}] Weekly Statement: ${formatReadableDate(startDate!)} - ${formatReadableDate(endDate!)} (${member.name})`,
        htmlBody: html,
        is_duplicate: isDuplicate,
        metadata: {
          totalWeeklyMeals,
          totalWeeklyCost,
          currentBalance,
        },
      });
    }

    // --------------------------------------------------------------------------
    // 2. Process Group Ledger Viewer Report (Aggregate-only! Strict Privacy)
    // --------------------------------------------------------------------------
    const groupViewerEmail = settings.group_ledger_viewer_email
      ? settings.group_ledger_viewer_email.trim()
      : null;

    if (!targetMemberId && groupViewerEmail) {
      // Calculate daily group aggregates across all meals
      let totalPeriodLunch = 0;
      let totalPeriodDinner = 0;
      let totalPeriodCost = 0;

      const dailyGroupBreakdown = datesInRange.map((date) => {
        const dayMeals = allMeals.filter((m: any) => m.meal_date === date);
        let lunchCount = 0;
        let dinnerCount = 0;
        let cost = 0;

        for (const m of dayMeals) {
          if (m.quantity > 0) {
            if (m.session === "lunch") lunchCount += m.quantity;
            if (m.session === "dinner") dinnerCount += m.quantity;
            cost += m.quantity * m.unit_price;
          }
        }

        totalPeriodLunch += lunchCount;
        totalPeriodDinner += dinnerCount;
        totalPeriodCost += cost;

        return {
          date,
          dayName: getDayName(date),
          lunchCount,
          dinnerCount,
          totalMeals: lunchCount + dinnerCount,
          totalCost: cost,
        };
      });

      const totalPeriodMeals = totalPeriodLunch + totalPeriodDinner;

      // Group period deposits
      const totalPeriodDeposits = allDeposits
        .filter((d: any) => d.deposit_date >= startDate! && d.deposit_date <= endDate!)
        .reduce((acc: number, d: any) => acc + d.amount, 0);

      // Lifetime group totals (up to endDate)
      const lifetimeDeposits = allDeposits
        .filter((d: any) => !endDate || d.deposit_date <= endDate)
        .reduce((acc: number, d: any) => acc + d.amount, 0);

      const lifetimeCost = allMeals
        .filter((m: any) => (!endDate || m.meal_date <= endDate) && m.quantity > 0)
        .reduce((acc: number, m: any) => acc + m.quantity * m.unit_price, 0);

      const currentGroupBalance = lifetimeDeposits - lifetimeCost;
      const activeMembersCount = members.filter((m: any) => m.status === "active").length;

      const isDuplicate = alreadySentEmails.has(groupViewerEmail.toLowerCase()) && !force;

      const groupHtml = renderGroupLedgerViewerEmailHtml({
        appName: settings.app_name || "Mill Manager",
        startDate: startDate!,
        endDate: endDate!,
        dailyGroupBreakdown,
        totalPeriodMeals,
        totalPeriodLunch,
        totalPeriodDinner,
        totalPeriodCost,
        totalPeriodDeposits,
        lifetimeDeposits,
        lifetimeCost,
        currentGroupBalance,
        activeMembersCount,
      });

      preparedReports.push({
        recipient_type: "group_viewer",
        recipient_email: groupViewerEmail,
        member_id: null,
        member_name: "Group Ledger Viewer",
        subject: `[${settings.app_name || "Mill Manager"}] Weekly Group Aggregate Ledger: ${formatReadableDate(startDate!)} - ${formatReadableDate(endDate!)}`,
        htmlBody: groupHtml,
        is_duplicate: isDuplicate,
        metadata: {
          totalPeriodMeals,
          totalPeriodCost,
          currentGroupBalance,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        auto_email_enabled: Boolean(settings.auto_email_enabled),
        period: { startDate, endDate },
        total_reports: preparedReports.length,
        reports: preparedReports,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

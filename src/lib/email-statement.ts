import { formatBDT, formatDate, getTodayInDhaka } from "@/lib/date";

export interface StatementDailyItem {
  date: string;
  dayName: string;
  lunch: number;
  dinner: number;
  totalMeals: number;
  cost: number;
}

export interface StatementData {
  periodType: "week" | "month" | "all" | "custom";
  periodTitle: string;
  periodSubtitle: string;
  startDate: string;
  endDate: string;
  memberName: string;
  recipientEmail: string;
  dailyBreakdown: StatementDailyItem[];
  totalPeriodMeals: number;
  totalPeriodCost: number;
  totalPeriodDeposits: number;
  initialBalance?: number;
  lifetimeDeposits: number;
  lifetimeCost: number;
  currentBalance: number;
  appName: string;
}

const MONTH_NAMES_BN = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

const MONTH_NAMES_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DAYS_BN: Record<string, string> = {
  Sunday: "রবিবার",
  Monday: "সোমবার",
  Tuesday: "মঙ্গলবার",
  Wednesday: "বুধবার",
  Thursday: "বৃহস্পতিবার",
  Friday: "শুক্রবার",
  Saturday: "শনিবার",
};

export function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getUTCDay()];
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES_EN[m - 1]} ${y}`;
}

export function formatMonthYearBangla(year: number, month: number): string {
  return `${MONTH_NAMES_BN[month - 1]} ${year}`;
}

/**
 * Generate responsive HTML email for a Member Statement
 */
export function renderMemberStatementHtml(data: StatementData): string {
  const isAdvance = data.currentBalance >= 0;
  const balanceColor = isAdvance ? "#059669" : "#e11d48";
  const balanceBg = isAdvance ? "#ecfdf5" : "#fff1f2";
  const balanceBorder = isAdvance ? "#a7f3d0" : "#fecdd3";
  const balanceBadgeText = isAdvance ? "Advance (জমা আছে)" : "Due (বকেয়া আছে)";

  // Dynamic KPI labels based on period type
  let kpiMealsLabel = "এ সপ্তাহের মিল";
  let kpiCostLabel = "এ সপ্তাহের খরচ";
  let kpiDepositLabel = "এ সপ্তাহের জমা";
  let tableFooterLabel = "সাপ্তাহিক মোট (Weekly Total)";

  if (data.periodType === "all") {
    kpiMealsLabel = "সর্বমোট মিল (All Meals)";
    kpiCostLabel = "মিলের সর্বমোট খরচ";
    kpiDepositLabel = "সর্বমোট জমা (All Deposits)";
    tableFooterLabel = "সার্বিক মোট (All-Time Total)";
  } else if (data.periodType === "month") {
    kpiMealsLabel = "এ মাসের মোট মিল";
    kpiCostLabel = "এ মাসের মিল খরচ";
    kpiDepositLabel = "এ মাসের জমা";
    tableFooterLabel = "মাসিক মোট (Monthly Total)";
  } else if (data.periodType === "custom") {
    kpiMealsLabel = "সময়ের মোট মিল";
    kpiCostLabel = "সময়ের মিল খরচ";
    kpiDepositLabel = "সময়ের মোট জমা";
    tableFooterLabel = "মোট হিসাব (Period Total)";
  }

  // Filter out completely empty days if period is very long (e.g. all-time with hundreds of days)
  // But always show all days if under 35 days, or days with activity
  const displayRows =
    data.dailyBreakdown.length > 35
      ? data.dailyBreakdown.filter((r) => r.totalMeals > 0)
      : data.dailyBreakdown;

  const rowsHtml = displayRows
    .map((row) => {
      const isFri = row.dayName === "Friday";
      const highlightBg = isFri ? "#f8fafc" : "#ffffff";
      const dayBn = DAYS_BN[row.dayName] || row.dayName;
      return `
        <tr style="background-color: ${highlightBg}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">
            ${formatReadableDate(row.date)}
            ${isFri ? '<span style="font-size: 10px; background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Friday</span>' : ""}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b;">${dayBn} (${row.dayName})</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${row.lunch > 0 ? row.lunch : "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${isFri ? '<span style="color:#94a3b8; font-size:11px;">Closed</span>' : row.dinner > 0 ? row.dinner : "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: center; font-weight: 600;">${row.totalMeals}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatBDT(row.cost)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.periodTitle} - ${data.memberName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: left; border-bottom: 3px solid #059669;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
                      ${data.appName}
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">
                      ${data.periodSubtitle}
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
                      Verified Statement
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personal Greeting & Statement Period -->
          <tr>
            <td style="padding: 24px 24px 12px 24px;">
              <p style="margin: 0 0 6px 0; font-size: 16px; color: #1e293b;">
                আসসালামু আলাইকুম, <strong>${data.memberName}</strong>
              </p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                হিসাবের সময়কাল: <strong>${formatReadableDate(data.startDate)}</strong> থেকে <strong>${formatReadableDate(data.endDate)}</strong>
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
                      বর্তমান নিট ব্যালেন্স (Current Net Balance)
                    </span>
                    <div style="font-size: 28px; font-weight: 800; color: ${balanceColor}; margin: 4px 0 2px 0;">
                      ${formatBDT(data.currentBalance)}
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: ${balanceColor};">
                      ${balanceBadgeText}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: #64748b; line-height: 1.5; text-align: right;">
                      ${data.initialBalance !== undefined && data.initialBalance !== 0 ? `আগের / প্রারম্ভিক ব্যালেন্স: <strong style="color: ${data.initialBalance >= 0 ? "#059669" : "#e11d48"};">${formatBDT(data.initialBalance)}</strong><br>` : ""}
                      আজীবনের মোট জমা: <strong>${formatBDT(data.lifetimeDeposits)}</strong><br>
                      আজীবনের মোট মিল খরচ: <strong>${formatBDT(data.lifetimeCost)}</strong>
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
                  ${data.initialBalance !== undefined && data.initialBalance !== 0 ? `
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">আগের ব্যালেন্স</span>
                    <div style="font-size: 16px; font-weight: 700; color: ${data.initialBalance >= 0 ? "#059669" : "#e11d48"}; margin-top: 4px;">
                      ${formatBDT(data.initialBalance)}
                    </div>
                  </td>
                  ` : ""}
                  <td width="${data.initialBalance !== undefined && data.initialBalance !== 0 ? "25%" : "33%"}" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">${kpiMealsLabel}</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${data.totalPeriodMeals}
                    </div>
                  </td>
                  <td width="${data.initialBalance !== undefined && data.initialBalance !== 0 ? "25%" : "33%"}" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">${kpiCostLabel}</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                      ${formatBDT(data.totalPeriodCost)}
                    </div>
                  </td>
                  <td width="${data.initialBalance !== undefined && data.initialBalance !== 0 ? "25%" : "33%"}" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 500;">${kpiDepositLabel}</span>
                    <div style="font-size: 18px; font-weight: 700; color: #059669; margin-top: 4px;">
                      ${formatBDT(data.totalPeriodDeposits)}
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
                দৈনিক মিলের বিবরণী (Daily Meal Breakdown)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">তারিখ (Date)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">বার (Day)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">দুপুর</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">রাত</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">মোট মিল</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">খরচ</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748b; font-size: 13px;">এই সময়কালে কোনো মিল রেকর্ড নেই।</td></tr>`}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0;">
                    <td colspan="4" style="padding: 12px; font-size: 13px; color: #0f172a;">${tableFooterLabel}</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: center;">${data.totalPeriodMeals}</td>
                    <td style="padding: 12px; font-size: 13px; color: #0f172a; text-align: right;">${formatBDT(data.totalPeriodCost)}</td>
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
                    ${data.initialBalance !== undefined && data.initialBalance !== 0
                      ? `আগের ব্যালেন্স (${formatBDT(data.initialBalance)}) + সর্বমোট জমা (${formatBDT(data.lifetimeDeposits)}) - সর্বমোট মিল খরচ (${formatBDT(data.lifetimeCost)}) = বর্তমান ব্যালেন্স (<span style="color: ${balanceColor}; font-weight: 700;">${formatBDT(data.currentBalance)}</span>).`
                      : `সর্বমোট জমা (${formatBDT(data.lifetimeDeposits)}) - সর্বমোট মিল খরচ (${formatBDT(data.lifetimeCost)}) = বর্তমান ব্যালেন্স (<span style="color: ${balanceColor}; font-weight: 700;">${formatBDT(data.currentBalance)}</span>).`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Notice -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                This is an official meal statement from <strong>${data.appName}</strong>.<br>
                For any meal adjustments or questions, please contact the Mess Manager.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #94a3b8;">
                Dispatched at: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Bangladesh Time)
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate clean, readable plain-text fallback for a Member Statement
 * Essential for spam filter bypass and low-bandwidth email clients
 */
export function renderMemberStatementText(data: StatementData): string {
  const isAdvance = data.currentBalance >= 0;
  const statusLabel = isAdvance ? "Advance (জমা আছে)" : "Due (বকেয়া আছে)";

  const lines: string[] = [
    `============================================================`,
    `               ${(data.appName || "Mill Manager").toUpperCase()} - STATEMENT`,
    `============================================================`,
    ``,
    `আসসালামু আলাইকুম, ${data.memberName}`,
    `বিবরণী: ${data.periodSubtitle}`,
    `হিসাবের সময়কাল: ${formatReadableDate(data.startDate)} থেকে ${formatReadableDate(data.endDate)}`,
    ``,
    `------------------------------------------------------------`,
    `[বর্তমান নিট ব্যালেন্স / CURRENT NET BALANCE]`,
    `>> ${formatBDT(data.currentBalance)} (${statusLabel})`,
    `------------------------------------------------------------`,
    ``,
    `[আর্থিক সারসংক্ষেপ / FINANCIAL SUMMARY]`,
  ];

  if (data.initialBalance !== undefined && data.initialBalance !== 0) {
    lines.push(`- পূর্বের বকেয়া / প্রারম্ভিক ব্যালেন্স: ${formatBDT(data.initialBalance)}`);
  }
  lines.push(`- এ সময়ের মোট মিল: ${data.totalPeriodMeals}`);
  lines.push(`- এ সময়ের মিল খরচ: ${formatBDT(data.totalPeriodCost)}`);
  lines.push(`- এ সময়ের মোট জমা: ${formatBDT(data.totalPeriodDeposits)}`);
  lines.push(`- আজীবনের মোট জমা: ${formatBDT(data.lifetimeDeposits)}`);
  lines.push(`- আজীবনের মোট মিল খরচ: ${formatBDT(data.lifetimeCost)}`);
  lines.push(``);

  const displayRows =
    data.dailyBreakdown.length > 35
      ? data.dailyBreakdown.filter((r) => r.totalMeals > 0)
      : data.dailyBreakdown;

  if (displayRows.length > 0) {
    lines.push(`------------------------------------------------------------`);
    lines.push(`[দৈনিক মিলের বিবরণী / DAILY BREAKDOWN]`);
    lines.push(`তারিখ         | বার        | দুপুর | রাত | মোট | খরচ`);
    lines.push(`------------- | ---------- | ---- | --- | --- | --------`);
    for (const r of displayRows) {
      const dateStr = formatReadableDate(r.date).padEnd(13, " ");
      const dayBn = (DAYS_BN[r.dayName] || r.dayName).padEnd(10, " ");
      const lunch = String(r.lunch > 0 ? r.lunch : "-").padStart(4, " ");
      const dinner = String(r.dayName === "Friday" ? "X" : r.dinner > 0 ? r.dinner : "-").padStart(3, " ");
      const total = String(r.totalMeals).padStart(3, " ");
      const cost = formatBDT(r.cost).padStart(8, " ");
      lines.push(`${dateStr} | ${dayBn} | ${lunch} | ${dinner} | ${total} | ${cost}`);
    }
    lines.push(`------------- | ---------- | ---- | --- | --- | --------`);
    lines.push(`মোট মিল: ${data.totalPeriodMeals} | মোট খরচ: ${formatBDT(data.totalPeriodCost)}`);
    lines.push(``);
  }

  lines.push(`------------------------------------------------------------`);
  lines.push(`[হিসাব সমন্বয় সূত্র / RECONCILIATION FORMULA]`);
  if (data.initialBalance !== undefined && data.initialBalance !== 0) {
    lines.push(`পূর্বের ব্যালেন্স (${formatBDT(data.initialBalance)}) + মোট জমা (${formatBDT(data.lifetimeDeposits)}) - মোট খরচ (${formatBDT(data.lifetimeCost)}) = বর্তমান নিট ব্যালেন্স (${formatBDT(data.currentBalance)})`);
  } else {
    lines.push(`মোট জমা (${formatBDT(data.lifetimeDeposits)}) - মোট খরচ (${formatBDT(data.lifetimeCost)}) = বর্তমান নিট ব্যালেন্স (${formatBDT(data.currentBalance)})`);
  }
  lines.push(``);
  lines.push(`============================================================`);
  lines.push(`This is an official automated notification from ${data.appName || "Mill Manager"}.`);
  lines.push(`If you have any questions or meal discrepancies, contact your Mess Manager.`);
  lines.push(`============================================================`);

  return lines.join("\n");
}

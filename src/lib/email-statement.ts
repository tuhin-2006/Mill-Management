import { formatBDT, formatDate, getTodayInDhaka } from "@/lib/date";

export interface StatementDailyItem {
  date: string;
  dayName: string;
  lunch: number;
  dinner: number;
  totalMeals: number;
  cost: number;
}

export interface StatementDepositItem {
  id?: string;
  date: string;
  amount: number;
  note?: string | null;
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
  openingBalance: number;
  periodDepositsList?: StatementDepositItem[];
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

  const isOpeningAdvance = data.openingBalance >= 0;
  const openingColor = isOpeningAdvance ? "#059669" : "#e11d48";

  // Dynamic KPI labels based on period type
  let kpiMealsLabel = "এ সপ্তাহের মিল";
  let kpiCostLabel = "এ সপ্তাহের খরচ";
  let kpiDepositLabel = "এ সপ্তাহের জমা";
  let tableFooterLabel = "সাপ্তাহিক মোট (Weekly Total)";
  let periodNameBn = "এ সপ্তাহের";

  if (data.periodType === "all") {
    kpiMealsLabel = "সর্বমোট মিল";
    kpiCostLabel = "মিলের সর্বমোট খরচ";
    kpiDepositLabel = "সর্বমোট জমা";
    tableFooterLabel = "সার্বিক মোট (All-Time Total)";
    periodNameBn = "সর্বমোট";
  } else if (data.periodType === "month") {
    kpiMealsLabel = "এ মাসের মোট মিল";
    kpiCostLabel = "এ মাসের মিল খরচ";
    kpiDepositLabel = "এ মাসের জমা";
    tableFooterLabel = "মাসিক মোট (Monthly Total)";
    periodNameBn = "এ মাসের";
  } else if (data.periodType === "custom") {
    kpiMealsLabel = "সময়ের মোট মিল";
    kpiCostLabel = "সময়ের মিল খরচ";
    kpiDepositLabel = "সময়ের মোট জমা";
    tableFooterLabel = "মোট হিসাব (Period Total)";
    periodNameBn = "সময়ের";
  }

  // Filter out completely empty days if period is very long (e.g. all-time with hundreds of days)
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

  // Payment & Deposit History Rows
  const depositsList = data.periodDepositsList || [];
  const depositsRowsHtml = depositsList
    .map((dep) => {
      return `
        <tr style="background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">
            ${formatReadableDate(dep.date)}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b;">
            ${dep.note || "নগদ জমা / Payment"}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #059669; text-align: right; font-weight: 700;">
            +${formatBDT(dep.amount)}
          </td>
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
                    <div style="font-size: 30px; font-weight: 900; color: ${balanceColor}; margin: 4px 0 2px 0;">
                      ${formatBDT(data.currentBalance)}
                    </div>
                    <span style="font-size: 12px; font-weight: 700; color: ${balanceColor};">
                      ${balanceBadgeText}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: #64748b; line-height: 1.6; text-align: right;">
                      পূর্বের ব্যালেন্স: <strong style="color: ${openingColor};">${formatBDT(data.openingBalance)}</strong><br>
                      ${periodNameBn} মিল খরচ: <strong style="color: #e11d48;">-${formatBDT(data.totalPeriodCost)}</strong><br>
                      ${periodNameBn} জমা: <strong style="color: #059669;">+${formatBDT(data.totalPeriodDeposits)}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- KPI Metric 4-Grid Cards -->
          <tr>
            <td style="padding: 8px 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="8" cellpadding="0">
                <tr>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">১. পূর্বের ব্যালেন্স</span>
                    <div style="font-size: 16px; font-weight: 800; color: ${openingColor}; margin-top: 4px;">
                      ${formatBDT(data.openingBalance)}
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">${isOpeningAdvance ? "অগ্রিম জমা" : "পূর্বের বকেয়া"}</span>
                  </td>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">২. ${kpiMealsLabel}</span>
                    <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                      ${data.totalPeriodMeals} টি
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">খরচ: ${formatBDT(data.totalPeriodCost)}</span>
                  </td>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">৩. ${kpiDepositLabel}</span>
                    <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px;">
                      +${formatBDT(data.totalPeriodDeposits)}
                    </div>
                    <span style="font-size: 10px; color: #94a3b8;">${depositsList.length} টি পেমেন্ট</span>
                  </td>
                  <td width="25%" style="background-color: ${balanceBg}; border: 1px solid ${balanceBorder}; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: ${balanceColor}; font-weight: 700; text-transform: uppercase;">৪. নতুন ব্যালেন্স</span>
                    <div style="font-size: 16px; font-weight: 800; color: ${balanceColor}; margin-top: 4px;">
                      ${formatBDT(data.currentBalance)}
                    </div>
                    <span style="font-size: 10px; color: ${balanceColor};">${isAdvance ? "Advance" : "Due"}</span>
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

          <!-- Payment & Deposit History Section (Requirement) -->
          <tr>
            <td style="padding: 16px 24px 8px 24px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
                পেমেন্ট ও জমার বিবরণী (Payment & Deposit History)
              </h3>
              ${depositsList.length > 0 ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">তারিখ (Date)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">বিবরণ / নোট (Note)</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">জমা (Amount)</th>
                  </tr>
                </thead>
                <tbody>
                  ${depositsRowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #ecfdf5; font-weight: 700; border-top: 2px solid #a7f3d0;">
                    <td colspan="2" style="padding: 10px 12px; font-size: 13px; color: #065f46;">${periodNameBn} মোট জমা (Total Deposited)</td>
                    <td style="padding: 10px 12px; font-size: 13px; color: #059669; text-align: right;">+${formatBDT(data.totalPeriodDeposits)}</td>
                  </tr>
                </tfoot>
              </table>
              ` : `
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
                ℹ️ এই সময়কালে কোনো নগদ জমা বা পেমেন্ট রেকর্ড নেই (No payments recorded in this period)।
              </div>
              `}
            </td>
          </tr>

          <!-- Accurate Reconciliation Breakdown -->
          <tr>
            <td style="padding: 16px 24px 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.7;">
                    <strong>হিসাব সমন্বয় সূত্র (Reconciliation Formula):</strong><br>
                    পূর্বের ব্যালেন্স (<span style="color: ${openingColor}; font-weight: 700;">${formatBDT(data.openingBalance)}</span>)
                    + ${periodNameBn} জমা (<span style="color: #059669; font-weight: 700;">+${formatBDT(data.totalPeriodDeposits)}</span>)
                    - ${periodNameBn} মিল খরচ (<span style="color: #e11d48; font-weight: 700;">-${formatBDT(data.totalPeriodCost)}</span>)
                    = বর্তমান নিট ব্যালেন্স (<span style="color: ${balanceColor}; font-weight: 800; font-size: 13px;">${formatBDT(data.currentBalance)}</span>).
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
    `- ১. পূর্বের ব্যালেন্স (Opening Balance): ${formatBDT(data.openingBalance)}`,
    `- ২. এ সময়ের মোট মিল: ${data.totalPeriodMeals} (খরচ: ${formatBDT(data.totalPeriodCost)})`,
    `- ৩. এ সময়ের মোট জমা (Deposits): ${formatBDT(data.totalPeriodDeposits)}`,
    `- ৪. বর্তমান চূড়ান্ত ব্যালেন্স: ${formatBDT(data.currentBalance)} (${statusLabel})`,
    ``,
  ];

  const displayRows =
    data.dailyBreakdown.length > 35
      ? data.dailyBreakdown.filter((r) => r.totalMeals > 0)
      : data.dailyBreakdown;

  if (displayRows.length > 0) {
    lines.push(`------------------------------------------------------------`);
    lines.push(`[দৈনিক মিলের বিবরণী / DAILY MEAL BREAKDOWN]`);
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

  const depositsList = data.periodDepositsList || [];
  lines.push(`------------------------------------------------------------`);
  lines.push(`[পেমেন্ট ও জমার বিবরণী / PAYMENT HISTORY]`);
  if (depositsList.length > 0) {
    lines.push(`তারিখ         | বিবরণ                      | জমা`);
    lines.push(`------------- | -------------------------- | --------`);
    for (const dep of depositsList) {
      const dateStr = formatReadableDate(dep.date).padEnd(13, " ");
      const noteStr = (dep.note || "Payment").slice(0, 26).padEnd(26, " ");
      const amtStr = formatBDT(dep.amount).padStart(8, " ");
      lines.push(`${dateStr} | ${noteStr} | +${amtStr}`);
    }
    lines.push(`------------- | -------------------------- | --------`);
    lines.push(`মোট জমা: +${formatBDT(data.totalPeriodDeposits)}`);
  } else {
    lines.push(`এই সময়কালে কোনো নতুন জমা রেকর্ড নেই (No payments in this period).`);
  }
  lines.push(``);

  lines.push(`------------------------------------------------------------`);
  lines.push(`[হিসাব সমন্বয় সূত্র / RECONCILIATION FORMULA]`);
  lines.push(
    `পূর্বের ব্যালেন্স (${formatBDT(data.openingBalance)}) + এ সময়ের জমা (+${formatBDT(data.totalPeriodDeposits)}) - মিল খরচ (-${formatBDT(data.totalPeriodCost)}) = বর্তমান নিট ব্যালেন্স (${formatBDT(data.currentBalance)})`
  );
  lines.push(``);
  lines.push(`============================================================`);
  lines.push(`This is an official automated notification from ${data.appName || "Mill Manager"}.`);
  lines.push(`If you have any questions or meal discrepancies, contact your Mess Manager.`);
  lines.push(`============================================================`);

  return lines.join("\n");
}

export interface GroupLedgerDailyItem {
  date: string;
  dayName: string;
  lunchCount: number;
  dinnerCount: number;
  totalMeals: number;
  totalCost: number;
}

export interface GroupDepositRecord {
  id: string;
  date: string;
  memberName: string;
  amount: number;
  note?: string;
}

export interface GroupLedgerViewerEmailData {
  appName: string;
  startDate: string;
  endDate: string;
  dailyGroupBreakdown: GroupLedgerDailyItem[];
  totalPeriodMeals: number;
  totalPeriodLunch: number;
  totalPeriodDinner: number;
  totalPeriodCost: number;
  totalPeriodDeposits: number;
  lifetimeDeposits: number;
  lifetimeCost: number;
  initialBalance: number;
  currentGroupBalance: number;
  activeMembersCount: number;
  periodDepositsList?: GroupDepositRecord[];
}

export function renderGroupLedgerViewerEmailHtml(params: GroupLedgerViewerEmailData): string {
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
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b;">${DAYS_BN[row.dayName] || row.dayName}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${row.lunchCount}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; text-align: center;">${isFri ? '<span style="color:#94a3b8; font-size:11px;">Closed</span>' : row.dinnerCount}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: center; font-weight: 600;">${row.totalMeals}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatBDT(row.totalCost)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Group Aggregate Ledger</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
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

          <!-- Privacy Notice -->
          <tr>
            <td style="padding: 16px 24px 8px 24px;">
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.4;">
                  <strong>Privacy Notice:</strong> এই রিপোর্টটি শুধুমাত্র সম্মিলিত গ্রুপ হিসাব পর্যবেক্ষণের জন্য। নীতিমালা অনুযায়ী এতে কোনো একক সদস্যের ব্যক্তিগত নাম বা ব্যক্তিগত তথ্য অন্তর্ভুক্ত করা হয়নি।
                </p>
              </div>
            </td>
          </tr>

          <!-- Period Details -->
          <tr>
            <td style="padding: 12px 24px 8px 24px;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                হিসাবের সময়কাল: <strong>${formatReadableDate(params.startDate)}</strong> থেকে <strong>${formatReadableDate(params.endDate)}</strong>
                &nbsp;|&nbsp; সক্রিয় সদস্য: <strong>${params.activeMembersCount} জন</strong>
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
                      মেসের বর্তমান মোট তহবিল (Group Net Treasury Balance)
                    </span>
                    <div style="font-size: 28px; font-weight: 800; color: ${balanceColor}; margin: 4px 0 2px 0;">
                      ${formatBDT(params.currentGroupBalance)}
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: ${balanceColor};">
                      ${balanceStatus}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: #64748b; line-height: 1.5; text-align: right;">
                      প্রারম্ভিক মোট জের: <strong>${formatBDT(params.initialBalance)}</strong><br>
                      গ্রুপের সর্বমোট জমা: <strong>${formatBDT(params.lifetimeDeposits)}</strong><br>
                      গ্রুপের সর্বমোট খরচ: <strong>${formatBDT(params.lifetimeCost)}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- KPI Metric Cards Grid (4 Core Financial Cards) -->
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="8" cellpadding="0">
                <tr>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">প্রারম্ভিক জের</span>
                    <div style="font-size: 16px; font-weight: 800; color: ${params.initialBalance >= 0 ? "#059669" : "#e11d48"}; margin-top: 4px;">
                      ${formatBDT(params.initialBalance)}
                    </div>
                    <span style="font-size: 9px; color: #94a3b8;">${params.initialBalance < 0 ? "বকেয়া / Deficit" : "উদ্বৃত্ত / Surplus"}</span>
                  </td>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">সাপ্তাহিক মিল</span>
                    <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                      ${params.totalPeriodMeals}
                    </div>
                    <span style="font-size: 9px; color: #94a3b8;">${params.totalPeriodLunch} দু. / ${params.totalPeriodDinner} রাত</span>
                  </td>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">সাপ্তাহিক খরচ</span>
                    <div style="font-size: 16px; font-weight: 800; color: #e11d48; margin-top: 4px;">
                      ${formatBDT(params.totalPeriodCost)}
                    </div>
                    <span style="font-size: 9px; color: #94a3b8;">Meal Cost</span>
                  </td>
                  <td width="25%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">সাপ্তাহিক জমা</span>
                    <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px;">
                      ${formatBDT(params.totalPeriodDeposits)}
                    </div>
                    <span style="font-size: 9px; color: #94a3b8;">${params.periodDepositsList?.length || 0}টি পেমেন্ট</span>
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

          <!-- Payment & Deposit Records Section -->
          <tr>
            <td style="padding: 16px 24px 8px 24px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
                সাপ্তাহিক জমার বিবরণী (Weekly Payment & Deposit Records)
              </h3>
              ${
                params.periodDepositsList && params.periodDepositsList.length > 0
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                          <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">তারিখ (Date)</th>
                          <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">সদস্য (Member)</th>
                          <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">নোট / বিবরণ</th>
                          <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">জমা পরিমাণ (BDT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${params.periodDepositsList
                          .map(
                            (dep) => `
                          <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">${formatReadableDate(dep.date)}</td>
                            <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; font-weight: 600;">${dep.memberName}</td>
                            <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${dep.note || "Regular Deposit"}</td>
                            <td style="padding: 10px 12px; font-size: 13px; color: #059669; font-weight: 700; text-align: right;">+${formatBDT(dep.amount)}</td>
                          </tr>
                        `
                          )
                          .join("")}
                      </tbody>
                      <tfoot>
                        <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0;">
                          <td colspan="3" style="padding: 12px; font-size: 13px; color: #0f172a;">মোট সংগৃহীত জমা (Total Deposited)</td>
                          <td style="padding: 12px; font-size: 13px; color: #059669; text-align: right;">+${formatBDT(params.totalPeriodDeposits)}</td>
                        </tr>
                      </tfoot>
                    </table>`
                  : `<div style="padding: 14px; text-align: center; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 12px; color: #64748b;">
                      এই সপ্তাহে কোনো সদস্যের জমা রেকর্ড করা হয়নি (No payment deposits recorded in this period).
                    </div>`
              }
            </td>
          </tr>

          <!-- Treasury Reconciliation Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    <strong>সম্মিলিত তহবিল হিসাব সমন্বয় (Treasury Reconciliation):</strong><br>
                    প্রারম্ভিক জের (${formatBDT(params.initialBalance)}) + মোট সংগৃহীত জমা (${formatBDT(params.lifetimeDeposits)}) - সর্বমোট মিল খরচ (${formatBDT(params.lifetimeCost)}) = অবশিষ্ট মোট তহবিল (<span style="color: ${balanceColor}; font-weight: 700;">${formatBDT(params.currentGroupBalance)}</span>).
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
</html>`;
}

export function renderGroupLedgerViewerEmailText(params: GroupLedgerViewerEmailData): string {
  const isSurplus = params.currentGroupBalance >= 0;
  const balanceStatus = isSurplus ? "Surplus (জমা উদ্বৃত্ত)" : "Deficit (ঘাটতি)";

  const lines: string[] = [
    `============================================================`,
    `${params.appName.toUpperCase()} — GROUP LEDGER REPORT`,
    `সম্মিলিত সাপ্তাহিক মেস হিসাব বিবরণী (Aggregated Group Statement)`,
    `============================================================`,
    `Audit Period: ${formatReadableDate(params.startDate)} to ${formatReadableDate(params.endDate)}`,
    `Active Members: ${params.activeMembersCount}`,
    `------------------------------------------------------------`,
    `[গ্রুপের বর্তমান মোট তহবিল / GROUP TREASURY BALANCE]`,
    `>> ${formatBDT(params.currentGroupBalance)} (${balanceStatus})`,
    `- প্রারম্ভিক মোট জের: ${formatBDT(params.initialBalance)}`,
    `- সর্বমোট সংগৃহীত জমা: ${formatBDT(params.lifetimeDeposits)}`,
    `- সর্বমোট মিল খরচ: ${formatBDT(params.lifetimeCost)}`,
    `------------------------------------------------------------`,
    `[সাপ্তাহিক গ্রুপ কার্যক্রম / WEEKLY ACTIVITY]`,
    `- প্রারম্ভিক জের: ${formatBDT(params.initialBalance)}`,
    `- মোট মিল: ${params.totalPeriodMeals} (${params.totalPeriodLunch} Lunch / ${params.totalPeriodDinner} Dinner)`,
    `- সাপ্তাহিক মিল খরচ: ${formatBDT(params.totalPeriodCost)}`,
    `- সাপ্তাহিক সংগৃহীত জমা: ${formatBDT(params.totalPeriodDeposits)}`,
    `------------------------------------------------------------`,
    `[সম্মিলিত দৈনিক মিলের খতিয়ান / DAILY GROUP BREAKDOWN]`,
    `তারিখ         | বার        | দুপুর | রাত | মোট | মোট খরচ`,
    `------------- | ---------- | ---- | --- | --- | --------`,
  ];

  for (const r of params.dailyGroupBreakdown) {
    const dateStr = formatReadableDate(r.date).padEnd(13, " ");
    const dayBn = (DAYS_BN[r.dayName] || r.dayName).padEnd(10, " ");
    const lunch = String(r.lunchCount).padStart(4, " ");
    const dinner = String(r.dayName === "Friday" ? "X" : r.dinnerCount).padStart(3, " ");
    const total = String(r.totalMeals).padStart(3, " ");
    const cost = formatBDT(r.totalCost).padStart(8, " ");
    lines.push(`${dateStr} | ${dayBn} | ${lunch} | ${dinner} | ${total} | ${cost}`);
  }

  lines.push(`------------- | ---------- | ---- | --- | --- | --------`);
  lines.push(`সাপ্তাহিক মোট: ${params.totalPeriodMeals} মিল | মোট খরচ: ${formatBDT(params.totalPeriodCost)}`);
  lines.push(``);

  if (params.periodDepositsList && params.periodDepositsList.length > 0) {
    lines.push(`------------------------------------------------------------`);
    lines.push(`[সাপ্তাহিক জমার বিবরণী / WEEKLY PAYMENT DEPOSITS]`);
    lines.push(`তারিখ         | সদস্য         | বিবরণ        | জমা পরিমাণ`);
    lines.push(`------------- | ------------- | ------------ | -----------`);
    for (const d of params.periodDepositsList) {
      const dDate = formatReadableDate(d.date).padEnd(13, " ");
      const dName = d.memberName.padEnd(13, " ");
      const dNote = (d.note || "Deposit").padEnd(12, " ");
      const dAmount = `+${formatBDT(d.amount)}`.padStart(11, " ");
      lines.push(`${dDate} | ${dName} | ${dNote} | ${dAmount}`);
    }
    lines.push(`------------- | ------------- | ------------ | -----------`);
    lines.push(`মোট সংগৃহীত জমা: +${formatBDT(params.totalPeriodDeposits)}`);
    lines.push(``);
  }

  lines.push(`------------------------------------------------------------`);
  lines.push(`[সম্মিলিত তহবিল হিসাব সমন্বয় / TREASURY RECONCILIATION]`);
  lines.push(
    `প্রারম্ভিক জের (${formatBDT(params.initialBalance)}) + মোট জমা (${formatBDT(params.lifetimeDeposits)}) - মোট খরচ (${formatBDT(params.lifetimeCost)}) = বর্তমান তহবিল (${formatBDT(params.currentGroupBalance)})`
  );
  lines.push(`------------------------------------------------------------`);
  lines.push(`[গোপনীয়তা বিষয়ক বিজ্ঞপ্তি / PRIVACY NOTICE]`);
  lines.push(`এই রিপোর্টটি শুধুমাত্র সম্মিলিত গ্রুপ হিসাব পর্যবেক্ষণের জন্য।`);
  lines.push(`এতে কোনো একক সদস্যের ব্যক্তিগত নাম বা তথ্য অন্তর্ভুক্ত করা হয়নি।`);
  lines.push(`============================================================`);

  return lines.join("\n");
}

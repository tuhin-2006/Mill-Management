/**
 * Date and currency helper utilities for Asia/Dhaka timezone.
 */

export const DHAKA_TIMEZONE = "Asia/Dhaka";

/**
 * Returns today's date in YYYY-MM-DD formatted specifically in Asia/Dhaka timezone.
 */
export function getTodayInDhaka(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Formats a YYYY-MM-DD string into a readable date (e.g. "15 Nov 2026").
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a YYYY-MM-DD string into full date format (e.g. "Sunday, 15 November 2026").
 */
export function formatFullDate(dateString: string): string {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Returns the weekday name (e.g. "Friday", "Saturday") for a given date in Dhaka.
 */
export function getWeekdayName(dateString: string): string {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TIMEZONE,
    weekday: "long",
  }).format(date);
}

/**
 * Checks if the given date is a Friday in Dhaka.
 */
export function isFridayDate(dateString: string): boolean {
  return getWeekdayName(dateString).toLowerCase() === "friday";
}

/**
 * Formats an amount into BDT (e.g. ৳60 or ৳1,200).
 */
export function formatBDT(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return isNegative ? `-৳${formatted}` : `৳${formatted}`;
}

export type DatePreset = "this_week" | "this_month" | "last_month" | "all";

/**
 * Returns startDate and endDate strings in YYYY-MM-DD for a chosen preset.
 */
export function getPresetDateRange(preset: DatePreset): {
  startDate: string;
  endDate: string;
} {
  const today = getTodayInDhaka();
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (preset === "all") {
    return { startDate: "", endDate: "" };
  }

  if (preset === "this_month") {
    const start = `${yearStr}-${String(month).padStart(2, "0")}-01`;
    return { startDate: start, endDate: today };
  }

  if (preset === "last_month") {
    let lastMonthYear = year;
    let lastMonth = month - 1;
    if (lastMonth < 1) {
      lastMonth = 12;
      lastMonthYear = year - 1;
    }
    const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth, 0).getDate();
    const start = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
    const end = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-${String(lastDayOfLastMonth).padStart(2, "0")}`;
    return { startDate: start, endDate: end };
  }

  if (preset === "this_week") {
    const now = new Date(year, month - 1, day);
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    const pYear = past7.getFullYear();
    const pMonth = String(past7.getMonth() + 1).padStart(2, "0");
    const pDay = String(past7.getDate()).padStart(2, "0");
    return {
      startDate: `${pYear}-${pMonth}-${pDay}`,
      endDate: today,
    };
  }

  return { startDate: "", endDate: "" };
}

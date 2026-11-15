"use client";

import * as React from "react";
import {
  Mail,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Send,
  Users,
  Power,
  Search,
  Sparkles,
  Info,
  Calendar,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMembers, getSettings, updateSettings, getEmailLogs } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date";
import { Member, Settings, EmailLog } from "@/types";
import { toast } from "sonner";

export default function EmailReportsPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Toggle state
  const [isToggling, setIsToggling] = React.useState(false);

  // Manual trigger states
  const [isDispatching, setIsDispatching] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [showConfirmDispatch, setShowConfirmDispatch] = React.useState(false);

  // Logs search and filter
  const [logFilter, setLogFilter] = React.useState<"all" | "sent" | "failed" | "skipped_duplicate">("all");
  const [logSearch, setLogSearch] = React.useState("");

  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const [membersData, settingsData, logsData] = await Promise.all([
        getMembers(supabase),
        getSettings(supabase),
        getEmailLogs(supabase, 100),
      ]);

      setMembers(membersData);
      setSettings(settingsData);
      setLogs((logsData as unknown as EmailLog[]) || []);
    } catch (err) {
      toast.error("Failed to load email reports data: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Toggle Automatic Friday Email Sending ON / OFF
  const handleToggleAutoEmail = async () => {
    if (!settings) return;
    const currentState = Boolean(settings.auto_email_enabled);
    const nextState = !currentState;

    try {
      setIsToggling(true);
      const supabase = createClient();
      const updated = await updateSettings(supabase, {
        auto_email_enabled: nextState,
      });

      setSettings(updated);

      if (nextState) {
        toast.success("✅ Automatic weekly reporting is now ACTIVE! Emails will send every Friday at 8:00 PM.");
      } else {
        toast.info("🔒 Safety Lock Activated. Automatic email sending is now PAUSED.");
      }
    } catch (err: unknown) {
      toast.error("Failed to update automatic email status: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsToggling(false);
    }
  };

  // Send Test Preview Email
  const handleSendTestEmail = async () => {
    try {
      setIsTesting(true);
      const res = await fetch("/api/admin/dispatch-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_preview",
          targetEmail: "mdmostofarahmantuhin2001@gmail.com",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate test email");
      }

      toast.success("Test preview generated! Check your Gmail (mdmostofarahmantuhin2001@gmail.com).");
    } catch (err: unknown) {
      toast.error("Test email failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsTesting(false);
    }
  };

  // Dispatch Weekly Reports Now (Manual trigger)
  const handleDispatchNow = async () => {
    try {
      setIsDispatching(true);
      setShowConfirmDispatch(false);

      const res = await fetch("/api/admin/dispatch-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_dispatch" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger dispatch");
      }

      toast.success(`Reports prepared for period ${data.period?.startDate} to ${data.period?.endDate}.`);
      loadData();
    } catch (err: unknown) {
      toast.error("Dispatch failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsDispatching(false);
    }
  };

  const isAutoEnabled = Boolean(settings?.auto_email_enabled);
  const membersWithEmail = members.filter((m) => m.email && m.email.trim());

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      const matchesFilter = logFilter === "all" || log.status === logFilter;
      const matchesSearch =
        !logSearch.trim() ||
        log.recipient_email.toLowerCase().includes(logSearch.toLowerCase().trim()) ||
        log.recipient_type.toLowerCase().includes(logSearch.toLowerCase().trim());
      return matchesFilter && matchesSearch;
    });
  }, [logs, logFilter, logSearch]);

  const sentCount = logs.filter((l) => l.status === "sent").length;
  const skippedCount = logs.filter((l) => l.status === "skipped_duplicate").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Email Reports & Automation"
        description="Control automated Friday email reporting, toggle schedule ON/OFF, and monitor delivery audit logs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              className="gap-1.5"
            >
              <RotateCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowConfirmDispatch(true)}
              className="gap-1.5 shadow-xs"
            >
              <Send className="h-4 w-4" />
              <span>Send Reports Now</span>
            </Button>
          </div>
        }
      />

      {/* 1. MASTER AUTOMATIC SENDING SWITCH CARD */}
      <Card
        className={`border-2 transition-all shadow-sm ${
          isAutoEnabled
            ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20"
            : "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
        }`}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                {isAutoEnabled ? (
                  <Badge variant="success" className="px-2.5 py-1 text-xs gap-1.5 font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>AUTOMATIC FRIDAY DISPATCH: ACTIVE (সক্রিয়)</span>
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="px-2.5 py-1 text-xs gap-1.5 font-bold bg-amber-600 text-white">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>SAFETY LOCK ACTIVE: SENDING PAUSED (স্থগিত)</span>
                  </Badge>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {isAutoEnabled
                  ? "স্বয়ংক্রিয় সাপ্তাহিক ইমেইল রিপোর্ট চালু রয়েছে"
                  : "স্বয়ংক্রিয় সাপ্তাহিক ইমেইল রিপোর্ট বন্ধ রয়েছে (নিরাপদ অবস্থা)"}
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                {isAutoEnabled
                  ? "প্রতি শুক্রবার রাত ৮:০০ টায় (Asia/Dhaka) গুগল অ্যাপস স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে সকল সক্রিয় সদস্যের কাছে ব্যক্তিগত সাপ্তাহিক হিসাব এবং গ্রুপ লেজার ভিউয়ারের কাছে সামগ্রিক রিপোর্ট পাঠিয়ে দেবে।"
                  : "অ্যাডমিন অনুমতি ছাড়া কোনো ইমেইল স্বয়ংক্রিয়ভাবে পাঠানো হবে না। আপনি প্রস্তুত হলে নিচের সুইচে ক্লিক করে এটি এক ক্লিকে চালু করতে পারেন।"}
              </p>
            </div>

            {/* BIG ON / OFF TOGGLE BUTTON */}
            <div className="flex flex-col items-center sm:items-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
              <button
                type="button"
                onClick={handleToggleAutoEmail}
                disabled={isToggling}
                className={`relative inline-flex h-9 w-20 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isAutoEnabled ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
                role="switch"
                aria-checked={isAutoEnabled}
              >
                <span className="sr-only">Toggle Automatic Sending</span>
                <span
                  className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center text-xs font-bold ${
                    isAutoEnabled ? "translate-x-11 text-emerald-600" : "translate-x-0 text-muted-foreground"
                  }`}
                >
                  {isToggling ? (
                    <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isAutoEnabled ? (
                    "ON"
                  ) : (
                    "OFF"
                  )}
                </span>
              </button>

              <span className="text-[11px] font-semibold text-muted-foreground">
                Click to turn {isAutoEnabled ? "OFF (Pause)" : "ON (Enable)"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. OVERVIEW METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Email Provider */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Channel
            </span>
            <div className="text-base sm:text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Gmail MailApp</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Zero-cost &bull; 100 free emails/day
            </p>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Schedule Time
            </span>
            <div className="text-base sm:text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>Friday 8:00 PM</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Bangladesh Time (Asia/Dhaka)
            </p>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Recipients
            </span>
            <div className="text-base sm:text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary shrink-0" />
              <span>{membersWithEmail.length} Members</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              + 1 Group Ledger Viewer
            </p>
          </CardContent>
        </Card>

        {/* Delivery Success Rate */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Audit Receipts
            </span>
            <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{sentCount} Delivered</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {skippedCount} duplicates skipped &bull; {failedCount} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. QUICK ACTIONS & GAS EDITOR SHORTCUT */}
      <Card className="border-border/80 shadow-2xs bg-muted/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Manual Testing & Trigger Controls</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                You can safely test email formatting or trigger an instant weekly dispatch without waiting for Friday.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTestEmail}
                isLoading={isTesting}
                className="gap-1.5 text-xs h-8"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Send Test Email</span>
              </Button>

              <a
                href="https://script.google.com/home/projects/1LU-TD3RUOzjj_gAejYDlo6ZNoJN2XAJNXdMmZ7VEXVZce_juFao-E853/edit"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg border border-border bg-background text-foreground hover:bg-muted font-medium transition-colors"
              >
                <span>Apps Script Project</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. RECIPIENT ROSTER OVERVIEW */}
      <Card className="border-border/80 shadow-2xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span>Configured Report Recipients ({members.length} Members + 1 Viewer)</span>
          </CardTitle>
          <CardDescription>
            Each member receives a separate, personalized weekly HTML statement. The Group Ledger Viewer receives aggregate totals only.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-lg border border-border bg-card/60 flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-sm text-foreground block truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground truncate block">
                    {m.email || "No email configured"}
                  </span>
                </div>
                <Badge variant={m.email ? "success" : "secondary"} className="text-[10px] shrink-0">
                  {m.email ? "Subscribed" : "No Email"}
                </Badge>
              </div>
            ))}

            {/* Group Ledger Viewer Recipient */}
            <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="font-semibold text-sm text-blue-900 dark:text-blue-300 block truncate">
                  Group Ledger Viewer
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  {settings?.group_ledger_viewer_email || "viewer@mill.local"}
                </span>
              </div>
              <Badge variant="default" className="text-[10px] shrink-0">
                Aggregate Only
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. DELIVERY AUDIT LOGS TABLE */}
      <Card className="border-border/80 shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Delivery Audit Logs</CardTitle>
              <CardDescription className="text-xs">
                Historical record of all sent statements, duplicates skipped, and failed attempts
              </CardDescription>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter logs by email..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-44"
                />
              </div>

              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLogFilter("all")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    logFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  All ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter("sent")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    logFilter === "sent" ? "bg-background text-emerald-600 shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Sent ({sentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter("skipped_duplicate")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    logFilter === "skipped_duplicate" ? "bg-background text-amber-600 shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Skipped ({skippedCount})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {logs.length === 0
                ? "No email reports dispatched yet. When reports are sent on Fridays, audit receipts will appear here."
                : "No logs match your filter criteria."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-semibold uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : "Recently"}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium whitespace-nowrap">
                        {log.report_period_start} → {log.report_period_end}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-foreground">
                        {log.recipient_email}
                      </td>
                      <td className="py-3 px-4 text-xs capitalize">
                        <span className="inline-block px-2 py-0.5 rounded bg-muted text-[11px]">
                          {log.recipient_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            log.status === "sent"
                              ? "success"
                              : log.status === "skipped_duplicate"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-[10px] capitalize font-medium"
                        >
                          {log.status === "skipped_duplicate" ? "Duplicate Suppressed" : log.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                        {log.error_message || "Delivered via MailApp"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONFIRM MANUAL DISPATCH DIALOG */}
      {showConfirmDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span>Confirm Immediate Report Dispatch</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-foreground">
                Do you want to dispatch weekly statements right now to all{" "}
                <strong>{membersWithEmail.length} configured members</strong> + Group Ledger Viewer?
              </p>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground space-y-1">
                <strong>Dispatched Content:</strong>
                <p>
                  Each member will receive their personalized weekly meal breakdown, weekly deposits, and current net balance in an HTML email.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDispatch(false)}
                  disabled={isDispatching}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleDispatchNow}
                  isLoading={isDispatching}
                >
                  Confirm & Dispatch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

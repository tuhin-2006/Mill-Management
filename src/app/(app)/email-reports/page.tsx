"use client";

import * as React from "react";
import {
  Mail,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Send,
  Users,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMembers, getSettings, getEmailLogs } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import { Member, Settings, EmailLog } from "@/types";
import { toast } from "sonner";

export default function EmailReportsPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const [membersData, settingsData, logsData] = await Promise.all([
        getMembers(supabase),
        getSettings(supabase),
        getEmailLogs(supabase, 50),
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

  const membersWithEmail = members.filter((m) => m.email && m.email.trim());
  const sentLogs = logs.filter((l) => l.status === "sent");
  const failedLogs = logs.filter((l) => l.status === "failed");
  const skippedLogs = logs.filter((l) => l.status === "skipped_duplicate");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Email Reporting & Audit Logs"
        description="Monitor automated Friday Gmail reporting, delivery receipts, and duplicate suppression"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="gap-1.5"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh Logs</span>
          </Button>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Email Provider
            </span>
            <div className="text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Google MailApp</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Zero-cost &bull; 100 free emails/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Weekly Schedule
            </span>
            <div className="text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span>Friday 8:00 PM</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Bangladesh Time (Asia/Dhaka)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Safety Lock Status
            </span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>Safety Guard Active</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Automatic send locked awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configured Recipients
            </span>
            <div className="text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span>{membersWithEmail.length} / {members.length} Members</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {settings?.group_ledger_viewer_email ? "Viewer email active" : "No viewer configured"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recipient Roster Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span>Configured Report Recipients</span>
          </CardTitle>
          <CardDescription>
            Members with configured email addresses automatically receive their separate weekly statement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-lg border border-border bg-card/60 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-sm text-foreground block">{m.name}</span>
                  <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                    {m.email || "No email configured"}
                  </span>
                </div>
                <Badge variant={m.email ? "success" : "secondary"} className="text-[10px]">
                  {m.email ? "Subscribed" : "No Email"}
                </Badge>
              </div>
            ))}

            {/* Group Ledger Viewer Box */}
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-blue-900 dark:text-blue-300 block">
                  Group Ledger Viewer
                </span>
                <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                  {settings?.group_ledger_viewer_email || "Not configured (Set in Settings)"}
                </span>
              </div>
              <Badge variant={settings?.group_ledger_viewer_email ? "default" : "secondary"} className="text-[10px]">
                {settings?.group_ledger_viewer_email ? "Aggregate Only" : "Not Set"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Audit Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Delivery Audit Receipts (Email Logs)</span>
              </CardTitle>
              <CardDescription>
                Permanent database records of sent, skipped duplicate, and failed email dispatches
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-600 font-semibold">{sentLogs.length} Sent</span>
              <span>&bull;</span>
              <span className="text-muted-foreground font-semibold">{skippedLogs.length} Skipped</span>
              <span>&bull;</span>
              <span className="text-rose-600 font-semibold">{failedLogs.length} Failed</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <p>No email delivery logs recorded yet.</p>
              <p className="text-[11px]">
                Run <strong>sendTestEmail</strong> in Google Apps Script or await the scheduled Friday cycle to view delivery receipts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3">Recipient Type</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Dispatched At</th>
                    <th className="py-2.5 px-3">Notes / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((log) => {
                    const isSuccess = log.status === "sent";
                    const isDuplicate = log.status === "skipped_duplicate";

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                          {formatDate(log.report_period_start)} &rarr; {formatDate(log.report_period_end)}
                        </td>
                        <td className="py-2.5 px-3 capitalize">
                          {log.recipient_type === "group_viewer" ? "Group Viewer" : log.recipient_type}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-foreground">
                          {log.recipient_email}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={isSuccess ? "success" : isDuplicate ? "secondary" : "destructive"}
                            className="text-[10px]"
                          >
                            {isSuccess ? "Delivered" : isDuplicate ? "Duplicate Suppressed" : "Failed"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {log.sent_at ? new Date(log.sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">
                          {log.error_message || (isDuplicate ? "Skipped automatically to prevent spamming" : "Success")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

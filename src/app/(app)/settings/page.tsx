"use client";

import * as React from "react";
import {
  Save,
  KeyRound,
  DollarSign,
  ShieldAlert,
  Info,
  Mail,
  Clock,
  Eye,
  EyeOff,
  UserCheck,
  ShieldCheck,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSettings, updateSettings } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsPage() {
  const [appName, setAppName] = React.useState("Mill Manager");
  const [mealPrice, setMealPrice] = React.useState("60");
  const [fridayMealPrice, setFridayMealPrice] = React.useState("120");
  const [currency, setCurrency] = React.useState("BDT");
  const [timezone, setTimezone] = React.useState("Asia/Dhaka");
  const [autoEmailEnabled, setAutoEmailEnabled] = React.useState(false);
  const [weeklyReportDay, setWeeklyReportDay] = React.useState("Friday");
  const [weeklyReportTime, setWeeklyReportTime] = React.useState("20:00");
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);

  // 1. Separate: Viewer Report Destination Email (যে মেইলে রিপোর্ট পাঠানো হবে)
  const [viewerReportEmail, setViewerReportEmail] = React.useState("");
  const [isSavingViewerReportEmail, setIsSavingViewerReportEmail] = React.useState(false);

  // 2. Separate: Viewer Login Account Credentials (ওয়েবসাইটে লগইন করার ইউজারনেম ও পাসওয়ার্ড)
  const [viewerLoginUsername, setViewerLoginUsername] = React.useState("viewer@mill.local");
  const [viewerLoginPassword, setViewerLoginPassword] = React.useState("");
  const [showViewerPassword, setShowViewerPassword] = React.useState(false);
  const [isUpdatingViewerLogin, setIsUpdatingViewerLogin] = React.useState(false);

  // 3. Separate: Administrator Account Credentials
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminNewPassword, setAdminNewPassword] = React.useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = React.useState("");
  const [showAdminPassword, setShowAdminPassword] = React.useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = React.useState(false);
  const [adminUserId, setAdminUserId] = React.useState<string | null>(null);

  // Load existing settings and accounts
  React.useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const [settingsData, authRes, viewerProfileRes] = await Promise.all([
          getSettings(supabase),
          supabase.auth.getUser(),
          supabase.from("profiles").select("email").eq("role", "group_ledger_viewer").limit(1).maybeSingle(),
        ]);

        setAppName(settingsData.app_name);
        setMealPrice(String(settingsData.meal_price));
        setFridayMealPrice(String(settingsData.friday_meal_price ?? 120));
        setCurrency(settingsData.currency);
        setTimezone(settingsData.timezone);
        setViewerReportEmail(settingsData.group_ledger_viewer_email || "");
        setAutoEmailEnabled(Boolean(settingsData.auto_email_enabled));
        setWeeklyReportDay(settingsData.weekly_report_day || "Friday");
        setWeeklyReportTime(settingsData.weekly_report_time || "20:00");

        if (viewerProfileRes.data?.email) {
          setViewerLoginUsername(viewerProfileRes.data.email);
        }

        if (authRes.data.user) {
          setAdminUserId(authRes.data.user.id);
          setAdminEmail(authRes.data.user.email || "");
        }
      } catch (err: unknown) {
        toast.error("Failed to load settings: " + (err instanceof Error ? err.message : ""));
      }
    }

    void loadData();
  }, []);

  // Save General Configuration & Email Schedule
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(mealPrice);
    const fridayPriceNum = parseFloat(fridayMealPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid regular meal price (0 or greater).");
      return;
    }
    if (isNaN(fridayPriceNum) || fridayPriceNum < 0) {
      toast.error("Please enter a valid Friday meal price (0 or greater).");
      return;
    }

    try {
      setIsSavingSettings(true);
      const supabase = createClient();
      await updateSettings(supabase, {
        app_name: appName.trim() || "Mill Manager",
        meal_price: priceNum,
        friday_meal_price: fridayPriceNum,
        currency: currency.trim() || "BDT",
        timezone: timezone.trim() || "Asia/Dhaka",
        auto_email_enabled: autoEmailEnabled,
        weekly_report_day: weeklyReportDay,
        weekly_report_time: weeklyReportTime,
      });

      toast.success("Meal rates and schedule saved successfully!");
    } catch (err: unknown) {
      toast.error("Failed to save settings: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 1. Save Group Ledger Viewer Report Email (আলাদা: যেখানে রিপোর্ট যাবে)
  const handleSaveViewerReportEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingViewerReportEmail(true);
      const supabase = createClient();
      await updateSettings(supabase, {
        group_ledger_viewer_email: viewerReportEmail.trim() || null,
      });

      toast.success("Viewer report destination email saved successfully!");
    } catch (err: unknown) {
      toast.error("Failed to save viewer report email: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingViewerReportEmail(false);
    }
  };

  // 2. Save Group Ledger Viewer Login Username & Password (আলাদা: ওয়েবসাইটে লগইন করার ইউজারনেম ও পাসওয়ার্ড)
  const handleUpdateViewerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerLoginUsername.trim()) {
      toast.error("Viewer login username / email is required.");
      return;
    }
    if (viewerLoginPassword && viewerLoginPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    try {
      setIsUpdatingViewerLogin(true);
      const res = await fetch("/api/admin/provision-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: viewerLoginUsername.trim(),
          password: viewerLoginPassword || undefined,
          role: "group_ledger_viewer",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update viewer login account.");
      }

      toast.success(`Viewer login account (${viewerLoginUsername}) updated successfully!`);
      setViewerLoginPassword("");
    } catch (err: unknown) {
      toast.error("Failed to update viewer login: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsUpdatingViewerLogin(false);
    }
  };

  // 3. Save Admin Account Credentials
  const handleUpdateAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPassword && adminNewPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (adminNewPassword && adminNewPassword !== adminConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setIsUpdatingAdmin(true);
      const res = await fetch("/api/admin/provision-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: adminUserId || undefined,
          email: adminEmail.trim(),
          password: adminNewPassword || undefined,
          role: "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update administrator account.");
      }

      toast.success("Administrator login credentials updated successfully!");
      setAdminNewPassword("");
      setAdminConfirmPassword("");
    } catch (err: unknown) {
      toast.error("Account update failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Configuration"
        description="Configure meal rates, email reporting schedule, and separate notification emails from login accounts."
      />

      {/* Historical Integrity Info Note */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <Info className="h-5 w-5" />
        </div>
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">
            Financial Ledger Safety Notice
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Changing the meal price here applies only to <strong>future meal records</strong>.
            Past entries retain the unit price applied when they were saved, ensuring that historical group accounts and financial balances remain 100% accurate.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================================================
            CARD 1: APP & MEAL CONFIGURATION + AUTOMATED SCHEDULE
            ========================================================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>Meal Rates & Automated Schedule</span>
            </CardTitle>
            <CardDescription>
              Unit rates applied to meal records and weekly report timing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="app-name">Application Name</Label>
                <Input
                  id="app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meal-price">Regular Meal Price (Sat–Thu) (৳)</Label>
                  <Input
                    id="meal-price"
                    type="number"
                    step="any"
                    min="0"
                    value={mealPrice}
                    onChange={(e) => setMealPrice(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default: ৳60.00 BDT (Lunch / Dinner)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="friday-meal-price">Friday Meal Price (Fri Lunch) (৳)</Label>
                  <Input
                    id="friday-meal-price"
                    type="number"
                    step="any"
                    min="0"
                    value={fridayMealPrice}
                    onChange={(e) => setFridayMealPrice(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default: ৳120.00 BDT (Friday Lunch)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency Code</Label>
                  <Input
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timezone">System Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Automatic Email Schedule Section */}
              <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Automatic Email Reports</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Master toggle for scheduled weekly email delivery.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAutoEmailEnabled(!autoEmailEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
                      autoEmailEnabled ? "bg-emerald-600" : "bg-muted-foreground/30"
                    }`}
                    role="switch"
                    aria-checked={autoEmailEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        autoEmailEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="report-day" className="text-xs font-semibold text-muted-foreground">
                      Dispatch Day
                    </Label>
                    <select
                      id="report-day"
                      value={weeklyReportDay}
                      onChange={(e) => setWeeklyReportDay(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="Friday">Friday (Default)</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="report-time" className="text-xs font-semibold text-muted-foreground">
                      Dispatch Time (Asia/Dhaka)
                    </Label>
                    <Input
                      id="report-time"
                      type="time"
                      value={weeklyReportTime}
                      onChange={(e) => setWeeklyReportTime(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      autoEmailEnabled
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        autoEmailEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    <span>
                      {autoEmailEnabled
                        ? `ACTIVE — Dispatches every ${weeklyReportDay} at ${weeklyReportTime}`
                        : "PAUSED — Safety lock active (No emails sent automatically)"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={isSavingSettings} className="gap-2 w-full sm:w-auto h-10 sm:h-9">
                  <Save className="h-4 w-4" />
                  <span>Save Meal Rates & Schedule</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* =========================================================================
            CARD 2: VIEWER NOTIFICATION EMAIL (আলাদা: যেখানে রিপোর্ট যাবে)
            ========================================================================= */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <Mail className="h-4 w-4 text-blue-600" />
              <span>Viewer Report Recipient Email (রিপোর্ট পাঠানোর ইমেইল)</span>
            </CardTitle>
            <CardDescription>
              Set the destination email address where weekly aggregate financial reports are delivered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveViewerReportEmail} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="viewer-report-email">Destination Email Address</Label>
                <Input
                  id="viewer-report-email"
                  type="email"
                  placeholder="e.g. auditor@gmail.com or messviewer@gmail.com"
                  value={viewerReportEmail}
                  onChange={(e) => setViewerReportEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  The weekly aggregate summary will be sent to this email address. Does not affect login credentials.
                </p>
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-background/60 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  Privacy Enforcement:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Emails delivered to this address contain aggregate totals only (total meals, expenses, deposits, treasury balance). Individual member records are never included.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSavingViewerReportEmail}
                  className="gap-2 w-full sm:w-auto h-10 sm:h-9"
                >
                  <Send className="h-4 w-4" />
                  <span>Save Report Email</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* =========================================================================
            CARD 3: VIEWER LOGIN ACCOUNT (আলাদা: ওয়েবসাইটে লগইন করার ইউজারনেম ও পাসওয়ার্ড)
            ========================================================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>Viewer Login Account (ওয়েবসাইট লগইন ইউজারনেম ও পাসওয়ার্ড)</span>
            </CardTitle>
            <CardDescription>
              Set the username/email and password used by the viewer to sign in to the web dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateViewerLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="viewer-login-username">Login Username / Email</Label>
                <Input
                  id="viewer-login-username"
                  type="email"
                  placeholder="e.g. viewer@mill.local"
                  value={viewerLoginUsername}
                  onChange={(e) => setViewerLoginUsername(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  The login identifier used on the login screen.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewer-login-password">Login Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowViewerPassword(!showViewerPassword)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showViewerPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showViewerPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <Input
                  id="viewer-login-password"
                  type={showViewerPassword ? "text" : "password"}
                  placeholder="Enter new password (min 6 chars)"
                  value={viewerLoginPassword}
                  onChange={(e) => setViewerLoginPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to keep existing password unchanged.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="outline"
                  isLoading={isUpdatingViewerLogin}
                  className="gap-2 w-full sm:w-auto h-10 sm:h-9"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Update Viewer Login Credentials</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* =========================================================================
            CARD 4: ADMIN ACCOUNT & CREDENTIALS
            ========================================================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Administrator Login Account</span>
            </CardTitle>
            <CardDescription>
              Update your primary administrator login email and password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateAdminCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Admin Login Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Your primary administrator login identifier.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-new-password">New Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showAdminPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <Input
                  id="admin-new-password"
                  type={showAdminPassword ? "text" : "password"}
                  placeholder="Enter new password (min 6 chars)"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  type={showAdminPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingAdmin}
                  className="gap-2 w-full sm:w-auto h-10 sm:h-9"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Update Admin Credentials</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

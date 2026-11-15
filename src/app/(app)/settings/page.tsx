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
  CheckCircle2,
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
  const [groupLedgerViewerEmail, setGroupLedgerViewerEmail] = React.useState("");
  const [autoEmailEnabled, setAutoEmailEnabled] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);

  // Password change state
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  // Load existing settings
  React.useEffect(() => {
    async function loadSettings() {
      try {
        const supabase = createClient();
        const data = await getSettings(supabase);
        setAppName(data.app_name);
        setMealPrice(String(data.meal_price));
        setFridayMealPrice(String(data.friday_meal_price ?? 120));
        setCurrency(data.currency);
        setTimezone(data.timezone);
        setGroupLedgerViewerEmail(data.group_ledger_viewer_email || "");
        setAutoEmailEnabled(Boolean(data.auto_email_enabled));
      } catch (err: unknown) {
        toast.error("Failed to load settings: " + (err instanceof Error ? err.message : ""));
      }
    }

    loadSettings();
  }, []);

  // Save Settings
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
        group_ledger_viewer_email: groupLedgerViewerEmail.trim() || null,
        auto_email_enabled: autoEmailEnabled,
      });

      toast.success("Settings updated successfully!");
    } catch (err: unknown) {
      toast.error("Failed to save settings: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Change Admin Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setIsChangingPassword(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Admin password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error("Password change failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Configuration"
        description="Configure meal rate, group parameters, and administrator security."
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
        {/* App & Meal Price Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>Meal & General Configuration</span>
            </CardTitle>
            <CardDescription>
              Default rate applied to new daily meal attendance entries
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
                  <Label htmlFor="meal-price">Regular Meal Price (শনি–বৃহস্পতি) (৳ BDT)</Label>
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
                  <Label htmlFor="friday-meal-price">Friday Meal Price (শুক্রবার দুপুর) (৳ BDT)</Label>
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
                    Default: ৳120.00 BDT (Special Friday Lunch)
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

              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label htmlFor="group-viewer-email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <span>Group Ledger Viewer Recipient Email</span>
                </Label>
                <Input
                  id="group-viewer-email"
                  type="email"
                  placeholder="e.g. viewer@gmail.com"
                  value={groupLedgerViewerEmail}
                  onChange={(e) => setGroupLedgerViewerEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Receives aggregate-only weekly summaries (Total meals, expenses, deposits, treasury balance). Strictly excludes individual member names and private account balances.
                </p>
              </div>

              {/* Automatic Weekly Email Reporting Toggle */}
              <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Automatic Friday Email Reports (স্বয়ংক্রিয় সাপ্তাহিক ইমেইল)</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Sends separate weekly HTML statements every Friday at 8:00 PM (Asia/Dhaka).
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
                        ? "ACTIVE (স্বয়ংক্রিয় পাঠানো চালু)"
                        : "PAUSED (নিরাপদ লক সক্রিয় - পাঠানো হবে না)"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">
                  Friday Meal Rule:
                </span>
                <p>
                  Friday Dinner is permanently disabled by system rule (Lunch only on Fridays). Friday Lunch rate is ৳{fridayMealPrice || 120}.00 BDT.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={isSavingSettings} className="gap-2 w-full sm:w-auto h-10 sm:h-9">
                  <Save className="h-4 w-4" />
                  <span>Save Configuration</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Admin Security & Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Admin Security Credentials</span>
            </CardTitle>
            <CardDescription>
              Update your administrator login password through Supabase Auth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Security Notice
                </p>
                <p className="mt-1 text-[11px]">
                  Only you have administrative access. Make sure to keep your password in a safe password manager.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isChangingPassword}
                  className="gap-2 w-full sm:w-auto h-10 sm:h-9"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Update Password</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Email Reporting Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span>Weekly Gmail Reporting Engine</span>
          </CardTitle>
          <CardDescription>
            Free automated weekly meal statements powered by Google Apps Script and Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Email Service</span>
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Google Apps Script (MailApp)
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Cost: ৳0.00 / Zero-cost free Gmail
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Weekly Dispatch Schedule</span>
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                <Clock className="h-4 w-4 text-primary" />
                Every Friday Evening
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Timezone: Asia/Dhaka (8:00 PM)
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Automatic Schedule State</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 text-sm flex items-center gap-1.5 mt-0.5">
                <ShieldAlert className="h-4 w-4" />
                Safety Lock Active
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Awaiting your approval before auto-sending
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">
              Setup Instructions & Secret Keys:
            </p>
            <p className="leading-relaxed">
              Google Apps Script connects to Supabase Edge Function via a private shared secret (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">REPORT_SHARED_SECRET</code>) stored securely in Google Apps Script Script Properties. No sensitive database keys are ever exposed in frontend client code.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

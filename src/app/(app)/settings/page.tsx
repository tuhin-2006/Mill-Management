"use client";

import * as React from "react";
import {
  Save,
  KeyRound,
  DollarSign,
  ShieldAlert,
  Info,
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">
                  Friday Meal Rule:
                </span>
                <p>
                  Friday Dinner is permanently disabled by system rule (Lunch only on Fridays). Friday Lunch rate is ৳{fridayMealPrice || 120}.00 BDT.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={isSavingSettings} className="gap-2">
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
                  className="gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Update Password</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

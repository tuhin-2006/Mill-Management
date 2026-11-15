"use client";

import * as React from "react";
import {
  RotateCcw,
  Save,
  Trash2,
  Sun,
  Moon,
  Info,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMembers,
  getSettings,
  getMealsForDate,
  saveDailyMeals,
  deleteDailyMeals,
  DEFAULT_SETTINGS,
} from "@/lib/services";
import {
  getTodayInDhaka,
  getWeekdayName,
  isFridayDate,
  formatDate,
  formatFullDate,
  formatBDT,
} from "@/lib/date";
import { Member, MealEntry, Settings } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function DailyMealEntryPage() {
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayInDhaka());
  const [members, setMembers] = React.useState<Member[]>([]);
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasExistingRecord, setHasExistingRecord] = React.useState(false);

  // Meal selections: member_id -> { lunch: 0 | 1 | 2..., dinner: 0 | 1 | 2... }
  const [mealSelections, setMealSelections] = React.useState<
    Record<string, { lunch: number; dinner: number }>
  >({});
  const [savedSelections, setSavedSelections] = React.useState<
    Record<string, { lunch: number; dinner: number }>
  >({});

  // Safety & UX states
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);
  const [hoveredMemberId, setHoveredMemberId] = React.useState<string | null>(null);

  const weekday = getWeekdayName(selectedDate);
  const isFriday = isFridayDate(selectedDate);

  // Check if there are unsaved changes
  const isDirty = React.useMemo(() => {
    if (Object.keys(savedSelections).length === 0) return false;
    return JSON.stringify(mealSelections) !== JSON.stringify(savedSelections);
  }, [mealSelections, savedSelections]);

  // 1. Initial Load of Members and Settings
  React.useEffect(() => {
    async function loadInitialData() {
      try {
        const supabase = createClient();
        const [membersData, settingsData] = await Promise.all([
          getMembers(supabase),
          getSettings(supabase),
        ]);

        setMembers(membersData);
        setSettings(settingsData);
      } catch (err: unknown) {
        toast.error("Error loading data: " + (err instanceof Error ? err.message : ""));
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // 2. Load existing meals whenever selectedDate or members change
  React.useEffect(() => {
    async function loadDateMeals() {
      if (members.length === 0) return;

      try {
        const supabase = createClient();
        const existingMeals: MealEntry[] = await getMealsForDate(supabase, selectedDate);

        const initialMap: Record<string, { lunch: number; dinner: number }> = {};

        // Initialize all active members to 0
        for (const m of members) {
          initialMap[m.id] = { lunch: 0, dinner: 0 };
        }

        let foundAny = false;
        for (const entry of existingMeals) {
          if (!initialMap[entry.member_id]) {
            initialMap[entry.member_id] = { lunch: 0, dinner: 0 };
          }
          if (entry.session === "lunch") {
            initialMap[entry.member_id].lunch = entry.quantity;
            if (entry.quantity > 0) foundAny = true;
          }
          if (entry.session === "dinner") {
            // Dinner automatically 0 on Friday
            initialMap[entry.member_id].dinner = isFriday ? 0 : entry.quantity;
            if (entry.quantity > 0 && !isFriday) foundAny = true;
          }
        }

        setMealSelections(initialMap);
        setSavedSelections(initialMap);
        setHasExistingRecord(foundAny);
      } catch (err: unknown) {
        console.error("Failed to load date meals:", err);
      }
    }

    loadDateMeals();
  }, [selectedDate, members, isFriday]);

  // Date Change with unsaved changes guard
  const handleDateChange = (newDate: string) => {
    if (isDirty) {
      if (
        !confirm(
          "⚠️ আপনার এই তারিখের পরিবর্তনগুলো এখনও সেভ করা হয়নি। আপনি কি পরিবর্তনগুলো বাতিল করে অন্য তারিখে যেতে চান?"
        )
      ) {
        return;
      }
    }
    setSelectedDate(newDate);
  };

  // Handle set meal quantity (supports 0, 1, 2+ guest meals)
  const handleSetQuantity = (memberId: string, session: "lunch" | "dinner", qty: number) => {
    if (session === "dinner" && isFriday) {
      toast.warning("Friday Dinner is automatically disabled according to meal schedule.");
      return;
    }

    const nextVal = Math.max(0, Math.min(10, qty));
    setMealSelections((prev) => {
      const current = prev[memberId] || { lunch: 0, dinner: 0 };
      return {
        ...prev,
        [memberId]: {
          ...current,
          [session]: nextVal,
        },
      };
    });
  };

  // Quick batch actions
  const handleQuickSetAll = (session: "lunch" | "dinner" | "both") => {
    setMealSelections((prev) => {
      const next = { ...prev };
      for (const m of activeMembers) {
        const cur = { ...(next[m.id] || { lunch: 0, dinner: 0 }) };
        if (session === "lunch" || session === "both") {
          cur.lunch = 1;
        }
        if ((session === "dinner" || session === "both") && !isFriday) {
          cur.dinner = 1;
        }
        next[m.id] = cur;
      }
      return next;
    });
    toast.info(
      session === "both"
        ? "All active members set to 1 lunch & 1 dinner."
        : session === "lunch"
        ? "All active members set to 1 lunch."
        : "All active members set to 1 dinner."
    );
  };

  // Helper to wipe local selections to 0
  const executeReset = () => {
    const resetMap: Record<string, { lunch: number; dinner: number }> = {};
    for (const m of members) {
      resetMap[m.id] = { lunch: 0, dinner: 0 };
    }
    setMealSelections(resetMap);
  };

  // Effective meal price based on day (Friday lunch = friday_meal_price, other days = meal_price)
  const effectiveMealPrice = isFriday
    ? (settings.friday_meal_price || 120)
    : (settings.meal_price || 60);

  // Group Live Calculations
  const activeMembers = members.filter((m) => m.status === "active");

  const totalLunch = activeMembers.reduce(
    (sum, m) => sum + (mealSelections[m.id]?.lunch || 0),
    0
  );
  const totalDinner = isFriday
    ? 0
    : activeMembers.reduce((sum, m) => sum + (mealSelections[m.id]?.dinner || 0), 0);
  const totalDailyMeals = totalLunch + totalDinner;
  const totalDailyCost = totalDailyMeals * effectiveMealPrice;

  // Safe Reset Click handler - asks confirmation if there are meals selected
  const handleResetClick = () => {
    if (totalDailyMeals === 0) {
      toast.info("সব মেম্বারের মিল ইতিমধ্যেই ০ (Off) করা রয়েছে।");
      return;
    }
    setIsResetConfirmOpen(true);
  };

  // Confirmed reset action
  const handleConfirmReset = () => {
    executeReset();
    setIsResetConfirmOpen(false);
    toast.info("সকল মেম্বারের মিল রিসেট করে ০ করা হয়েছে।");
  };

  // Open review confirmation modal
  const handleSave = () => {
    setIsConfirmOpen(true);
  };

  // Actually execute database upsert
  const handleExecuteSave = async () => {
    try {
      setIsSaving(true);
      const supabase = createClient();

      const payload = members.map((m) => ({
        member_id: m.id,
        lunch: mealSelections[m.id]?.lunch || 0,
        dinner: isFriday ? 0 : mealSelections[m.id]?.dinner || 0,
      }));

      await saveDailyMeals(supabase, selectedDate, payload, effectiveMealPrice);

      setSavedSelections(mealSelections);
      setHasExistingRecord(true);
      setIsConfirmOpen(false);
      toast.success(
        `Daily meals for ${formatDate(selectedDate)} saved successfully! (${totalDailyMeals} meals, ${formatBDT(totalDailyCost)})`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save daily meals.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete daily meals
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete all meal records for ${formatDate(selectedDate)}?`)) {
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();
      await deleteDailyMeals(supabase, selectedDate);

      // Reset local state
      executeReset();
      setHasExistingRecord(false);
      toast.success(`Meal records for ${formatDate(selectedDate)} deleted.`);
    } catch (err: unknown) {
      toast.error("Failed to delete meals: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Meal Entry"
        description="Manual meal tracking for lunch and dinner sessions."
      />

      {/* Date & Schedule Selector Bar */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="meal-date-picker" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Meal Date
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    id="meal-date-picker"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isFriday ? "secondary" : "default"}>
                    {weekday}
                  </Badge>
                  {isFriday && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      Friday: Lunch Only (Dinner Disabled)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Existing Record Indicator */}
            <div className="flex items-center gap-3">
              {hasExistingRecord ? (
                <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1">
                  Existing Record Loaded
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs px-2.5 py-1">
                  New Entry
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs shadow-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">
                ⚠️ আপনার পরিবর্তনগুলো এখনও সেভ করা হয়নি! (Unsaved Changes)
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ভুল এড়াতে নিচের &quot;{hasExistingRecord ? "Update Daily Meals" : "Save Daily Meals"}&quot; বাটনে ক্লিক করে নিশ্চিত করুন।
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={handleSave}
            className="h-8 text-xs px-3.5 shadow-xs shrink-0 self-end sm:self-auto"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            <span>Review & Save</span>
          </Button>
        </div>
      )}

      {/* Members Meal Entry Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Group Members Attendance</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFriday ? (
                <span>
                  Friday Special Rate: <strong>{formatBDT(effectiveMealPrice)}</strong>/meal (Dinner closed). Click or use + / - to add guest/extra meals.
                </span>
              ) : (
                <span>
                  Regular Rate: <strong>{formatBDT(effectiveMealPrice)}</strong>/meal. Click or use + / - to add guest/extra meals.
                </span>
              )}
            </p>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">দ্রুত সেট:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSetAll("both")}
              className="h-7 text-xs px-2.5 font-medium"
              title="সকল মেম্বারের জন্য ১ লাঞ্চ ও ১ ডিনার সিলেক্ট করুন"
            >
              সবাই খেয়েছে (All Ate)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSetAll("lunch")}
              className="h-7 text-xs px-2.5 font-medium"
              title="সকল মেম্বারের জন্য শুধু ১ লাঞ্চ সিলেক্ট করুন"
            >
              সবাই লাঞ্চ
            </Button>
            {!isFriday && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSetAll("dinner")}
                className="h-7 text-xs px-2.5 font-medium"
                title="সকল মেম্বারের জন্য শুধু ১ ডিনার সিলেক্ট করুন"
              >
                সবাই ডিনার
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading members and settings...
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No members found. Please run the SQL migration or add members in the Members page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Lunch (দুপুর)</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Dinner (রাত)</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Total Meals</th>
                    <th className="py-3 px-4 text-right">Daily Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member, index) => {
                    const current = mealSelections[member.id] || { lunch: 0, dinner: 0 };
                    const memberTotalMeals = current.lunch + (isFriday ? 0 : current.dinner);
                    const memberCost = memberTotalMeals * effectiveMealPrice;
                    const isInactive = member.status === "inactive";
                    const isHovered = hoveredMemberId === member.id;
                    const hasMeals = memberTotalMeals > 0;

                    return (
                      <tr
                        key={member.id}
                        onMouseEnter={() => setHoveredMemberId(member.id)}
                        onMouseLeave={() => setHoveredMemberId(null)}
                        className={`transition-colors border-l-2 ${
                          isHovered
                            ? "bg-primary/10 border-l-primary"
                            : hasMeals
                            ? "bg-primary/5 border-l-primary/60"
                            : "border-l-transparent hover:bg-muted/20"
                        } ${isInactive ? "opacity-60 bg-muted/10" : ""}`}
                      >
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] text-muted-foreground w-4 text-right">
                              #{index + 1}
                            </span>
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground text-sm">
                                  {member.name}
                                </span>
                                {isInactive && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {memberTotalMeals > 0
                                  ? `${memberTotalMeals} meal${memberTotalMeals > 1 ? "s" : ""} selected`
                                  : "No meals today"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Lunch Button / Counter */}
                        <td className="py-3 px-4 text-center">
                          {current.lunch === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSetQuantity(member.id, "lunch", 1)}
                              className="inline-flex items-center justify-center h-8.5 px-3 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border transition-all cursor-pointer"
                            >
                              0 (Off)
                            </button>
                          ) : (
                            <div className="inline-flex items-center rounded-lg bg-amber-600 text-white shadow-xs p-0.5 border border-amber-500">
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(member.id, "lunch", current.lunch - 1)}
                                className="h-7.5 w-6.5 flex items-center justify-center rounded-md hover:bg-black/20 text-white font-bold transition-colors cursor-pointer"
                                title="Decrease (-1 meal/guest)"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <div className="px-2 py-0.5 text-xs font-bold flex items-center gap-1 min-w-[70px] justify-center select-none">
                                <span>{current.lunch} Meal{current.lunch > 1 ? "s" : ""}</span>
                                {current.lunch > 1 && (
                                  <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full font-medium">
                                    +{current.lunch - 1} Guest
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(member.id, "lunch", current.lunch + 1)}
                                className="h-7.5 w-6.5 flex items-center justify-center rounded-md hover:bg-black/20 text-white font-bold transition-colors cursor-pointer"
                                title="Add Guest / Extra Meal (+1)"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Dinner Button / Counter (Disabled on Friday) */}
                        <td className="py-3 px-4 text-center">
                          {isFriday ? (
                            <span className="inline-flex items-center justify-center h-8.5 px-3 rounded-lg text-xs font-medium text-muted-foreground/50 bg-muted/30 border border-border/40 select-none">
                              Closed (Friday)
                            </span>
                          ) : current.dinner === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSetQuantity(member.id, "dinner", 1)}
                              className="inline-flex items-center justify-center h-8.5 px-3 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border transition-all cursor-pointer"
                            >
                              0 (Off)
                            </button>
                          ) : (
                            <div className="inline-flex items-center rounded-lg bg-indigo-600 text-white shadow-xs p-0.5 border border-indigo-500">
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(member.id, "dinner", current.dinner - 1)}
                                className="h-7.5 w-6.5 flex items-center justify-center rounded-md hover:bg-black/20 text-white font-bold transition-colors cursor-pointer"
                                title="Decrease (-1 meal/guest)"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <div className="px-2 py-0.5 text-xs font-bold flex items-center gap-1 min-w-[70px] justify-center select-none">
                                <span>{current.dinner} Meal{current.dinner > 1 ? "s" : ""}</span>
                                {current.dinner > 1 && (
                                  <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full font-medium">
                                    +{current.dinner - 1} Guest
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(member.id, "dinner", current.dinner + 1)}
                                className="h-7.5 w-6.5 flex items-center justify-center rounded-md hover:bg-black/20 text-white font-bold transition-colors cursor-pointer"
                                title="Add Guest / Extra Meal (+1)"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Total Meals for Member */}
                        <td className="py-3 px-4 text-center font-bold text-foreground">
                          {memberTotalMeals}
                        </td>

                        {/* Cost for Member */}
                        <td className="py-3 px-4 text-right font-medium text-muted-foreground">
                          {formatBDT(memberCost)}
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

      {/* Live Group Calculation Summary & Actions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Live Counter Display */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-card rounded-xl border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Total Lunch
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">{totalLunch}</p>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Total Dinner
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {isFriday ? 0 : totalDinner}
                </p>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Total Meals
                </span>
                <p className="text-xl font-bold text-primary mt-0.5">
                  {totalDailyMeals}
                </p>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Total Daily Cost
                </span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatBDT(totalDailyCost)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={handleResetClick}
                disabled={isSaving}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </Button>

              {hasExistingRecord && (
                <Button
                  variant="destructive"
                  size="md"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Entry</span>
                </Button>
              )}

              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                isLoading={isSaving}
                className="gap-2 px-6"
              >
                <Save className="h-4 w-4" />
                <span>{hasExistingRecord ? "Update Daily Meals" : "Save Daily Meals"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review & Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{hasExistingRecord ? "মিল আপডেট নিশ্চিতকরণ" : "মিল এন্ট্রি নিশ্চিতকরণ"}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatFullDate(selectedDate)} ({weekday})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3 rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                  {hasExistingRecord
                    ? "আপনি পূর্বের সংরক্ষিত রেকর্ডের ওপর তথ্য আপডেট করতে যাচ্ছেন।"
                    : "অনুগ্রহ করে সেভ করার পূর্বে মেম্বারদের মিলের হিসাব মিলিয়ে নিন:"}
                </p>
                <p className="pl-5.5">
                  মিল রেট: <strong>{formatBDT(effectiveMealPrice)}</strong>/মিল
                  {isFriday ? " (শুক্রবার বিশেষ রেট)" : ""}
                </p>
              </div>

              {/* Members summary table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">মেম্বার</th>
                      <th className="py-2.5 px-2 text-center">লাঞ্চ</th>
                      <th className="py-2.5 px-2 text-center">ডিনার</th>
                      <th className="py-2.5 px-2 text-center">মোট মিল</th>
                      <th className="py-2.5 px-3 text-right">খরচ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeMembers.map((m) => {
                      const cur = mealSelections[m.id] || { lunch: 0, dinner: 0 };
                      const mTotal = cur.lunch + (isFriday ? 0 : cur.dinner);
                      const mCost = mTotal * effectiveMealPrice;
                      return (
                        <tr key={m.id} className={mTotal > 0 ? "bg-card" : "bg-muted/20 opacity-60"}>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {m.name}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {cur.lunch > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {cur.lunch}
                                {cur.lunch > 1 && (
                                  <span className="text-[10px] ml-1 bg-amber-500/10 px-1 py-0.2 rounded-sm">
                                    +{cur.lunch - 1} গেস্ট
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">0</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {isFriday ? (
                              <span className="text-muted-foreground/50 text-[10px]">বন্ধ</span>
                            ) : cur.dinner > 0 ? (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {cur.dinner}
                                {cur.dinner > 1 && (
                                  <span className="text-[10px] ml-1 bg-indigo-500/10 px-1 py-0.2 rounded-sm">
                                    +{cur.dinner - 1} গেস্ট
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">0</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-foreground">
                            {mTotal}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-foreground">
                            {formatBDT(mCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-primary/10 font-bold border-t border-border text-foreground">
                    <tr>
                      <td className="py-2 px-3">সর্বমোট</td>
                      <td className="py-2 px-2 text-center text-amber-600 dark:text-amber-400">{totalLunch}</td>
                      <td className="py-2 px-2 text-center text-indigo-600 dark:text-indigo-400">{isFriday ? 0 : totalDinner}</td>
                      <td className="py-2 px-2 text-center text-primary">{totalDailyMeals}</td>
                      <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">{formatBDT(totalDailyCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isSaving}
                >
                  ফিরে গিয়ে পরিবর্তন করুন (Back)
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteSave}
                  isLoading={isSaving}
                  className="gap-1.5 shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>{hasExistingRecord ? "হ্যাঁ, আপডেট নিশ্চিত করুন" : "হ্যাঁ, সেভ নিশ্চিত করুন"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="w-full max-w-md shadow-2xl border-amber-500/30">
            <CardHeader className="flex flex-row items-start gap-3 pb-3 border-b border-border">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base text-foreground">
                  রিসেট নিশ্চিতকরণ (Confirm Reset)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  সব মেম্বারের মিল শূন্য (০) করার পূর্ব সতর্কতা
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  সতর্কবার্তা:
                </p>
                <p>
                  আপনি কি নিশ্চিত যে <strong>{formatDate(selectedDate)}</strong> তারিখের সব মেম্বারের মিল নির্বাচন মুছে ফেলে ০ (Reset) করতে চান?
                </p>
                <p className="text-muted-foreground text-[11px]">
                  বর্তমান নির্বাচিত মোট মিল: <strong>{totalDailyMeals} টি</strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetConfirmOpen(false)}
                >
                  বাতিল করুন (Cancel)
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmReset}
                  className="gap-1.5 shadow-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>হ্যাঁ, রিসেট করুন</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

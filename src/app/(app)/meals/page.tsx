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

  // Meal selections: member_id -> { lunch: 0 | 1, dinner: 0 | 1 }
  const [mealSelections, setMealSelections] = React.useState<
    Record<string, { lunch: number; dinner: number }>
  >({});

  const weekday = getWeekdayName(selectedDate);
  const isFriday = isFridayDate(selectedDate);

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
        setHasExistingRecord(foundAny);
      } catch (err: unknown) {
        console.error("Failed to load date meals:", err);
      }
    }

    loadDateMeals();
  }, [selectedDate, members, isFriday]);

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

  // Reset all to 0
  const handleReset = () => {
    const resetMap: Record<string, { lunch: number; dinner: number }> = {};
    for (const m of members) {
      resetMap[m.id] = { lunch: 0, dinner: 0 };
    }
    setMealSelections(resetMap);
    toast.info("Meal selections reset to 0.");
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

  // Save / Update daily meals
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const supabase = createClient();

      const payload = members.map((m) => ({
        member_id: m.id,
        lunch: mealSelections[m.id]?.lunch || 0,
        dinner: isFriday ? 0 : mealSelections[m.id]?.dinner || 0,
      }));

      await saveDailyMeals(supabase, selectedDate, payload, effectiveMealPrice);

      setHasExistingRecord(true);
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
      handleReset();
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
                    onChange={(e) => setSelectedDate(e.target.value)}
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

      {/* Members Meal Entry Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
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
                  {members.map((member) => {
                    const current = mealSelections[member.id] || { lunch: 0, dinner: 0 };
                    const memberTotalMeals = current.lunch + (isFriday ? 0 : current.dinner);
                    const memberCost = memberTotalMeals * effectiveMealPrice;
                    const isInactive = member.status === "inactive";

                    return (
                      <tr
                        key={member.id}
                        className={`hover:bg-muted/20 transition-colors ${
                          isInactive ? "opacity-60 bg-muted/10" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{member.name}</span>
                            {isInactive && (
                              <Badge variant="secondary" className="text-[10px]">
                                Inactive
                              </Badge>
                            )}
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
                onClick={handleReset}
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
    </div>
  );
}

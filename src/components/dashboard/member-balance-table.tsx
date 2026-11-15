"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  X,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  Wallet,
  Users,
} from "lucide-react";
import { MemberSummary } from "@/types";
import { formatBDT } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AVATAR_COLORS = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface MemberBalanceTableProps {
  memberSummaries: MemberSummary[];
}

export function MemberBalanceTable({ memberSummaries }: MemberBalanceTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterTab, setFilterTab] = React.useState<"all" | "active" | "positive" | "negative">("all");

  const counts = React.useMemo(() => {
    let active = 0;
    let positive = 0;
    let negative = 0;
    for (const m of memberSummaries) {
      if (m.status === "active") active++;
      if (m.balance >= 0) positive++;
      else negative++;
    }
    return {
      all: memberSummaries.length,
      active,
      positive,
      negative,
    };
  }, [memberSummaries]);

  const filteredMembers = React.useMemo(() => {
    return memberSummaries.filter((m) => {
      // Tab filter
      if (filterTab === "active" && m.status !== "active") return false;
      if (filterTab === "positive" && m.balance < 0) return false;
      if (filterTab === "negative" && m.balance >= 0) return false;

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return m.name.toLowerCase().includes(query);
      }

      return true;
    });
  }, [memberSummaries, filterTab, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
              filterTab === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            All Members ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("active")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
              filterTab === "active"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Active ({counts.active})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("positive")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
              filterTab === "positive"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Surplus / Advance ({counts.positive})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("negative")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
              filterTab === "negative"
                ? "bg-destructive text-destructive-foreground shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Due / Deficit ({counts.negative})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-9 text-xs rounded-lg"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-border bg-muted/20">
          <Users className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No members found</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {searchTerm
              ? `No member name matches "${searchTerm}". Try a different search.`
              : "No members match the selected filter."}
          </p>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-3 h-8 text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-semibold">Member</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 text-center font-semibold">Lunch</th>
                  <th className="py-3 px-4 text-center font-semibold">Dinner</th>
                  <th className="py-3 px-4 text-center font-semibold">Total Meals</th>
                  <th className="py-3 px-4 text-right font-semibold">Meal Cost</th>
                  <th className="py-3 px-4 text-right font-semibold">Deposited</th>
                  <th className="py-3 px-4 text-right font-semibold">Current Balance</th>
                  <th className="py-3 px-4 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((m) => {
                  const isPositive = m.balance >= 0;
                  const avatarColor = getAvatarColor(m.name);
                  const initials = getInitials(m.name);

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      {/* Member Name + Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate group-hover:text-primary transition-colors">
                              {m.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={m.status === "active" ? "success" : "secondary"}
                          className="capitalize text-[11px]"
                        >
                          {m.status}
                        </Badge>
                      </td>

                      {/* Lunch */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                          <Sun className="h-3 w-3 text-amber-500" />
                          {m.total_lunch}
                        </span>
                      </td>

                      {/* Dinner */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                          <Moon className="h-3 w-3 text-indigo-400" />
                          {m.total_dinner}
                        </span>
                      </td>

                      {/* Total Meals */}
                      <td className="py-3 px-4 text-center font-bold text-foreground">
                        {m.total_meals}
                      </td>

                      {/* Meal Cost */}
                      <td className="py-3 px-4 text-right text-muted-foreground font-medium">
                        {formatBDT(m.total_meal_cost)}
                      </td>

                      {/* Deposited */}
                      <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatBDT(m.total_deposited)}
                      </td>

                      {/* Current Balance */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border border-destructive/20"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {formatBDT(m.balance)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <Link href={`/ledger?member=${m.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <span>Ledger</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Phone Card View */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map((m) => {
              const isPositive = m.balance >= 0;
              const avatarColor = getAvatarColor(m.name);
              const initials = getInitials(m.name);

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-3 transition-all hover:border-primary/40"
                >
                  {/* Top Bar: Member & Balance */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-sm truncate">
                            {m.name}
                          </span>
                          <Badge
                            variant={m.status === "active" ? "success" : "secondary"}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {m.total_meals} total meals ({m.total_lunch}L / {m.total_dinner}D)
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        }`}
                      >
                        {formatBDT(m.balance)}
                      </span>
                    </div>
                  </div>

                  {/* 3-Column Mini Breakdown */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 text-xs border border-border/50">
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                        Meals
                      </span>
                      <span className="font-bold text-foreground text-xs mt-0.5 block">
                        {m.total_meals}
                      </span>
                    </div>
                    <div className="text-center border-x border-border/40">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                        Cost
                      </span>
                      <span className="font-semibold text-muted-foreground text-xs mt-0.5 block">
                        {formatBDT(m.total_meal_cost)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                        Deposited
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5 block">
                        {formatBDT(m.total_deposited)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <Link
                      href={`/deposits?member=${m.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                    >
                      <Wallet className="h-3 w-3 text-emerald-600" />
                      <span>Add Deposit</span>
                    </Link>

                    <Link href={`/ledger?member=${m.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary/80 font-medium"
                      >
                        <span>View Ledger</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

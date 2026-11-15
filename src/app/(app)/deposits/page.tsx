"use client";

import * as React from "react";
import {
  Wallet,
  PlusCircle,
  Edit2,
  Trash2,
  TrendingUp,
  X,
  Search,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMembers,
  getDeposits,
  addDeposit,
  updateDeposit,
  deleteDeposit,
  getGroupSummary,
} from "@/lib/services";
import { formatBDT, formatDate, getTodayInDhaka } from "@/lib/date";
import { Member, Deposit } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DepositsPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [deposits, setDeposits] = React.useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Group summary state for top balance cards
  const [totalDeposits, setTotalDeposits] = React.useState(0);
  const [totalExpenses, setTotalExpenses] = React.useState(0);
  const [netBalance, setNetBalance] = React.useState(0);

  // Form states for new deposit
  const [selectedMemberId, setSelectedMemberId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [depositDate, setDepositDate] = React.useState(getTodayInDhaka());
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Edit deposit modal state
  const [editDepositItem, setEditDepositItem] = React.useState<Deposit | null>(null);
  const [editAmount, setEditAmount] = React.useState("");
  const [editDate, setEditDate] = React.useState("");
  const [editNote, setEditNote] = React.useState("");
  const [editMemberId, setEditMemberId] = React.useState("");

  // Search filter
  const [searchTerm, setSearchTerm] = React.useState("");

  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const [membersData, depositsData, groupSum] = await Promise.all([
        getMembers(supabase),
        getDeposits(supabase),
        getGroupSummary(supabase),
      ]);

      setMembers(membersData);
      setDeposits(depositsData);
      setTotalDeposits(groupSum.total_group_deposit);
      setTotalExpenses(groupSum.total_group_expense);
      setNetBalance(groupSum.remaining_group_balance);

      if (membersData.length > 0) {
        setSelectedMemberId((prev) => prev || membersData[0].id);
      }
    } catch (err: unknown) {
      toast.error("Failed to load deposits: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const supabase = createClient();
        const [membersData, depositsData, groupSum] = await Promise.all([
          getMembers(supabase),
          getDeposits(supabase),
          getGroupSummary(supabase),
        ]);

        if (ignore) return;
        setMembers(membersData);
        setDeposits(depositsData);
        setTotalDeposits(groupSum.total_group_deposit);
        setTotalExpenses(groupSum.total_group_expense);
        setNetBalance(groupSum.remaining_group_balance);

        if (membersData.length > 0) {
          setSelectedMemberId((prev) => prev || membersData[0].id);
        }
      } catch (err: unknown) {
        if (!ignore) {
          toast.error("Failed to load deposits: " + (err instanceof Error ? err.message : ""));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void init();
    return () => {
      ignore = true;
    };
  }, []);

  // Submit new deposit
  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid deposit amount greater than 0.");
      return;
    }
    if (!selectedMemberId) {
      toast.error("Please select a member.");
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();
      await addDeposit(supabase, {
        member_id: selectedMemberId,
        amount: numAmount,
        deposit_date: depositDate,
        note,
      });

      toast.success(`Deposit of ${formatBDT(numAmount)} saved successfully!`);
      setAmount("");
      setNote("");
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to save deposit: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit update deposit
  const handleUpdateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDepositItem) return;
    const numAmount = parseFloat(editAmount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }

    try {
      const supabase = createClient();
      await updateDeposit(supabase, editDepositItem.id, {
        member_id: editMemberId,
        amount: numAmount,
        deposit_date: editDate,
        note: editNote,
      });

      toast.success("Deposit updated successfully.");
      setEditDepositItem(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to update deposit: " + (err instanceof Error ? err.message : ""));
    }
  };

  // Delete deposit
  const handleDeleteDeposit = async (id: string, memberName: string, amt: number) => {
    if (!confirm(`Are you sure you want to delete deposit of ${formatBDT(amt)} for ${memberName}?`)) {
      return;
    }

    try {
      const supabase = createClient();
      await deleteDeposit(supabase, id);
      toast.success("Deposit transaction removed.");
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to delete deposit: " + (err instanceof Error ? err.message : ""));
    }
  };

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    const term = searchTerm.toLowerCase();
    const name = d.member?.name?.toLowerCase() || "";
    const noteText = d.note?.toLowerCase() || "";
    const dateText = d.deposit_date.toLowerCase();
    return name.includes(term) || noteText.includes(term) || dateText.includes(term);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deposit & Balance Management"
        description="Record and track member fund deposits and running cash balances."
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Total Deposits
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatBDT(totalDeposits)}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Total Meal Expense
              </p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {formatBDT(totalExpenses)}
              </p>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Net Group Balance
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  netBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {formatBDT(netBalance)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                netBalance >= 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form: Record New Deposit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-primary" />
            <span>Record Member Deposit</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDeposit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Member Select */}
            <div className="space-y-1.5">
              <Label htmlFor="member-select">Select Member</Label>
              <select
                id="member-select"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.status === "inactive" ? "(Inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Deposit Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount">Deposit Amount (৳ BDT)</Label>
              <Input
                id="deposit-amount"
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Deposit Date */}
            <div className="space-y-1.5">
              <Label htmlFor="deposit-date">Deposit Date</Label>
              <Input
                id="deposit-date"
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                required
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="deposit-note">Note / Ref (Optional)</Label>
              <Input
                id="deposit-note"
                placeholder="e.g. bKash / Cash"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
              <Button type="submit" variant="primary" isLoading={isSubmitting} className="gap-2 w-full sm:w-auto h-10 sm:h-9">
                <Wallet className="h-4 w-4" />
                <span>Save Deposit</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Deposit History Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Deposit Transaction History</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              All member deposit records ({deposits.length} total)
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by member or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9 w-full"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading deposit records...
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {searchTerm ? "No deposits matching your search." : "No deposits recorded yet."}
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Note / Description</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDeposits.map((dep) => (
                      <tr key={dep.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {formatDate(dep.deposit_date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {dep.member?.name || "Member"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatBDT(dep.amount)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {dep.note || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditDepositItem(dep);
                                setEditMemberId(dep.member_id);
                                setEditAmount(String(dep.amount));
                                setEditDate(dep.deposit_date);
                                setEditNote(dep.note || "");
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Deposit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDeleteDeposit(
                                  dep.id,
                                  dep.member?.name || "Member",
                                  dep.amount
                                )
                              }
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              title="Delete Deposit"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Cards */}
              <div className="md:hidden space-y-2.5">
                {filteredDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {(dep.member?.name || "M").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground text-sm truncate">
                          {dep.member?.name || "Member"}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                        +{formatBDT(dep.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{formatDate(dep.deposit_date)}</span>
                        {dep.note && <span className="ml-1 text-muted-foreground truncate">• {dep.note}</span>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditDepositItem(dep);
                            setEditMemberId(dep.member_id);
                            setEditAmount(String(dep.amount));
                            setEditDate(dep.deposit_date);
                            setEditNote(dep.note || "");
                          }}
                          className="h-7.5 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeleteDeposit(
                              dep.id,
                              dep.member?.name || "Member",
                              dep.amount
                            )
                          }
                          className="h-7.5 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Deposit Modal */}
      {editDepositItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base">Edit Deposit Transaction</CardTitle>
              <button
                type="button"
                onClick={() => setEditDepositItem(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpdateDeposit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-member-select">Member</Label>
                  <select
                    id="edit-member-select"
                    value={editMemberId}
                    onChange={(e) => setEditMemberId(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-amount">Deposit Amount (৳ BDT)</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="any"
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-date">Deposit Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-note">Note / Ref</Label>
                  <Input
                    id="edit-note"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDepositItem(null)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" className="w-full sm:w-auto">
                    Update Deposit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

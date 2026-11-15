"use client";

import * as React from "react";
import {
  UserPlus,
  Edit2,
  Power,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  Mail,
  KeyRound,
  ShieldCheck,
  Search,
  Users,
  UtensilsCrossed,
  Wallet,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  getGroupSummary,
  getMemberLedger,
} from "@/lib/services";
import { formatBDT, formatDate, getPresetDateRange, DatePreset } from "@/lib/date";
import { Member, MemberSummary, UserRole } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MigrationAlert } from "@/components/shared/migration-alert";
import { MemberDetailsModal } from "@/components/members/member-details-modal";
import { toast } from "sonner";

// Avatar background colors based on name hash
const AVATAR_COLORS = [
  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "bg-rose-500/10 text-rose-600 border-rose-500/20",
  "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function MembersPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [summaries, setSummaries] = React.useState<Record<string, MemberSummary>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTableMissing, setIsTableMissing] = React.useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [balanceFilter, setBalanceFilter] = React.useState<"all" | "surplus" | "due">("all");

  // Modal states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newMemberName, setNewMemberName] = React.useState("");
  const [newMemberEmail, setNewMemberEmail] = React.useState("");
  const [newMemberUsername, setNewMemberUsername] = React.useState("");
  const [newMemberPassword, setNewMemberPassword] = React.useState("");
  const [createAccountWithMember, setCreateAccountWithMember] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  const [editMember, setEditMember] = React.useState<Member | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);

  // Dedicated Report Email Modal state
  const [reportEmailMember, setReportEmailMember] = React.useState<Member | null>(null);
  const [reportEmailValue, setReportEmailValue] = React.useState("");
  const [isSavingReportEmail, setIsSavingReportEmail] = React.useState(false);

  // Account provisioning state
  const [accountMember, setAccountMember] = React.useState<Member | null>(null);
  const [accountEmail, setAccountEmail] = React.useState("");
  const [accountPassword, setAccountPassword] = React.useState("");
  const [accountRole, setAccountRole] = React.useState<UserRole>("member");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isProvisioning, setIsProvisioning] = React.useState(false);

  // Delete member state
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Detail / history view modal
  const [detailMemberId, setDetailMemberId] = React.useState<string | null>(null);
  const [detailData, setDetailData] = React.useState<{
    member: Member | null;
    dailyMeals: Array<{
      meal_date: string;
      day_name: string;
      lunch: number;
      dinner: number;
      total_meals: number;
      total_cost: number;
    }>;
    deposits: Array<{
      id: string;
      amount: number;
      deposit_date: string;
      note?: string | null;
    }>;
    summary: {
      total_meals: number;
      total_cost: number;
      total_deposited: number;
      balance: number;
    };
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // On-demand statement dispatch state
  const [sendStatementMember, setSendStatementMember] = React.useState<Member | null>(null);
  const [statementPreset, setStatementPreset] = React.useState<DatePreset | "custom">("this_month");
  const [statementStartDate, setStatementStartDate] = React.useState("");
  const [statementEndDate, setStatementEndDate] = React.useState("");
  const [isSendingStatement, setIsSendingStatement] = React.useState(false);

  // Fetch members and their financial statistics
  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const [membersData, groupSum] = await Promise.all([
        getMembers(supabase),
        getGroupSummary(supabase),
      ]);

      setMembers(membersData);

      const sumMap: Record<string, MemberSummary> = {};
      for (const s of groupSum.member_summaries) {
        sumMap[s.id] = s;
      }
      setSummaries(sumMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("schema cache") || msg.includes("PGRST205") || msg.includes("does not exist")) {
        setIsTableMissing(true);
      } else {
        toast.error("Failed to load members: " + msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const supabase = createClient();
        const [membersData, groupSum] = await Promise.all([
          getMembers(supabase),
          getGroupSummary(supabase),
        ]);

        if (ignore) return;
        setMembers(membersData);

        const sumMap: Record<string, MemberSummary> = {};
        for (const s of groupSum.member_summaries) {
          sumMap[s.id] = s;
        }
        setSummaries(sumMap);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("schema cache") || msg.includes("PGRST205") || msg.includes("does not exist")) {
          if (!ignore) setIsTableMissing(true);
        } else {
          if (!ignore) toast.error("Failed to load members: " + msg);
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void init();
    return () => {
      ignore = true;
    };
  }, []);

  // Open detail view for member
  const handleViewDetail = async (memberId: string) => {
    try {
      setDetailMemberId(memberId);
      setIsLoadingDetail(true);
      const supabase = createClient();
      const ledger = await getMemberLedger(supabase, memberId);
      setDetailData(ledger);
    } catch (err: unknown) {
      toast.error("Failed to load member detail: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      toast.error("Please enter a member name.");
      return;
    }

    try {
      setIsAdding(true);
      const supabase = createClient();
      const created = await addMember(supabase, newMemberName.trim(), newMemberEmail.trim() || null);

      // If user checked "Create login account immediately"
      if (createAccountWithMember && newMemberPassword.trim().length >= 6) {
        const loginIdent =
          newMemberUsername.trim() ||
          newMemberEmail.trim() ||
          newMemberName.toLowerCase().replace(/\s+/g, "");

        try {
          await fetch("/api/admin/provision-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              memberId: created.id,
              email: loginIdent,
              password: newMemberPassword,
              role: "member",
            }),
          });
          toast.success(`Member "${newMemberName}" & Login account created successfully!`);
        } catch {
          toast.warning(`Member created, but account provisioning could not be completed. You can set it from the key icon.`);
        }
      } else {
        toast.success(`Member "${newMemberName}" added successfully.`);
      }

      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberUsername("");
      setNewMemberPassword("");
      setCreateAccountWithMember(false);
      setIsAddOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("schema cache") || msg.includes("PGRST205") || msg.includes("does not exist")) {
        setIsTableMissing(true);
        toast.error("Database table missing. Please apply migrations.");
      } else {
        toast.error("Error adding member: " + msg);
      }
    } finally {
      setIsAdding(false);
    }
  };

  // Edit Member Name & Email
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember || !editName.trim()) return;

    try {
      setIsEditing(true);
      const supabase = createClient();
      await updateMember(supabase, editMember.id, {
        name: editName.trim(),
        email: editEmail.trim() || null,
      });
      toast.success(`Member updated to "${editName}".`);
      setEditMember(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Error updating member: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsEditing(false);
    }
  };

  // Save / Update Member Notification/Report Email
  const handleSaveReportEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmailMember) return;

    try {
      setIsSavingReportEmail(true);
      const supabase = createClient();
      await updateMember(supabase, reportEmailMember.id, {
        email: reportEmailValue.trim() || null,
      });

      toast.success(
        reportEmailValue.trim()
          ? `Report email for "${reportEmailMember.name}" saved as ${reportEmailValue.trim()}.`
          : `Report email for "${reportEmailMember.name}" cleared.`
      );
      setReportEmailMember(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to update report email: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingReportEmail(false);
    }
  };

  // Provision / Update Member Web Portal Login Credentials
  const handleProvisionAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountMember || !accountEmail.trim()) {
      toast.error("Please enter a username or email address.");
      return;
    }
    if (!accountPassword || accountPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setIsProvisioning(true);
      const res = await fetch("/api/admin/provision-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: accountMember.id,
          email: accountEmail.trim(),
          password: accountPassword,
          role: accountRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to provision login credentials");
      }

      toast.success(`Login credentials for "${accountMember.name}" saved successfully!`);
      setAccountMember(null);
      setAccountPassword("");
      loadData();
    } catch (err: unknown) {
      toast.error("Provisioning failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsProvisioning(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleStatus = async (member: Member) => {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    const confirmMsg =
      nextStatus === "inactive"
        ? `Deactivate member "${member.name}"? They will no longer appear in daily meal attendance, but all history is preserved.`
        : `Reactivate member "${member.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const supabase = createClient();
      await updateMember(supabase, member.id, { status: nextStatus });
      toast.success(`Member "${member.name}" is now ${nextStatus}.`);
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to update status: " + (err instanceof Error ? err.message : ""));
    }
  };

  // Delete Member Permanently
  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      setIsDeleting(true);
      const supabase = createClient();
      await deleteMember(supabase, memberToDelete.id);
      toast.success(`Member "${memberToDelete.name}" deleted successfully.`);
      setMemberToDelete(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Failed to delete member: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsDeleting(false);
    }
  };

  // Send On-Demand Statement Email
  const handleStatementPreset = (preset: DatePreset) => {
    setStatementPreset(preset);
    if (preset === "all") {
      setStatementStartDate("");
      setStatementEndDate("");
    } else {
      const r = getPresetDateRange(preset);
      setStatementStartDate(r.startDate);
      setStatementEndDate(r.endDate);
    }
  };

  const handleSendStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendStatementMember) return;
    if (!sendStatementMember.email?.trim()) {
      toast.error(`Member "${sendStatementMember.name}" does not have an email address configured. Edit the member to add an email first.`);
      return;
    }

    try {
      setIsSendingStatement(true);
      const res = await fetch("/api/admin/dispatch-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "single_member_statement",
          memberId: sendStatementMember.id,
          startDate: statementStartDate || undefined,
          endDate: statementEndDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch statement email");
      }

      toast.success(`Statement email dispatched to ${sendStatementMember.name} (${sendStatementMember.email})!`);
      setSendStatementMember(null);
    } catch (err: unknown) {
      toast.error("Failed to send statement email: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSendingStatement(false);
    }
  };

  // Calculate Group Totals for Overview Header
  const activeMembers = members.filter((m) => m.status === "active");
  const inactiveMembers = members.filter((m) => m.status === "inactive");
  const totalMealsAll = Object.values(summaries).reduce((acc, s) => acc + s.total_meals, 0);
  const totalDepositsAll = Object.values(summaries).reduce((acc, s) => acc + s.total_deposited, 0);
  const totalMealCostAll = Object.values(summaries).reduce((acc, s) => acc + s.total_meal_cost, 0);
  const totalNetBalance = totalDepositsAll - totalMealCostAll;

  // Filtered members list
  const filteredMembers = React.useMemo(() => {
    return members.filter((member) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        (member.email && member.email.toLowerCase().includes(q));

      // 2. Status Filter
      const matchesStatus =
        statusFilter === "all" || member.status === statusFilter;

      // 3. Balance Filter
      const sum = summaries[member.id] || { balance: 0 };
      const matchesBalance =
        balanceFilter === "all" ||
        (balanceFilter === "surplus" && sum.balance >= 0) ||
        (balanceFilter === "due" && sum.balance < 0);

      return matchesSearch && matchesStatus && matchesBalance;
    });
  }, [members, summaries, searchQuery, statusFilter, balanceFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Members & Meal Roster"
        description="Comprehensive management of mess members, meal statistics, deposits, and individual balances."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 shadow-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New Member</span>
          </Button>
        }
      />

      <MigrationAlert isTableMissing={isTableMissing} />

      {/* 1. Group Financial & Member Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Members Card */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Members</span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{members.length}</span>
              <span className="text-xs text-muted-foreground font-medium">Total</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {activeMembers.length} Active
              </span>
              {inactiveMembers.length > 0 && (
                <span className="text-muted-foreground">
                  • {inactiveMembers.length} Inactive
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Meals Card */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Meals</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{totalMealsAll}</span>
              <span className="text-xs text-muted-foreground font-medium">Served</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Expense: <strong className="text-foreground">{formatBDT(totalMealCostAll)}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Total Deposits Card */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Group Deposits</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatBDT(totalDepositsAll)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Collected from all members
            </p>
          </CardContent>
        </Card>

        {/* Net Treasury Balance Card */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Treasury Balance</span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  totalNetBalance >= 0
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {totalNetBalance >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span
                className={`text-2xl font-bold ${
                  totalNetBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {formatBDT(totalNetBalance)}
              </span>
            </div>
            <div className="mt-2">
              <Badge
                variant={totalNetBalance >= 0 ? "success" : "destructive"}
                className="text-[10px] py-0 px-1.5 font-medium"
              >
                {totalNetBalance >= 0 ? "Treasury Surplus" : "Deficit / Uncollected Dues"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Search, Filter & View Controls */}
      <Card className="border-border/80 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search member by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "all"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({members.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "active"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Active ({activeMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("inactive")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "inactive"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Inactive ({inactiveMembers.length})
                </button>
              </div>

              {/* Balance Filter */}
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value as "all" | "surplus" | "due")}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Balances</option>
                <option value="surplus">Surplus (In Credit +৳)</option>
                <option value="due">Due / Deficit (-৳)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Main Members Table & Cards Container */}
      <Card className="border-border/80 shadow-2xs overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60 bg-muted/20">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Group Roster</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"} displayed)
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading members roster and balances...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">No members match your criteria</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || balanceFilter !== "all"
                  ? "Try resetting your search query or filter options."
                  : "Click 'Add New Member' to start building your mess group."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] font-semibold uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border/70">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-3">Report Email</th>
                      <th className="py-3 px-3">Web Login</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Meals</th>
                      <th className="py-3 px-4 text-right">Meal Cost</th>
                      <th className="py-3 px-4 text-right">Deposited</th>
                      <th className="py-3 px-4 text-right">Net Balance</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredMembers.map((member) => {
                      const sum = summaries[member.id] || {
                        total_meals: 0,
                        total_meal_cost: 0,
                        total_deposited: 0,
                        balance: 0,
                      };
                      const isPositive = sum.balance >= 0;
                      const avatarColor = getAvatarColor(member.name);

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          {/* Member Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${avatarColor}`}
                              >
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground text-sm block truncate">
                                  {member.name}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Report Email (Separate from Login) */}
                          <td className="py-3.5 px-3">
                            {member.email ? (
                              <div className="flex items-center gap-1.5 group/email">
                                <span className="text-xs font-mono text-foreground truncate max-w-[160px]" title={member.email}>
                                  {member.email}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportEmailMember(member);
                                    setReportEmailValue(member.email || "");
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                                  title="Edit Report Email Address"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReportEmailMember(member);
                                  setReportEmailValue("");
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                                title="Click to set recipient email"
                              >
                                <Mail className="h-3 w-3" />
                                <span>+ Set Email</span>
                              </button>
                            )}
                          </td>

                          {/* Web Login Account (Separate from Report Email) */}
                          <td className="py-3.5 px-3">
                            {member.user_id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Active</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAccountMember(member);
                                    setAccountEmail(member.email || `${member.name.toLowerCase().replace(/\s+/g, "")}@mill.local`);
                                    setAccountPassword("");
                                    setAccountRole("member");
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                                  title="Reset Login Password"
                                >
                                  <KeyRound className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAccountMember(member);
                                  setAccountEmail(member.email || `${member.name.toLowerCase().replace(/\s+/g, "")}@mill.local`);
                                  setAccountPassword("");
                                  setAccountRole("member");
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                                title="Click to setup web login credentials"
                              >
                                <KeyRound className="h-3 w-3" />
                                <span>+ Setup Login</span>
                              </button>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 text-center">
                            <Badge
                              variant={member.status === "active" ? "success" : "secondary"}
                              className="text-[11px] font-medium"
                            >
                              {member.status}
                            </Badge>
                          </td>

                          {/* Meals Count */}
                          <td className="py-3.5 px-3 text-center font-semibold text-foreground">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-muted/60 text-xs font-mono">
                              {sum.total_meals}
                            </span>
                          </td>

                          {/* Meal Cost */}
                          <td className="py-3.5 px-4 text-right text-muted-foreground font-medium font-mono">
                            {formatBDT(sum.total_meal_cost)}
                          </td>

                          {/* Total Deposited */}
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatBDT(sum.total_deposited)}
                          </td>

                          {/* Current Balance */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isPositive
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-destructive/10 text-destructive border border-destructive/20"
                              }`}
                            >
                              {formatBDT(sum.balance)}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Details */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleViewDetail(member.id)}
                                className="h-8 w-8 text-primary hover:bg-primary/10 transition-colors border-border/80"
                                title="View Member Ledger & History"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {/* Send On-Demand Statement Email */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setSendStatementMember(member);
                                  handleStatementPreset("this_month");
                                }}
                                className="h-8 w-8 text-blue-600 hover:bg-blue-500/10 transition-colors border-border/80"
                                title="Send On-Demand Statement Email"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>

                              {/* Edit Name */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setEditMember(member);
                                  setEditName(member.name);
                                  setEditEmail(member.email || "");
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors border-border/80"
                                title="Edit Member Name"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>

                              {/* Activate / Deactivate Toggle */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleToggleStatus(member)}
                                className={`h-8 w-8 border-border/80 transition-colors ${
                                  member.status === "active"
                                    ? "text-amber-600 hover:bg-amber-500/10"
                                    : "text-emerald-600 hover:bg-emerald-500/10"
                                }`}
                                title={member.status === "active" ? "Deactivate Member" : "Activate Member"}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </Button>

                              {/* Delete Member */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setMemberToDelete(member)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border-border/80"
                                title="Delete Member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Cards View */}
              <div className="md:hidden divide-y divide-border/60">
                {filteredMembers.map((member) => {
                  const sum = summaries[member.id] || {
                    total_meals: 0,
                    total_meal_cost: 0,
                    total_deposited: 0,
                    balance: 0,
                  };
                  const isPositive = sum.balance >= 0;
                  const avatarColor = getAvatarColor(member.name);

                  return (
                    <div key={member.id} className="p-4 space-y-3 bg-card/60">
                      {/* Top Row: Avatar, Name, Status, Balance */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${avatarColor}`}
                          >
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground text-sm truncate block">
                              {member.name}
                            </span>
                            <Badge
                              variant={member.status === "active" ? "success" : "secondary"}
                              className="text-[10px] mt-0.5"
                            >
                              {member.status}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Net Balance</span>
                          <span
                            className={`text-sm font-bold font-mono ${
                              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            }`}
                          >
                            {formatBDT(sum.balance)}
                          </span>
                        </div>
                      </div>

                      {/* Separate Email & Login Row */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">Report Email:</span>
                          {member.email ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReportEmailMember(member);
                                setReportEmailValue(member.email || "");
                              }}
                              className="text-left font-mono text-[11px] text-foreground truncate block hover:text-blue-600 transition-colors mt-0.5"
                            >
                              {member.email}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReportEmailMember(member);
                                setReportEmailValue("");
                              }}
                              className="text-[11px] text-blue-600 font-semibold hover:underline mt-0.5 block"
                            >
                              + Set Email
                            </button>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">Web Login:</span>
                          {member.user_id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMember(member);
                                setAccountEmail(member.email || "");
                                setAccountPassword("");
                                setAccountRole("member");
                              }}
                              className="text-[11px] text-emerald-600 font-semibold hover:underline mt-0.5 flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Reset Pass</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMember(member);
                                setAccountEmail(member.email || "");
                                setAccountPassword("");
                                setAccountRole("member");
                              }}
                              className="text-[11px] text-amber-600 font-semibold hover:underline mt-0.5 flex items-center gap-1"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>+ Setup Login</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Financial Breakdown Grid */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 text-xs text-center border border-border/50 font-mono">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans">Meals</span>
                          <span className="font-bold text-foreground">{sum.total_meals}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans">Expense</span>
                          <span className="font-semibold text-muted-foreground">{formatBDT(sum.total_meal_cost)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans">Deposited</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatBDT(sum.total_deposited)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(member.id)}
                          className="h-8 px-2.5 text-xs text-primary border-primary/20 hover:bg-primary/10"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Ledger</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setSendStatementMember(member);
                              handleStatementPreset("this_month");
                            }}
                            className="h-8 w-8 text-blue-600 border-border/80"
                            title="Send Statement Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setEditMember(member);
                              setEditName(member.name);
                              setEditEmail(member.email || "");
                            }}
                            className="h-8 w-8 text-muted-foreground border-border/80"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleToggleStatus(member)}
                            className="h-8 w-8 text-muted-foreground border-border/80"
                            title="Toggle Status"
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setMemberToDelete(member)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive border-border/80"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. MODALS */}

      {/* Modal: Add Member */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <span>Add New Member</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-name">Member Name (সদস্যের নাম)</Label>
                  <Input
                    id="new-name"
                    placeholder="e.g. Rahim, Karim, Tuhin"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      if (!newMemberUsername) {
                        setNewMemberUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                      }
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-email">Report Email (হিসাবের ইমেইল - ঐচ্ছিক)</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="e.g. member@gmail.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This email receives weekly automated reports and on-demand mess statements.
                  </p>
                </div>

                {/* Optional instant login provisioning */}
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccountWithMember}
                      onChange={(e) => setCreateAccountWithMember(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Create Website Login Account (ঐচ্ছিক লগইন অ্যাক্সেস)</span>
                  </label>

                  {createAccountWithMember && (
                    <div className="space-y-2.5 pt-1 border-t border-border/60">
                      <div className="space-y-1">
                        <Label htmlFor="new-username" className="text-xs">Login Username or Email</Label>
                        <Input
                          id="new-username"
                          type="text"
                          placeholder="e.g. tuhin or tuhin@gmail.com"
                          value={newMemberUsername}
                          onChange={(e) => setNewMemberUsername(e.target.value)}
                          required={createAccountWithMember}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="new-password" className="text-xs">Initial Password (পাসওয়ার্ড)</Label>
                        <Input
                          id="new-password"
                          type="password"
                          placeholder="At least 6 characters"
                          value={newMemberPassword}
                          onChange={(e) => setNewMemberPassword(e.target.value)}
                          required={createAccountWithMember}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddOpen(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isAdding}>
                    Add Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Edit Member */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                <span>Edit Member Details</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setEditMember(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleEditMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Member Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-email">Report Recipient Email (হিসাবের ইমেইল)</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="member@gmail.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Destination address for weekly and on-demand mess calculation reports.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMember(null)}
                    disabled={isEditing}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isEditing}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Dedicated Report Email Setup (আলাদা হিসাবের ইমেইল) */}
      {reportEmailMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Member Report Email</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Target Member: <strong>{reportEmailMember.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportEmailMember(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveReportEmail} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="member-report-email">Email Address (হিসাবের ইমেইল)</Label>
                  <Input
                    id="member-report-email"
                    type="email"
                    placeholder="e.g. member@gmail.com"
                    value={reportEmailValue}
                    onChange={(e) => setReportEmailValue(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This address receives scheduled weekly reports and on-demand mess statements. It operates completely independently of website login credentials.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReportEmailMember(null)}
                    disabled={isSavingReportEmail}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isSavingReportEmail}>
                    Save Report Email
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Provision / Reset Login Credentials */}
      {accountMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span>Web Portal Login Credentials</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Target Member: <strong>{accountMember.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccountMember(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleProvisionAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="account-email">Login Username or Email (ইউজারনেম বা ইমেইল)</Label>
                  <Input
                    id="account-email"
                    type="text"
                    placeholder={`e.g. ${accountMember.name.toLowerCase().replace(/\s+/g, '')} or email@domain.com`}
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    You can set a simple username or any email address.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="account-password">Password (পাসওয়ার্ড)</Label>
                  <div className="relative">
                    <Input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    If this user already exists, submitting will update their password.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="account-role">Assigned System Role</Label>
                  <select
                    id="account-role"
                    value={accountRole}
                    onChange={(e) => setAccountRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="member">MEMBER (Personal read-only dashboard & statements)</option>
                    <option value="admin">ADMIN (Full administrative access & settings)</option>
                    <option value="group_ledger_viewer">GROUP_LEDGER_VIEWER (Confidential aggregate view only)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAccountMember(null)}
                    disabled={isProvisioning}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isProvisioning}>
                    Save Login Credentials
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Confirm Permanent Deletion */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-destructive/40">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Confirm Permanent Deletion</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-foreground">
                Are you sure you want to permanently delete member{" "}
                <strong>&quot;{memberToDelete.name}&quot;</strong>?
              </p>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                <strong>Warning:</strong>
                <p>
                  This action permanently removes the member profile. Meal entries and deposits linked to this member will also be affected. Consider <strong>Deactivating</strong> instead if you wish to preserve historical records.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteMember}
                  isLoading={isDeleting}
                >
                  Delete Permanently
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Detailed Member Ledger & History */}
      <MemberDetailsModal
        isOpen={Boolean(detailMemberId)}
        onClose={() => setDetailMemberId(null)}
        data={detailData}
        isLoading={isLoadingDetail}
      />

      {/* Modal: Send On-Demand Statement Email */}
      {sendStatementMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Send Statement Email
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Dispatch personal mess calculation to {sendStatementMember.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSendStatementMember(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendStatement} className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient Member:</span>
                  <span className="font-semibold text-foreground">{sendStatementMember.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Address:</span>
                  <span className="font-mono text-primary">
                    {sendStatementMember.email || "No email set"}
                  </span>
                </div>
              </div>

              {!sendStatementMember.email && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  ⚠️ This member does not have an email address configured. Please edit the member to set an email first.
                </div>
              )}

              {/* Period Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Select Statement Period (হিসাবের সময়কাল)
                </Label>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleStatementPreset("this_week")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      statementPreset === "this_week"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatementPreset("this_month")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      statementPreset === "this_month"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatementPreset("last_month")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      statementPreset === "last_month"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatementPreset("all")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      statementPreset === "all"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Time
                  </button>
                </div>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="stmt-start" className="text-[11px] text-muted-foreground">From Date</Label>
                  <Input
                    id="stmt-start"
                    type="date"
                    value={statementStartDate}
                    onChange={(e) => {
                      setStatementPreset("custom");
                      setStatementStartDate(e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="stmt-end" className="text-[11px] text-muted-foreground">To Date</Label>
                  <Input
                    id="stmt-end"
                    type="date"
                    value={statementEndDate}
                    onChange={(e) => {
                      setStatementPreset("custom");
                      setStatementEndDate(e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSendStatementMember(null)}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!sendStatementMember.email}
                  isLoading={isSendingStatement}
                  className="h-9 text-xs gap-1.5"
                >
                  <Mail className="h-4 w-4" />
                  <span>Dispatch Email Now</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

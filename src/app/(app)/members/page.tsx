"use client";

import * as React from "react";
import {
  UserPlus,
  Edit2,
  Power,
  Eye,
  Trash2,
  X,
  Mail,
  KeyRound,
  ShieldCheck,
  Search,
  Users,
  UtensilsCrossed,
  Wallet,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Filter,
  Copy,
  Check,
  Send,
  Calendar,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  getGroupSummary,
  getMemberLedger,
  getCachedItem,
  getMemberInitialBalance,
  setMemberInitialBalance,
} from "@/lib/services";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { formatBDT, formatDate, getTodayInDhaka } from "@/lib/date";
import { Member, MemberSummary, GroupSummary, UserRole } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MigrationAlert } from "@/components/shared/migration-alert";
import { MemberDetailsModal } from "@/components/members/member-details-modal";
import { toast } from "sonner";

interface MemberCredentials {
  userId: string;
  email: string;
  displayUsername: string;
  displayPassword: string | null;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
}

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

const MONTH_NAMES_BN = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

export default function MembersPage() {
  const [members, setMembers] = React.useState<Member[]>(() => {
    return getCachedItem<Member[]>("members") || [];
  });
  const [summaries, setSummaries] = React.useState<Record<string, MemberSummary>>(() => {
    const cachedGroup = getCachedItem<GroupSummary>("group_summary");
    if (cachedGroup?.member_summaries) {
      const map: Record<string, MemberSummary> = {};
      for (const s of cachedGroup.member_summaries) {
        map[s.id] = s;
      }
      return map;
    }
    return {};
  });
  const [credentialsMap, setCredentialsMap] = React.useState<Record<string, MemberCredentials>>({});
  const [isLoading, setIsLoading] = React.useState(!members.length);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isTableMissing, setIsTableMissing] = React.useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "inactive" | "has_login" | "needs_login" | "surplus" | "due"
  >("all");

  // Modal: Add Member
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newMemberName, setNewMemberName] = React.useState("");
  const [newMemberEmail, setNewMemberEmail] = React.useState("");
  const [newMemberInitialBalance, setNewMemberInitialBalance] = React.useState("0");
  const [newMemberUsername, setNewMemberUsername] = React.useState("");
  const [newMemberPassword, setNewMemberPassword] = React.useState("Password123!");
  const [createAccountWithMember, setCreateAccountWithMember] = React.useState(true);
  const [isAdding, setIsAdding] = React.useState(false);

  // Modal: Edit Member
  const [editMember, setEditMember] = React.useState<Member | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editInitialBalance, setEditInitialBalance] = React.useState("0");
  const [isEditing, setIsEditing] = React.useState(false);

  // Modal: Delete Member
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Modal: Member Details / Ledger History
  const [detailMemberId, setDetailMemberId] = React.useState<string | null>(null);
  const [detailData, setDetailData] = React.useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // Modal: Login Credentials & Password Manager
  const [credsMember, setCredsMember] = React.useState<Member | null>(null);
  const [credsUsername, setCredsUsername] = React.useState("");
  const [credsPassword, setCredsPassword] = React.useState("");
  const [credsRole, setCredsRole] = React.useState<UserRole>("member");
  const [showPassword, setShowPassword] = React.useState(true);
  const [isSavingCreds, setIsSavingCreds] = React.useState(false);
  const [copiedItem, setCopiedItem] = React.useState<string | null>(null);

  // Modal: Send Statement Email (Full Statement, Monthly, Weekly)
  const [stmtMember, setStmtMember] = React.useState<Member | null>(null);
  const [stmtType, setStmtType] = React.useState<"all" | "month" | "week" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    const today = getTodayInDhaka();
    return parseInt(today.split("-")[1], 10);
  });
  const [selectedYear, setSelectedYear] = React.useState<number>(() => {
    const today = getTodayInDhaka();
    return parseInt(today.split("-")[0], 10);
  });
  const [customStartDate, setCustomStartDate] = React.useState("");
  const [customEndDate, setCustomEndDate] = React.useState("");
  const [isSendingStatement, setIsSendingStatement] = React.useState(false);

  // Load members and financial summaries immediately; credentials asynchronously in background
  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const [membersData, groupSum] = await Promise.all([
        getMembers(supabase),
        getGroupSummary(supabase),
      ]);

      if (membersData && membersData.length > 0) {
        setMembers(membersData);
      } else if (groupSum?.member_summaries?.length) {
        // Fallback: use group summary members if getMembers returned empty
        const fallbackMembers: Member[] = groupSum.member_summaries.map((s) => ({
          id: s.id,
          name: s.name,
          email: null,
          status: s.status,
          created_at: "",
          updated_at: "",
        }));
        setMembers(fallbackMembers);
      }

      if (groupSum?.member_summaries) {
        const sumMap: Record<string, MemberSummary> = {};
        for (const s of groupSum.member_summaries) {
          sumMap[s.id] = s;
        }
        setSummaries(sumMap);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("schema cache") || msg.includes("PGRST205") || msg.includes("does not exist")) {
        setIsTableMissing(true);
      } else {
        toast.error("Failed to load members: " + msg);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }

    // Background fetch credentials without blocking member table rendering
    try {
      const credsRes = await fetch("/api/admin/user-credentials");
      if (credsRes && credsRes.ok) {
        const credsJson = await credsRes.json();
        if (credsJson.credentials) {
          setCredentialsMap(credsJson.credentials);
        }
      }
    } catch (e) {
      console.warn("Could not load user credentials:", e);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization for members and financial balances
  useRealtimeSync(["members", "meals", "deposits", "all"], () => {
    void loadData();
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Copy helper with feedback
  const handleCopyText = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(identifier);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedItem(null), 2500);
  };

  // Open Credentials Modal
  const handleOpenCredentials = (member: Member) => {
    setCredsMember(member);
    const existing = credentialsMap[member.id];
    const defaultUsername =
      existing?.displayUsername ||
      member.email?.replace(/@mill\.local$/i, "") ||
      member.name.toLowerCase().replace(/\s+/g, "");

    setCredsUsername(defaultUsername);
    setCredsPassword(existing?.displayPassword || "Password123!");
    setCredsRole((existing?.role as UserRole) || "member");
    setShowPassword(true);
  };

  // Save / Update Member Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credsMember) return;
    if (!credsUsername.trim()) {
      toast.error("Username cannot be empty.");
      return;
    }
    if (!credsPassword || credsPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setIsSavingCreds(true);
      const res = await fetch("/api/admin/provision-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: credsMember.id,
          email: credsUsername.trim(),
          password: credsPassword,
          role: credsRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update login credentials");
      }

      toast.success(`Login credentials for "${credsMember.name}" saved successfully!`);

      // Update local credentials map immediately
      setCredentialsMap((prev) => ({
        ...prev,
        [credsMember.id]: {
          userId: data.user.id,
          email: data.user.email,
          displayUsername: data.user.displayUsername,
          displayPassword: data.user.displayPassword,
          role: data.user.role,
          createdAt: new Date().toISOString(),
          lastSignInAt: null,
        },
      }));

      loadData();
    } catch (err: unknown) {
      toast.error("Credential update failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingCreds(false);
    }
  };

  // Open Statement Dispatch Modal
  const handleOpenStatementModal = (member: Member) => {
    setStmtMember(member);
    setStmtType("month");
    const today = getTodayInDhaka();
    const [yStr, mStr] = today.split("-");
    setSelectedYear(parseInt(yStr, 10));
    setSelectedMonth(parseInt(mStr, 10));
    setCustomStartDate(`${yStr}-${mStr}-01`);
    setCustomEndDate(today);
  };

  // Dispatch Statement Email
  const handleSendStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stmtMember) return;
    if (!stmtMember.email?.trim()) {
      toast.error(`Member "${stmtMember.name}" has no email configured. Edit the member to add their email address.`);
      return;
    }

    try {
      setIsSendingStatement(true);
      const payload: any = {
        action: "single_member_statement",
        memberId: stmtMember.id,
        periodType: stmtType,
      };

      if (stmtType === "month") {
        payload.month = selectedMonth;
        payload.year = selectedYear;
      } else if (stmtType === "custom") {
        payload.startDate = customStartDate;
        payload.endDate = customEndDate;
      }

      const res = await fetch("/api/admin/dispatch-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch statement email");
      }

      toast.success(data.message || `Statement email delivered to ${stmtMember.name}!`);
      setStmtMember(null);
    } catch (err: unknown) {
      toast.error("Failed to send statement email: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSendingStatement(false);
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

      // Save initial balance if provided
      const initAmount = parseFloat(newMemberInitialBalance);
      if (!isNaN(initAmount) && initAmount !== 0) {
        await setMemberInitialBalance(supabase, created.id, initAmount);
      }

      if (createAccountWithMember && newMemberPassword.trim().length >= 6) {
        const username =
          newMemberUsername.trim() ||
          newMemberEmail.trim() ||
          newMemberName.toLowerCase().replace(/\s+/g, "");

        try {
          await fetch("/api/admin/provision-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              memberId: created.id,
              email: username,
              password: newMemberPassword.trim(),
              role: "member",
            }),
          });
          toast.success(`Member "${newMemberName}" & Login account created! Password: ${newMemberPassword}`);
        } catch {
          toast.warning("Member created, but portal login account could not be provisioned.");
        }
      } else {
        toast.success(`Member "${newMemberName}" added successfully.`);
      }

      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberInitialBalance("0");
      setNewMemberUsername("");
      setNewMemberPassword("Password123!");
      setIsAddOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error("Error adding member: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsAdding(false);
    }
  };

  // Edit Member Name & Email & Initial Balance
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

      const parsedInit = parseFloat(editInitialBalance);
      if (!isNaN(parsedInit)) {
        await setMemberInitialBalance(supabase, editMember.id, parsedInit);
      }

      toast.success(`Member "${editName}" updated successfully.`);
      setEditMember(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Error updating member: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsEditing(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleStatus = async (member: Member) => {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    if (!confirm(`Change status of "${member.name}" to ${nextStatus}?`)) return;

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

  // Filtered members list
  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      const sum = summaries[m.id];
      const creds = credentialsMap[m.id];
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (creds?.displayUsername && creds.displayUsername.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === "active") return m.status === "active";
      if (statusFilter === "inactive") return m.status === "inactive";
      if (statusFilter === "has_login") return Boolean(m.user_id || creds);
      if (statusFilter === "needs_login") return !m.user_id && !creds;
      if (statusFilter === "surplus") return (sum?.balance || 0) >= 0;
      if (statusFilter === "due") return (sum?.balance || 0) < 0;

      return true;
    });
  }, [members, summaries, credentialsMap, searchQuery, statusFilter]);

  // Aggregate stats
  const totalActive = members.filter((m) => m.status === "active").length;
  const totalWithLogin = members.filter((m) => m.user_id || credentialsMap[m.id]).length;
  const totalWithEmail = members.filter((m) => m.email && m.email.trim()).length;
  const totalBalance = Object.values(summaries).reduce((acc, s) => acc + (s.balance || 0), 0);

  const monthsList = [
    { value: 11, label: "নভেম্বর ২০২৬ (November 2026)" },
    { value: 10, label: "অক্টোবর ২০২৬ (October 2026)" },
    { value: 9, label: "সেপ্টেম্বর ২০২৬ (September 2026)" },
    { value: 8, label: "আগস্ট ২০২৬ (August 2026)" },
    { value: 7, label: "জুলাই ২০২৬ (July 2026)" },
    { value: 6, label: "জুন ২০২৬ (June 2026)" },
    { value: 5, label: "মে ২০২৬ (May 2026)" },
    { value: 4, label: "এপ্রিল ২০২৬ (April 2026)" },
    { value: 3, label: "মার্চ ২০২৬ (March 2026)" },
    { value: 2, label: "ফেব্রুয়ারি ২০২৬ (February 2026)" },
    { value: 1, label: "জানুয়ারি ২০২৬ (January 2026)" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Members & Access Control"
        description="সদস্য ব্যবস্থাপনা, লগইন ইউজারনেম-পাসওয়ার্ড দেখা ও নিয়ন্ত্রণ, এবং চাহিদামত মিল বিবরণী পাঠানো।"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewMemberName("");
                setNewMemberEmail("");
                setNewMemberUsername("");
                setNewMemberPassword("Password123!");
                setCreateAccountWithMember(true);
                setIsAddOpen(true);
              }}
              className="gap-1.5 shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </Button>
          </div>
        }
      />

      <MigrationAlert isTableMissing={isTableMissing} />

      {/* 2. TOP METRIC OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Members */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Members
            </span>
            <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 flex items-center justify-between">
              <span>{isLoading && members.length === 0 ? "..." : members.length}</span>
              <Users className="h-5 w-5 text-primary/70" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isLoading && members.length === 0 ? (
                <span className="text-muted-foreground">লোড হচ্ছে...</span>
              ) : (
                <>
                  <span className="text-emerald-600 font-semibold">{totalActive} Active</span> &bull; {members.length - totalActive} Inactive
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Portal Login Accounts */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Web Portal Logins
            </span>
            <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 flex items-center justify-between">
              <span>{isLoading && members.length === 0 ? "..." : `${totalWithLogin} / ${members.length}`}</span>
              <KeyRound className="h-5 w-5 text-amber-500/80" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isLoading && members.length === 0 ? (
                <span className="text-muted-foreground">লোড হচ্ছে...</span>
              ) : members.length - totalWithLogin > 0 ? (
                <span className="text-amber-600 font-semibold">
                  {members.length - totalWithLogin} needs login setup
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">All accounts configured</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Report Emails */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Statement Recipients
            </span>
            <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 flex items-center justify-between">
              <span>{isLoading && members.length === 0 ? "..." : `${totalWithEmail} Members`}</span>
              <Mail className="h-5 w-5 text-blue-500/80" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Configured for automated & on-demand reports
            </p>
          </CardContent>
        </Card>

        {/* Total Mess Net Balance */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Mess Balance
            </span>
            <div className={`text-xl sm:text-2xl font-bold mt-1 ${totalBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {isLoading && members.length === 0 ? "..." : formatBDT(totalBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {totalBalance >= 0 ? "Net Surplus in Fund" : "Net Deficit in Fund"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. FILTER & SEARCH CONTROLS */}
      <Card className="border-border/80 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm"
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

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({totalActive})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("has_login")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === "has_login"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Login Active ({totalWithLogin})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("needs_login")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === "needs_login"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                Needs Login ({members.length - totalWithLogin})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("due")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === "due"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
                }`}
              >
                Due / বকেয়া
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. MAIN MEMBERS TABLE (DESKTOP) */}
      <Card className="border-border/80 shadow-2xs overflow-hidden hidden md:block">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>Member Roster & Portal Credentials ({filteredMembers.length})</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Click on 🔑 <strong>Login Info</strong> to view username & password, or ✉️ <strong>Mail</strong> to send statements.
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && members.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>সদস্য তথ্য লোড হচ্ছে...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {members.length === 0 ? "No members found. Click '+ Add Member' to create one." : "No members match your search criteria."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-semibold uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-3">Portal Login (ইউজারনেম ও পাসওয়ার্ড)</th>
                    <th className="py-3 px-3">Report Email</th>
                    <th className="py-3 px-3 text-center">Meals</th>
                    <th className="py-3 px-3 text-right">Expense</th>
                    <th className="py-3 px-3 text-right">Deposited</th>
                    <th className="py-3 px-4 text-right">Net Balance</th>
                    <th className="py-3 px-4 text-center">Actions</th>
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
                    const creds = credentialsMap[member.id];
                    const isAdvance = sum.balance >= 0;
                    const avatarColor = getAvatarColor(member.name);

                    return (
                      <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                        {/* Member Name & Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs border ${avatarColor} shrink-0`}>
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {member.name}
                              </span>
                              <Badge
                                variant={member.status === "active" ? "success" : "secondary"}
                                className="text-[10px] px-1.5 py-0 mt-0.5"
                              >
                                {member.status}
                              </Badge>
                            </div>
                          </div>
                        </td>

                        {/* Portal Login Credentials (Username & Password Access) */}
                        <td className="py-3.5 px-3">
                          {member.user_id || creds ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCredentials(member)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer group"
                              title="Click to view full username and password"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                              <span className="font-mono font-semibold">
                                {creds?.displayUsername || member.name.toLowerCase().replace(/\s+/g, "")}
                              </span>
                              <span className="text-[10px] bg-emerald-600/20 px-1 py-0.2 rounded text-emerald-700 dark:text-emerald-200">
                                View Pass
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCredentials(member)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                              title="Setup login credentials for this member"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                              <span>+ Setup Login</span>
                            </button>
                          )}
                        </td>

                        {/* Report Email */}
                        <td className="py-3.5 px-3">
                          {member.email ? (
                            <span className="font-mono text-xs text-muted-foreground block truncate max-w-[180px]" title={member.email}>
                              {member.email}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditMember(member);
                                setEditName(member.name);
                                setEditEmail("");
                                setEditInitialBalance(String(summaries[member.id]?.initial_balance ?? 0));
                              }}
                              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span>+ Add Email</span>
                            </button>
                          )}
                        </td>

                        {/* Meals Count */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-muted/60 text-xs font-mono font-bold text-foreground">
                            {sum.total_meals}
                          </span>
                        </td>

                        {/* Meal Cost */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs text-muted-foreground">
                          {formatBDT(sum.total_meal_cost)}
                        </td>

                        {/* Deposited */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatBDT(sum.total_deposited)}
                          {sum.initial_balance !== undefined && sum.initial_balance !== 0 && (
                            <span
                              className={`block text-[10px] font-normal ${
                                sum.initial_balance >= 0 ? "text-emerald-600" : "text-rose-500"
                              }`}
                              title="Initial / Previous Balance carried forward"
                            >
                              Init: {formatBDT(sum.initial_balance)}
                            </span>
                          )}
                        </td>

                        {/* Net Balance */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                              isAdvance
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            }`}
                          >
                            {formatBDT(sum.balance)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Send Statement Email */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenStatementModal(member)}
                              className="h-8 w-8 text-blue-600 hover:bg-blue-500/10 transition-colors border-border/80"
                              title="Send Statement Email (Full or Monthly)"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>

                            {/* View History */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleViewDetail(member.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors border-border/80"
                              title="View Ledger & History"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Edit Name, Email & Initial Balance */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditMember(member);
                                setEditName(member.name);
                                setEditEmail(member.email || "");
                                setEditInitialBalance(String(summaries[member.id]?.initial_balance ?? 0));
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors border-border/80"
                              title="Edit Member"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Status Toggle */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleToggleStatus(member)}
                              className={`h-8 w-8 transition-colors border-border/80 ${
                                member.status === "active"
                                  ? "text-emerald-600 hover:bg-emerald-500/10"
                                  : "text-amber-600 hover:bg-amber-500/10"
                              }`}
                              title={member.status === "active" ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete */}
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
          )}
        </CardContent>
      </Card>

      {/* 5. MOBILE VIEW MEMBER CARDS */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {isLoading && members.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-card rounded-xl border border-border/80">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>সদস্য তথ্য লোড হচ্ছে...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border/80 p-4">
            {members.length === 0 ? "No members found. Click '+ Add Member' to create one." : "No members match your search criteria."}
          </div>
        ) : (
          filteredMembers.map((member) => {
            const sum = summaries[member.id] || {
              total_meals: 0,
              total_meal_cost: 0,
              total_deposited: 0,
              balance: 0,
            };
            const creds = credentialsMap[member.id];
            const isAdvance = sum.balance >= 0;
            const avatarColor = getAvatarColor(member.name);

            return (
            <Card key={member.id} className="border-border/80 shadow-2xs">
              <CardContent className="p-4 space-y-3">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs border ${avatarColor}`}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{member.name}</h4>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {member.email || "No email set"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      isAdvance
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }`}
                  >
                    {formatBDT(sum.balance)}
                  </span>
                </div>

                {/* Login Credentials Pill */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <KeyRound className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Login:</span>
                    <span className="font-mono font-semibold text-foreground truncate">
                      {creds?.displayUsername || (member.user_id ? "Active" : "Not Set")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCredentials(member)}
                    className="text-primary font-semibold hover:underline shrink-0 text-[11px]"
                  >
                    {member.user_id || creds ? "View Pass / Reset" : "+ Setup Login"}
                  </button>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/30 text-xs text-center font-mono">
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
                    <span className="font-semibold text-emerald-600">{formatBDT(sum.total_deposited)}</span>
                    {sum.initial_balance !== undefined && sum.initial_balance !== 0 && (
                      <span className={`block text-[9px] ${sum.initial_balance >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        Init: {formatBDT(sum.initial_balance)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenStatementModal(member)}
                    className="flex-1 text-xs gap-1 text-blue-600"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Send Mail</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(member.id)}
                    className="flex-1 text-xs gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>History</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditMember(member);
                      setEditName(member.name);
                      setEditEmail(member.email || "");
                      setEditInitialBalance(String(summaries[member.id]?.initial_balance ?? 0));
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
      </div>

      {/* =========================================================================
          MODAL 1: VIEW & MANAGE LOGIN CREDENTIALS (ইউজারনেম ও পাসওয়ার্ড দেখুন)
         ========================================================================= */}
      {credsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-border max-h-[92vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    Web Portal Login Credentials
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Member: <strong>{credsMember.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredsMember(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* CURRENT ACTIVE CREDENTIALS DISPLAY BOX */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Member Login Details</span>
                  </span>
                  <Badge variant="success" className="text-[10px]">
                    Active Account
                  </Badge>
                </div>

                {/* Username with Copy */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    Login Username (ইউজারনেম):
                  </Label>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-sm font-mono font-bold text-foreground">
                    <span>{credsUsername}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(credsUsername, "username")}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      title="Copy Username"
                    >
                      {copiedItem === "username" ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password with Eye and Copy */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    Login Password (পাসওয়ার্ড):
                  </Label>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-sm font-mono font-bold text-foreground">
                    <span>{showPassword ? credsPassword : "••••••••••••"}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(credsPassword, "password")}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Copy Password"
                      >
                        {copiedItem === "password" ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ONE-CLICK WHATSAPP SHARE CARD */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const shareText = `📋 আসসালামু আলাইকুম ${credsMember.name},\nমেস ম্যানেজমেন্ট সিস্টেমে আপনার লগইন তথ্য:\n👤 ইউজারনেম: ${credsUsername}\n🔑 পাসওয়ার্ড: ${credsPassword}\n🔗 লগইন লিংক: ${window.location.origin}/login`;
                      handleCopyText(shareText, "whatsapp");
                    }}
                    className="w-full text-xs gap-1.5 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  >
                    {copiedItem === "whatsapp" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span>Copy Login Message for Member (WhatsApp / SMS)</span>
                  </Button>
                </div>
              </div>

              {/* CHANGE / RESET PASSWORD SECTION */}
              <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2 border-t border-border/80">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Update Username or Set New Password</span>
                </h4>

                <div className="space-y-1">
                  <Label htmlFor="edit-username" className="text-[11px] text-muted-foreground">
                    Username or Email
                  </Label>
                  <Input
                    id="edit-username"
                    value={credsUsername}
                    onChange={(e) => setCredsUsername(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-password" className="text-[11px] text-muted-foreground">
                      New Password (পাসওয়ার্ড)
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        const random = "Pass" + Math.floor(100000 + Math.random() * 900000) + "!";
                        setCredsPassword(random);
                        setShowPassword(true);
                      }}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      🎲 Generate Random
                    </button>
                  </div>
                  <Input
                    id="edit-password"
                    type={showPassword ? "text" : "password"}
                    value={credsPassword}
                    onChange={(e) => setCredsPassword(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-role" className="text-[11px] text-muted-foreground">
                    Assigned Portal Role
                  </Label>
                  <select
                    id="edit-role"
                    value={credsRole}
                    onChange={(e) => setCredsRole(e.target.value as UserRole)}
                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="member">MEMBER (Member read-only portal)</option>
                    <option value="admin">ADMIN (Full administrative access)</option>
                    <option value="group_ledger_viewer">GROUP_LEDGER_VIEWER (Confidential Aggregate only)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCredsMember(null)}
                    className="h-8 text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingCreds}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Credentials</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: SEND STATEMENT EMAIL (সম্পূর্ণ হিসাব বা যেকোনো মাসের হিসাব)
         ========================================================================= */}
      {stmtMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl border-border max-h-[92vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    Send Meal & Balance Statement
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Recipient: <strong>{stmtMember.name}</strong> ({stmtMember.email || "No email set"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStmtMember(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {!stmtMember.email && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    This member has no email address configured. Please edit the member and set their email first.
                  </span>
                </div>
              )}

              <form onSubmit={handleSendStatement} className="space-y-4">
                {/* STATEMENT TYPE SELECTOR */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Select Statement Scope (হিসাবের পরিধি নির্বাচন করুন):
                  </Label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Option 1: Full / All-Time */}
                    <button
                      type="button"
                      onClick={() => setStmtType("all")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        stmtType === "all"
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>সার্বিক সম্পূর্ণ হিসাব</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        আজীবনের সব মিল, জমা ও বর্তমান ব্যালেন্স
                      </p>
                    </button>

                    {/* Option 2: Specific Month */}
                    <button
                      type="button"
                      onClick={() => setStmtType("month")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        stmtType === "month"
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>যেকোনো মাসের হিসাব</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        নির্দিষ্ট মাসের সম্পূর্ণ মিল ও খতিয়ান
                      </p>
                    </button>

                    {/* Option 3: Weekly */}
                    <button
                      type="button"
                      onClick={() => setStmtType("week")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        stmtType === "week"
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-bold text-foreground">সাপ্তাহিক হিসাব</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        চলতি সপ্তাহের ৭ দিনের খতিয়ান
                      </p>
                    </button>

                    {/* Option 4: Custom Dates */}
                    <button
                      type="button"
                      onClick={() => setStmtType("custom")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        stmtType === "custom"
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-bold text-foreground">কাস্টম তারিখ</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        পছন্দমতো যেকোনো তারিখ থেকে তারিখ
                      </p>
                    </button>
                  </div>
                </div>

                {/* MONTH DROPDOWN (Shown when stmtType === "month") */}
                {stmtType === "month" && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2 animate-in fade-in">
                    <Label htmlFor="month-select" className="text-xs font-semibold">
                      Select Month (মাস নির্বাচন করুন):
                    </Label>
                    <select
                      id="month-select"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                    >
                      {monthsList.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* CUSTOM DATE INPUTS (Shown when stmtType === "custom") */}
                {stmtType === "custom" && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border animate-in fade-in">
                    <div className="space-y-1">
                      <Label htmlFor="c-start" className="text-[11px] text-muted-foreground">From Date</Label>
                      <Input
                        id="c-start"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="c-end" className="text-[11px] text-muted-foreground">To Date</Label>
                      <Input
                        id="c-end"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* ALL-TIME NOTICE */}
                {stmtType === "all" && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    ✨ <strong>সার্বিক সম্পূর্ণ হিসাব:</strong> এই সদস্য মেসে যোগদানের প্রথম দিন থেকে আজ পর্যন্ত যত মিল খেয়েছেন, যত টাকা জমা দিয়েছেন, এবং বর্তমান সর্বমোট ব্যালেন্সের পূর্ণাঙ্গ খতিয়ান ইমেইলে চলে যাবে।
                  </div>
                )}

                {/* DISPATCH ACTION BUTTONS */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStmtMember(null)}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!stmtMember.email || isSendingStatement}
                    isLoading={isSendingStatement}
                    className="h-9 text-xs gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Statement via Gmail</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: ADD MEMBER
         ========================================================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <span>Add New Member</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="m-name" className="text-xs font-semibold">Member Name (সদস্যের নাম)</Label>
                  <Input
                    id="m-name"
                    placeholder="e.g. Tanvir Hasan"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      if (!newMemberUsername) {
                        setNewMemberUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                      }
                    }}
                    required
                    autoFocus
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-email" className="text-xs font-semibold">Report Email Address (Optional)</Label>
                  <Input
                    id="m-email"
                    type="email"
                    placeholder="member@gmail.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="m-init" className="text-xs font-semibold">
                      Initial / Previous Balance (পূর্বের ব্যালেন্স) (৳)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">বকেয়া হলে মাইনাস (যেমন: -390), জমা থাকলে প্লাস (যেমন: 260)</span>
                  </div>
                  <Input
                    id="m-init"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={newMemberInitialBalance}
                    onChange={(e) => setNewMemberInitialBalance(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {/* Instant Login Credentials Checkbox */}
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={createAccountWithMember}
                      onChange={(e) => setCreateAccountWithMember(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    <span>Create web portal login account immediately</span>
                  </label>

                  {createAccountWithMember && (
                    <div className="space-y-2.5 pt-1 animate-in fade-in">
                      <div className="space-y-1">
                        <Label htmlFor="m-user" className="text-[11px] text-muted-foreground">
                          Login Username:
                        </Label>
                        <Input
                          id="m-user"
                          value={newMemberUsername}
                          onChange={(e) => setNewMemberUsername(e.target.value)}
                          placeholder="e.g. tanvir"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="m-pass" className="text-[11px] text-muted-foreground">
                          Password:
                        </Label>
                        <Input
                          id="m-pass"
                          value={newMemberPassword}
                          onChange={(e) => setNewMemberPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="h-8 text-xs font-mono"
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
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isAdding}
                    className="h-9 text-xs"
                  >
                    Add Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: EDIT MEMBER
         ========================================================================= */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base font-bold">Edit Member</CardTitle>
              <button
                type="button"
                onClick={() => setEditMember(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleEditMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="e-name" className="text-xs font-semibold">Member Name</Label>
                  <Input
                    id="e-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-email" className="text-xs font-semibold">Report Email Address</Label>
                  <Input
                    id="e-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="e-init" className="text-xs font-semibold">
                      Initial / Previous Balance (পূর্বের ব্যালেন্স) (৳)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">বকেয়া হলে মাইনাস (যেমন: -390), জমা থাকলে প্লাস (যেমন: 260)</span>
                  </div>
                  <Input
                    id="e-init"
                    type="number"
                    step="0.01"
                    value={editInitialBalance}
                    onChange={(e) => setEditInitialBalance(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMember(null)}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isEditing}
                    className="h-9 text-xs"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: DELETE MEMBER
         ========================================================================= */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-destructive/40">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Delete Member Permanently</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-foreground">
                Are you sure you want to permanently delete <strong>{memberToDelete.name}</strong>?
                All meals, attendance records, and deposits associated with this member will be permanently removed.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberToDelete(null)}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteMember}
                  isLoading={isDeleting}
                  className="h-9 text-xs"
                >
                  Confirm Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: MEMBER LEDGER & MEAL HISTORY DETAILS
         ========================================================================= */}
      <MemberDetailsModal
        isOpen={Boolean(detailMemberId)}
        onClose={() => setDetailMemberId(null)}
        data={detailData}
        isLoading={isLoadingDetail}
      />
    </div>
  );
}

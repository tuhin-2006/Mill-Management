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
import { formatBDT } from "@/lib/date";
import { Member, MemberSummary } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MigrationAlert } from "@/components/shared/migration-alert";
import { MemberDetailsModal } from "@/components/members/member-details-modal";
import { toast } from "sonner";

export default function MembersPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [summaries, setSummaries] = React.useState<Record<string, MemberSummary>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTableMissing, setIsTableMissing] = React.useState(false);

  // Modal states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newMemberName, setNewMemberName] = React.useState("");

  const [editMember, setEditMember] = React.useState<Member | null>(null);
  const [editName, setEditName] = React.useState("");

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
    async function init() {
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
    }

    init();
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
      const supabase = createClient();
      await addMember(supabase, newMemberName);
      toast.success(`Member "${newMemberName}" added successfully.`);
      setNewMemberName("");
      setIsAddOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("schema cache") || msg.includes("PGRST205") || msg.includes("does not exist")) {
        setIsTableMissing(true);
        toast.error("সুপাবেস ডেটাবেসে টেবিল নেই! অনুগ্রহ করে SQL Migration রান করুন।");
      } else {
        toast.error("Error adding member: " + msg);
      }
    }
  };

  // Edit Member Name
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember || !editName.trim()) return;

    try {
      const supabase = createClient();
      await updateMember(supabase, editMember.id, { name: editName });
      toast.success(`Member updated to "${editName}".`);
      setEditMember(null);
      loadData();
    } catch (err: unknown) {
      toast.error("Error updating member: " + (err instanceof Error ? err.message : ""));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members Management"
        description="Manage group mess members, profile statuses, and financial balances."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </Button>
        }
      />

      <MigrationAlert isTableMissing={isTableMissing} />

      {/* Members List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Group Roster ({members.length} Total)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No members configured yet. Click &quot;Add Member&quot; above to create your group roster.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Total Meals</th>
                    <th className="py-3 px-4 text-right">Meal Cost</th>
                    <th className="py-3 px-4 text-right">Total Deposited</th>
                    <th className="py-3 px-4 text-right">Current Balance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => {
                    const sum = summaries[member.id] || {
                      total_meals: 0,
                      total_meal_cost: 0,
                      total_deposited: 0,
                      balance: 0,
                    };
                    const isPositive = sum.balance >= 0;

                    return (
                      <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {member.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={member.status === "active" ? "success" : "secondary"}>
                            {member.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium">
                          {sum.total_meals}
                        </td>
                        <td className="py-3.5 px-4 text-right text-muted-foreground">
                          {formatBDT(sum.total_meal_cost)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatBDT(sum.total_deposited)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-bold ${
                            isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {formatBDT(sum.balance)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetail(member.id)}
                              className="h-8 px-2.5 text-xs gap-1.5 font-medium hover:bg-primary/10 hover:text-primary transition-colors border-border/80"
                              title="View Member Details"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              <span>View Details</span>
                            </Button>

                            {/* Edit Name Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditMember(member);
                                setEditName(member.name);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Member Name"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Activate / Deactivate Toggle */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(member)}
                              className={`h-8 w-8 ${
                                member.status === "active"
                                  ? "text-amber-600 hover:text-amber-700"
                                  : "text-emerald-600 hover:text-emerald-700"
                              }`}
                              title={
                                member.status === "active"
                                  ? "Deactivate Member"
                                  : "Activate Member"
                              }
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete Member Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMemberToDelete(member)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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

      {/* Add Member Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Add New Member</CardTitle>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-member-name">Member Full Name</Label>
                  <Input
                    id="new-member-name"
                    placeholder="e.g. Tuhin"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Add Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Edit Member Name</CardTitle>
              <button
                type="button"
                onClick={() => setEditMember(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditMember} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-member-name">Full Name</Label>
                  <Input
                    id="edit-member-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMember(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="w-full max-w-md shadow-2xl border-destructive/30">
            <CardHeader className="flex flex-row items-start gap-3 pb-3 border-b border-border/80">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base text-foreground">
                  Delete Member: {memberToDelete.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  সদস্য ডিলিট নিশ্চিতকরণ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-foreground leading-relaxed">
                আপনি কি নিশ্চিত যে আপনি <strong>&quot;{memberToDelete.name}&quot;</strong>-কে মেম্বার তালিকা থেকে মুছে ফেলতে চান?
              </p>
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive leading-relaxed space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  স্থায়ী সতর্কবার্তা:
                </p>
                <p>
                  এই সদস্যের সাথে সম্পর্কিত সমস্ত খাবার খরচ (Meal Records) এবং জমার লেনদেন (Deposits) স্থায়ীভাবে মুছে ফেলা হবে।
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel (বাতিল)
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteMember}
                  isLoading={isDeleting}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Yes, Delete Member</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member Individual Detail Modal */}
      <MemberDetailsModal
        isOpen={Boolean(detailMemberId)}
        onClose={() => setDetailMemberId(null)}
        data={detailData}
        isLoading={isLoadingDetail}
      />
    </div>
  );
}

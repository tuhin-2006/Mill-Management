import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services";
import { computeGroupAggregateReport } from "@/lib/aggregate-server";

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();
    const callerProfile = await getCurrentUserProfile(supabase);

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "group_ledger_viewer")) {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to Admin and Group Ledger Viewer." },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const report = await computeGroupAggregateReport(startDate, endDate);
    return NextResponse.json(report);
  } catch (err: unknown) {
    console.error("Error computing group aggregate report:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

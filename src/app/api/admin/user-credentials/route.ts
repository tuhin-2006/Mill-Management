import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentUserProfile } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();
    const callerProfile = await getCurrentUserProfile(supabase);

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can view user credentials." },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    // Fetch auth users, profiles, and members in parallel
    const [
      { data: userList, error: listErr },
      { data: profiles, error: profErr },
      { data: members, error: memErr },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("members").select("*"),
    ]);

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const users = userList?.users || [];
    const profs = profiles || [];
    const mems = members || [];

    const credentialsMap: Record<
      string,
      {
        userId: string;
        email: string;
        displayUsername: string;
        displayPassword: string | null;
        role: string;
        createdAt: string;
        lastSignInAt: string | null;
      }
    > = {};

    for (const m of mems) {
      // Find matching user either via m.user_id or via profile.member_id
      const linkedProf = profs.find((p) => p.member_id === m.id);
      const user = users.find((u) => (m.user_id && u.id === m.user_id) || (linkedProf && u.id === linkedProf.id));

      if (user) {
        const rawEmail = user.email || linkedProf?.email || "";
        const cleanName = m.name.toLowerCase().replace(/\s+/g, "");
        const displayUsername =
          user.user_metadata?.display_username ||
          (rawEmail.endsWith("@mill.local") ? rawEmail.replace("@mill.local", "") : rawEmail) ||
          cleanName;

        const displayPassword = user.user_metadata?.display_password || null;

        credentialsMap[m.id] = {
          userId: user.id,
          email: rawEmail,
          displayUsername,
          displayPassword,
          role: linkedProf?.role || "member",
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at || null,
        };
      }
    }

    if (memberId) {
      return NextResponse.json({
        success: true,
        credentials: credentialsMap[memberId] || null,
      });
    }

    return NextResponse.json({
      success: true,
      credentials: credentialsMap,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentUserProfile } from "@/lib/services";
import { UserRole } from "@/types";

export async function POST(req: Request) {
  try {
    // 1. Verify caller is authenticated Admin
    const supabase = await createServerClient();
    const callerProfile = await getCurrentUserProfile(supabase);

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can provision user accounts." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, role, memberId, targetUserId, syncReportEmail } = body as {
      email?: string;
      password?: string;
      role?: UserRole;
      memberId?: string;
      targetUserId?: string;
      syncReportEmail?: boolean;
    };

    if (!targetUserId && (!email || !email.trim())) {
      return NextResponse.json({ error: "Email or username is required." }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    // Normalize identifier: if plain username without @, append @mill.local
    const rawInput = (email || "").trim();
    const normalizedEmail = rawInput.includes("@")
      ? rawInput
      : `${rawInput.toLowerCase()}@mill.local`;

    const assignedRole: UserRole = role || "member";

    // 2. Initialize Supabase Admin client with service role key
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

    let authUser: { id: string; email?: string } | null = null;

    // A. If targetUserId is explicitly provided, update existing user
    if (targetUserId) {
      const updatePayload: { password?: string; email?: string; email_confirm?: boolean } = {};
      if (password && password.length >= 6) {
        updatePayload.password = password;
      }
      if (normalizedEmail) {
        updatePayload.email = normalizedEmail;
        updatePayload.email_confirm = true;
      }

      const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        updatePayload
      );

      if (updateErr || !updateData.user) {
        return NextResponse.json({ error: `Failed to update user: ${updateErr?.message}` }, { status: 500 });
      }

      authUser = updateData.user;
    } else {
      // B. Check if user already exists by email
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      authUser = userList?.users.find((u) => u.email?.toLowerCase() === normalizedEmail.toLowerCase()) || null;

      if (!authUser) {
        // Create new user with email pre-confirmed
        const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: password || "Password123!",
          email_confirm: true,
        });

        if (createErr || !createData.user) {
          return NextResponse.json({ error: `Failed to create user: ${createErr?.message}` }, { status: 500 });
        }
        authUser = createData.user;
      } else if (password) {
        // Update password if existing user
        const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          { password }
        );
        if (updateErr) {
          return NextResponse.json({ error: `Failed to update credentials: ${updateErr.message}` }, { status: 500 });
        }
        authUser = updateData.user;
      }
    }

    // 4. Update or Insert profile with role & member_id
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
      id: authUser.id,
      email: authUser.email,
      role: assignedRole,
      member_id: memberId || null,
    });

    if (profileErr) {
      return NextResponse.json({ error: `Failed to update profile: ${profileErr.message}` }, { status: 500 });
    }

    // 5. If memberId provided, link user_id in members table (preserve existing report email unless explicitly synced)
    if (memberId) {
      const memberUpdate: { user_id: string; email?: string } = {
        user_id: authUser.id,
      };

      if (syncReportEmail && normalizedEmail && !normalizedEmail.endsWith("@mill.local")) {
        memberUpdate.email = normalizedEmail;
      }

      await supabaseAdmin.from("members").update(memberUpdate).eq("id", memberId);
    }

    return NextResponse.json({
      success: true,
      message: `Account for ${authUser.email || email} successfully provisioned as ${assignedRole}.`,
      user: {
        id: authUser.id,
        email: authUser.email,
        role: assignedRole,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

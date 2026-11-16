import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentUserProfile, invalidateCache } from "@/lib/services";
import { invalidateCredentialsCache } from "@/app/api/admin/user-credentials/route";
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
    const cleanUsername = rawInput.replace(/@mill\.local$/i, "");
    const normalizedEmail = rawInput.includes("@")
      ? rawInput
      : `${cleanUsername.toLowerCase()}@mill.local`;

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

    let authUser: { id: string; email?: string; user_metadata?: Record<string, any> } | null = null;
    const finalPassword = password || "Password123!";

    // A. If targetUserId is explicitly provided, update existing user
    if (targetUserId) {
      const updatePayload: {
        password?: string;
        email?: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, any>;
      } = {
        user_metadata: {
          display_username: cleanUsername,
          display_password: finalPassword,
          updated_at: new Date().toISOString(),
        },
      };

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
          password: finalPassword,
          email_confirm: true,
          user_metadata: {
            display_username: cleanUsername,
            display_password: finalPassword,
            created_at: new Date().toISOString(),
          },
        });

        if (createErr || !createData.user) {
          return NextResponse.json({ error: `Failed to create user: ${createErr?.message}` }, { status: 500 });
        }
        authUser = createData.user;
      } else {
        // Update credentials & metadata if existing user
        const updatePayload: Record<string, any> = {
          user_metadata: {
            ...authUser.user_metadata,
            display_username: cleanUsername,
            display_password: finalPassword,
            updated_at: new Date().toISOString(),
          },
        };

        if (password) {
          updatePayload.password = password;
        }

        const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          updatePayload
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

    // Invalidate caches so updated member accounts reflect instantly
    invalidateCredentialsCache();
    invalidateCache("members");
    invalidateCache("user_profile_");

    return NextResponse.json({
      success: true,
      message: `Account for ${cleanUsername} successfully provisioned as ${assignedRole}.`,
      user: {
        id: authUser.id,
        email: authUser.email,
        displayUsername: cleanUsername,
        displayPassword: finalPassword,
        role: assignedRole,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

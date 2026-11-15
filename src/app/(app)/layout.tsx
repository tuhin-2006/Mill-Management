import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  } catch (err: unknown) {
    // If it is the Next.js redirect throw, rethrow it so Next.js redirects
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    // If Supabase environment variables are missing during initial setup, allow access to view setup status
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Missing Supabase environment variables")) {
      return <AppShell>{children}</AppShell>;
    }

    // Otherwise redirect to login for security
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}

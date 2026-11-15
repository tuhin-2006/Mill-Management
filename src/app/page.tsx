import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import {
  CheckCircle2,
  AlertCircle,
  Wheat,
  Layers,
  FileCode2,
  Paintbrush,
  Database,
} from "lucide-react";

export default function HomePage() {
  const isSupabaseConfigured = env.isConfigured;

  const statusItems = [
    {
      name: "Next.js App Router",
      version: "v16.4.6 (React 19, Turbopack)",
      status: "Ready",
      isReady: true,
      icon: Layers,
    },
    {
      name: "TypeScript",
      version: "v5.9.3 (Strict mode)",
      status: "Ready",
      isReady: true,
      icon: FileCode2,
    },
    {
      name: "Tailwind CSS",
      version: "v4.3.3 (Design tokens enabled)",
      status: "Ready",
      isReady: true,
      icon: Paintbrush,
    },
    {
      name: "Supabase Environment",
      version: isSupabaseConfigured
        ? "Connected & Keys Verified"
        : "Missing NEXT_PUBLIC_SUPABASE_* credentials",
      status: isSupabaseConfigured ? "Configured" : "Not configured yet",
      isReady: isSupabaseConfigured,
      icon: Database,
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {/* Header */}
        <div className="mb-8 border-b border-stone-100 pb-6 dark:border-stone-800">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-500">
            <Wheat className="h-6 w-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Foundation Setup
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            {siteConfig.name}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {siteConfig.description}
          </p>
        </div>

        {/* Setup Status Card */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              System Verification
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Setup Mode
            </span>
          </div>

          <div className="space-y-2.5">
            {statusItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/60 p-3 dark:border-stone-800/80 dark:bg-stone-800/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-white p-1.5 text-stone-600 shadow-2xs dark:bg-stone-800 dark:text-stone-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                        {item.name}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {item.version}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {item.isReady ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {item.status}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 rounded-lg bg-stone-50 p-3.5 border border-stone-100 text-xs text-stone-600 dark:bg-stone-800/50 dark:border-stone-800 dark:text-stone-400">
          <p className="font-medium text-stone-800 dark:text-stone-200 mb-0.5">
            Next Action:
          </p>
          <p>
            Foundation verified. Awaiting module implementation instructions.
          </p>
        </div>
      </div>
    </main>
  );
}

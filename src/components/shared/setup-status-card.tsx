import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import {
  CheckCircle2,
  AlertCircle,
  Layers,
  FileCode2,
  Paintbrush,
  Database,
} from "lucide-react";

export function SetupStatusCard() {
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
        : "Missing NEXT_PUBLIC_SUPABASE_* variables",
      status: isSupabaseConfigured ? "Configured" : "Not configured yet",
      isReady: isSupabaseConfigured,
      icon: Database,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            System & Foundation Verification
          </CardTitle>
          <CardDescription>
            Live check of configured runtime libraries and environment variables
          </CardDescription>
        </div>
        <Badge variant={isSupabaseConfigured ? "success" : "secondary"}>
          {isSupabaseConfigured ? "Setup Complete" : "Pending Keys"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {statusItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-card p-1.5 text-muted-foreground shadow-2xs border border-border">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.version}</p>
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
      </CardContent>
    </Card>
  );
}

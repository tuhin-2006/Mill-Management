"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wheat, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/config/site";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error("Authentication failed: " + error.message);
        return;
      }

      if (data.session) {
        toast.success("Welcome back, Administrator!");
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
            <Wheat className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Private Administrator Authentication
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Sign In</CardTitle>
            <CardDescription>
              Enter your administrator credentials to access financial records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Admin Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@mill.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-9"
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-9"
                  />
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Sign In to System
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Privacy Note */}
        <p className="text-center text-[11px] text-muted-foreground mt-4 leading-relaxed">
          Authorized personnel only. All access and changes are securely logged.
        </p>
      </div>
    </div>
  );
}

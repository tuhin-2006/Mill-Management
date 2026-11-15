import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        404 — Page Not Found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you requested could not be found or has been moved.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

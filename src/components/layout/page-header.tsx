import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 pb-4 sm:pb-6 md:flex-row md:items-center md:justify-between border-b border-border min-w-0",
        className
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

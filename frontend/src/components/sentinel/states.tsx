import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  delay,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn("panel rise overflow-hidden", className)}
      style={delay ? ({ "--rise-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            {title && (
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded bg-elevated"
          style={{ animationDelay: `${i * 90}ms`, opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

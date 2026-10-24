import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export function PageTop({ title, subtitle, mobileSubtitle, children }: { title: string; subtitle?: string; mobileSubtitle?: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="hidden sm:block">
        <PageHeader title={title} subtitle={subtitle}>
          {children}
        </PageHeader>
      </div>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {mobileSubtitle ?? subtitle ? <p className="text-xs text-muted-foreground">{mobileSubtitle ?? subtitle}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </>
  );
}

export const GROUP = "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card";

export function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {count !== undefined ? <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

export function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{children}</div>;
}

export function DetailsPanel({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={danger ? "text-sm font-semibold text-destructive" : "text-sm font-semibold"}>{title}</span>
          {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted-foreground ui-transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

import { Input } from "@/components/ui/input";
import { PERIOD_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LoadingScreen({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function PageMain({ children }: { children: React.ReactNode }) {
  return <main className="animate-in fade-in duration-300 p-6 lg:p-8">{children}</main>;
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </>
  );
}

export function FormError({
  message,
  className,
}: {
  message: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p className={cn("text-sm text-destructive", className ?? "mt-4")} role="alert">
      {message}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = PERIOD_STATUS_LABEL[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        status === "draft" && "border-dashed text-muted-foreground",
        status === "submitted" && "border-foreground",
        status === "approved" && "border-foreground bg-foreground text-background",
        status === "rejected" && "border-2 border-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NativeSelect({ className, ref, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-full border border-border bg-white px-3 text-sm transition-colors duration-150 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export type TableColumn = string | { label: string; align?: "left" | "right" };

export function DataTable({
  title,
  description,
  search,
  extra,
  columns,
  loading,
  empty,
  isEmpty,
  children,
}: {
  title?: string;
  description?: string;
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  extra?: React.ReactNode;
  columns: TableColumn[];
  loading?: boolean;
  empty: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="surface overflow-x-auto">
      {title || search || description || extra ? (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            {title ? <p className="text-base font-semibold tracking-tight">{title}</p> : null}
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {search || extra ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {search ? (
                <Input
                  className="max-w-56 rounded-full"
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(event) => search.onChange(event.target.value)}
                />
              ) : null}
              {extra}
            </div>
          ) : null}
        </div>
      ) : null}
      <table className="w-full text-sm">
        <thead className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => {
              const label = typeof column === "string" ? column : column.label;
              const align = typeof column === "string" ? "left" : (column.align ?? "left");
              return (
                <th
                  key={label}
                  className={align === "right" ? "px-5 py-3 text-right" : "px-5 py-3"}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading || isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center text-muted-foreground">
                {loading ? "Memuat…" : empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

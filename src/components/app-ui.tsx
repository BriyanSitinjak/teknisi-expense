import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function LoadingScreen({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function PageMain({ children }: { children: React.ReactNode }) {
  return <main className="p-6">{children}</main>;
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
      <h1 className="text-xl font-semibold">{title}</h1>
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

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn("h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm", className)}
      {...props}
    />
  );
}

export type TableColumn = string | { label: string; align?: "left" | "right" };

export function DataTable({
  title,
  search,
  columns,
  loading,
  empty,
  isEmpty,
  children,
}: {
  title?: string;
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  columns: TableColumn[];
  loading?: boolean;
  empty: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      {title || search ? (
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          {search ? (
            <Input
              className="max-w-56"
              placeholder={search.placeholder}
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
            />
          ) : null}
        </div>
      ) : null}
      <table className="w-full text-sm">
        <thead className="border-b bg-zinc-50 text-left">
          <tr>
            {columns.map((column) => {
              const label = typeof column === "string" ? column : column.label;
              const align = typeof column === "string" ? "left" : (column.align ?? "left");
              return (
                <th
                  key={label}
                  className={align === "right" ? "px-3 py-2 text-right font-medium" : "px-3 py-2 font-medium"}
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
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
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

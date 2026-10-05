export function FormStep({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-2">
      <div>
        <p className="text-sm font-medium">
          {step}. {title}
        </p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </li>
  );
}

export function MasterForm({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-2xl rounded-xl border border-border bg-white p-5">
      <h2 className="font-medium">{title}</h2>
      {children}
    </form>
  );
}

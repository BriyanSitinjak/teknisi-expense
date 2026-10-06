export function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold tracking-tight">
          <span className="mr-2 text-muted-foreground">{step}.</span>
          {title}
        </p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

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
  description,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="surface p-5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      {children}
    </form>
  );
}

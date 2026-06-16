type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-8 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        Secritou Platform
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

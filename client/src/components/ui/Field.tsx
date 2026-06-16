import type { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Field({
  label, hint, error, required, ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...rest}
        id={rest.id || rest.name}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${rest.name}-error` : (hint ? `${rest.name}-hint` : undefined)}
        className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {hint && !error && <span id={`${rest.name}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span id={`${rest.name}-error`} className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function TextField({
  label, hint, error, required, ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        {...rest}
        id={rest.id || rest.name}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${rest.name}-error` : (hint ? `${rest.name}-hint` : undefined)}
        className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {hint && !error && <span id={`${rest.name}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span id={`${rest.name}-error`} className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function handleField<T>(setter: (v: Partial<T>) => void) {
  return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter({ [e.target.name]: e.target.value } as Partial<T>);
  };
}

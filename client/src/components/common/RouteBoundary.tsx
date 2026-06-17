import { Component, type ErrorInfo, type ReactNode, Suspense } from "react";
import { Link } from "react-router-dom";

type ErrorFallbackProps = {
  title?: string;
  subtitle?: string;
};

function DefaultErrorFallback({ title, subtitle }: ErrorFallbackProps) {
  return (
    <div className="container-page py-20 flex items-center justify-center min-h-[400px]">
      <div className="max-w-md text-center space-y-3">
        <h2 className="font-display text-2xl font-bold text-ink">{title ?? "Une erreur est survenue"}</h2>
        <p className="text-sm text-muted-foreground">
          {subtitle ?? "Cette section n’a pas pu s’afficher. Réessaie ou reviens plus tard."}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
          >
            Recharger
          </button>
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

class InnerErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route boundary error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback />;
    }
    return this.props.children;
  }
}

export function RouteBoundary({
  children,
  suspenseFallback,
  errorFallback,
}: {
  children: ReactNode;
  suspenseFallback: ReactNode;
  errorFallback?: ReactNode;
}) {
  return (
    <InnerErrorBoundary fallback={errorFallback}>
      <Suspense fallback={suspenseFallback}>{children}</Suspense>
    </InnerErrorBoundary>
  );
}


import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global error caught:", error, errorInfo);
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen-safe flex-col items-center justify-center bg-background px-6 py-20">
          <div className="w-full max-w-md text-center">
            <h1 className="font-display text-8xl font-bold text-primary">500</h1>
            <h2 className="mt-4 font-display text-3xl font-bold text-ink">
              Something went wrong
            </h2>
            <p className="mt-2 text-muted-foreground">
              We're sorry for the inconvenience. Our team has been notified.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="group inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Try again
              </button>
              <Link
                to="/"
                className="group inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface"
              >
                Return home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      duration={6000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // SEC-100: richColors (below) falls back to Sonner's own built-in palette when no
          // classNames.success/error/info is set — that default palette measured under WCAG
          // 1.4.3 (4.5:1) on all 3 types actually used in this project (grep-confirmed: 115
          // toast.* calls, 80 error / 33 success / 2 info, 0 warning/loading/promise). These
          // reuse the project's own existing -600/-700-on--50 convention (already used for
          // "info"/"positive" tones elsewhere, e.g. ProposalsPage.tsx/DashboardPage.tsx) rather
          // than inventing new colors — verified via Playwright+canvas real color computation:
          // red-700/red-50 = 5.91:1, emerald-700/emerald-50 = 5.21:1, blue-600/blue-50 = 4.75:1
          // (info was already conforming, listed here for a complete, self-documenting palette).
          // data-description inherits this color (color: inherit under richColors, confirmed in
          // node_modules/sonner/dist/styles.css), so no separate description override is needed.
          error: "!text-red-700 !bg-red-50 !border-red-200",
          success: "!text-emerald-700 !bg-emerald-50 !border-emerald-200",
          info: "!text-blue-600 !bg-blue-50 !border-blue-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

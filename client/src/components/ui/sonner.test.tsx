// SEC-100: Sonner's richColors falls back to the library's own default palette for
// success/error/info toasts unless toastOptions.classNames overrides them — that default palette
// measured under WCAG 1.4.3 (4.5:1) via axe-core on a real build (see e2e/sonner-palette-contrast.spec.ts
// for success/error, which have real UI triggers — login and failed login). toast.info's only 2 real
// call sites (ClientOnboardingPage.tsx/ClientBriefPage.tsx) depend on a specific in-progress
// questionnaire/brief step, too deep a business flow to set up in e2e for a contrast check alone.
// This renders the real <Toaster> and calls the real toast.info() (real `sonner` import, not a mock)
// to confirm the fix's classNames actually reach the rendered DOM and that data-description still
// inherits the title's styling class after the change.

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { toast } from "sonner";
import { Toaster } from "./sonner";

describe("Toaster richColors palette classNames (SEC-100)", () => {
  test("toast.info renders with the fixed info classNames on both title and description", async () => {
    render(<Toaster />);
    toast.info("Titre info de test", { description: "Description de test" });

    const title = await screen.findByText("Titre info de test");
    const description = await screen.findByText("Description de test");

    const toastEl = title.closest("[data-sonner-toast]");
    expect(toastEl).not.toBeNull();
    expect(toastEl?.className).toContain("text-blue-600");
    expect(toastEl?.className).toContain("bg-blue-50");

    // data-description has no color override of its own in sonner.tsx (only
    // group-[.toast]:text-muted-foreground for the non-rich-colors default) — it inherits the
    // toast container's color via Sonner's own CSS (color: inherit under data-rich-colors), so the
    // fix on the container's classNames alone is sufficient for the description too.
    expect(description.closest("[data-sonner-toast]")).toBe(toastEl);
  });

  test("toast.success renders with the fixed success classNames", async () => {
    render(<Toaster />);
    toast.success("Titre succès de test");

    const title = await screen.findByText("Titre succès de test");
    const toastEl = title.closest("[data-sonner-toast]");
    expect(toastEl?.className).toContain("text-emerald-700");
    expect(toastEl?.className).toContain("bg-emerald-50");
  });

  test("toast.error renders with the fixed error classNames", async () => {
    render(<Toaster />);
    toast.error("Titre erreur de test");

    const title = await screen.findByText("Titre erreur de test");
    const toastEl = title.closest("[data-sonner-toast]");
    expect(toastEl?.className).toContain("text-red-700");
    expect(toastEl?.className).toContain("bg-red-50");
  });
});

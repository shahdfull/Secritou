// SEC-051: QuestionnaireStep sent { serviceType, ...fields, isDraft } — spreading the dynamic
// per-serviceType answers (companyName/colors/references/pages, etc.) at the top level of the
// mutation payload. The server (clientOnboarding.repository.ts#updateQuestionnaire) only ever
// persists serviceType/isDraft/data.data — a nested `data` key the client never sent — so every
// dynamic answer was silently discarded, never saved and never displayed back. Found while typing
// away a `step: any`/`updateQuestionnaire: any` pair during the lint cleanup (SEC-049).
//
// This test renders the real QuestionnaireStep component (serviceType pre-set to "website" via
// the step fixture, avoiding the need to drive the Radix Select in jsdom) and asserts the
// mutation is called with the fields correctly nested under `data`, not spread at the top level.

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { OnboardingStep } from "@secritou/shared";
import type { TFunction } from "i18next";
import { QuestionnaireStep } from "./ClientOnboardingPage";

function makeStep(): OnboardingStep {
  return {
    id: "step-1",
    onboardingId: "onboarding-1",
    stepType: "questionnaire",
    title: "Questionnaire",
    status: "IN_PROGRESS",
    orderIndex: 1,
    questionnaire: {
      id: "q-1",
      onboardingStepId: "step-1",
      serviceType: "website",
      data: null,
      isDraft: true,
      submittedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const fakeT = ((key: string) => key) as unknown as TFunction;

describe("QuestionnaireStep — SEC-051 payload shape", () => {
  test("handleSave nests the dynamic fields under `data`, not spread at the top level", () => {
    const mutate = vi.fn();

    render(
      <QuestionnaireStep
        step={makeStep()}
        updateQuestionnaire={{ mutate, isPending: false } as never}
        t={fakeT}
      />
    );

    const companyNameInput = document.querySelector("input");
    if (companyNameInput) {
      fireEvent.change(companyNameInput, { target: { value: "Acme" } });
    }

    fireEvent.click(screen.getByText("onboarding.questionnaire.submit"));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload.data).toHaveProperty("data");
    expect(payload.data).not.toHaveProperty("companyName");
    expect(payload.data.serviceType).toBe("website");
    expect(payload.data.isDraft).toBe(false);
  });

  test("handleSave (draft) also nests fields under `data`", () => {
    const mutate = vi.fn();

    render(
      <QuestionnaireStep
        step={makeStep()}
        updateQuestionnaire={{ mutate, isPending: false } as never}
        t={fakeT}
      />
    );

    fireEvent.click(screen.getByText("onboarding.questionnaire.saveDraft"));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload.data).toHaveProperty("data");
    expect(payload.data).not.toHaveProperty("companyName");
    expect(payload.data.isDraft).toBe(true);
  });
});

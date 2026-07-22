// ClientBriefPage.tsx had zero client-side test coverage before this file — a critical client
// portal path (the only way a client submits the project brief that drives specs generation,
// server-side project.service.ts#submitBrief). Nothing proved the per-step required-field
// validation actually blocks advancing/submitting, that the real submitBrief mutation is called
// with the accumulated answers, or that an already-completed brief renders read-only.
//
// This renders the real ClientBriefPage, mocking only the real projectsApi module's network calls
// (not reimplementing the component's own step/validation logic) and react-router's
// useParams/useNavigate.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { BriefProject, BriefQuestion } from "@/api/projects.api";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ projectId: "project-1" }) };
});

vi.mock("@/api/projects.api", () => ({
  projectsApi: {
    getBrief: vi.fn(),
    submitBrief: vi.fn(),
  },
}));

const { projectsApi } = await import("@/api/projects.api");
const { ClientBriefPage } = await import("./ClientBriefPage");

// SECTION_SIZE=3 in the real component: exactly 3 questions means the single step is also the
// last step, so "Suivant" never appears — deliberately testing the last-step submit path.
const QUESTIONS: BriefQuestion[] = [
  { key: "activity", label: "Décrivez votre activité", type: "text", required: true },
  { key: "hasSite", label: "Avez-vous un site existant ?", type: "boolean" },
  { key: "budget", label: "Budget", type: "number" },
];

function makeProject(overrides: Partial<BriefProject> = {}): BriefProject {
  return {
    id: "project-1",
    name: "Site vitrine",
    serviceType: "WEB",
    briefData: null,
    briefCompleted: false,
    briefCompletedAt: null,
    clientId: "client-1",
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ClientBriefPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(projectsApi.getBrief).mockReset();
  vi.mocked(projectsApi.submitBrief).mockReset();
  window.localStorage.clear();
});

describe("ClientBriefPage — in-progress brief", () => {
  test("a required field left empty blocks submitting the (single, last) step", async () => {
    vi.mocked(projectsApi.getBrief).mockResolvedValue({ project: makeProject(), questions: QUESTIONS });
    renderPage();

    await waitFor(() => expect(screen.getByText(/Questions 1/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Soumettre le brief/ })).toBeDisabled();
  });

  test("filling the required text field enables submit, which calls the real mutation with accumulated answers", async () => {
    const user = userEvent.setup();
    vi.mocked(projectsApi.getBrief).mockResolvedValue({ project: makeProject(), questions: QUESTIONS });
    vi.mocked(projectsApi.submitBrief).mockResolvedValue(makeProject({ briefCompleted: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Questions 1/)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Votre réponse…"), "Agence de voyage");
    await user.click(screen.getByRole("checkbox"));

    const submitButton = screen.getByRole("button", { name: /Soumettre le brief/ });
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() =>
      expect(projectsApi.submitBrief).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ activity: "Agence de voyage", hasSite: true })
      )
    );
  });

  test("answers are persisted to localStorage as a draft while filling, and cleared after a real submit", async () => {
    const user = userEvent.setup();
    vi.mocked(projectsApi.getBrief).mockResolvedValue({ project: makeProject(), questions: QUESTIONS });
    vi.mocked(projectsApi.submitBrief).mockResolvedValue(makeProject({ briefCompleted: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Questions 1/)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Votre réponse…"), "Agence de voyage");

    await waitFor(() => {
      const raw = window.localStorage.getItem("client-brief-draft:project-1");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).answers).toMatchObject({ activity: "Agence de voyage" });
    });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Soumettre le brief/ }));

    await waitFor(() => expect(window.localStorage.getItem("client-brief-draft:project-1")).toBeNull());
  });
});

describe("ClientBriefPage — already-completed brief renders read-only", () => {
  test("shows the submitted answers without any editable input or submit button", async () => {
    vi.mocked(projectsApi.getBrief).mockResolvedValue({
      project: makeProject({ briefCompleted: true, briefCompletedAt: "2026-07-01T00:00:00.000Z", briefData: { activity: "Agence de voyage", hasSite: true } }),
      questions: QUESTIONS,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("Brief soumis")).toBeInTheDocument());
    expect(screen.getByText("Agence de voyage")).toBeInTheDocument();
    expect(screen.getByText("Oui")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Soumettre le brief/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Votre réponse…")).not.toBeInTheDocument();
  });
});

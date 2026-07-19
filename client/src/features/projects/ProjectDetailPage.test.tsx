// SEC-057 (U5): meeting cadence was only visible inside the "Réunions" tab (ProjectMeetingsTab.tsx)
// — an ADMIN/MANAGER had to click into that tab to see when the next meeting was due, even though
// the project header already surfaces other at-a-glance state (status badge, commission split).
//
// This renders the real ProjectDetailPage, mocking its data hooks (not its rendering logic), and
// proves the "Prochaine réunion" badge appears in the header exactly when the project has a
// recurring cadence set (meetingFrequency !== "NONE") with a concrete nextMeetingDate, and is
// absent otherwise.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import type { Project } from "@/types/project";

vi.mock("@/hooks/useAuth", () => ({
  useMe: () => ({ user: { id: "user-1", role: "ADMIN", name: "Admin", email: "a@test.local" } }),
}));

vi.mock("@/hooks/useCommissions", () => ({
  useMySplitForProject: () => ({ data: undefined }),
}));

vi.mock("@/hooks/useProjectTemplates", () => ({
  useProjectTemplateForService: () => ({ data: undefined }),
  useApplyProjectTemplate: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useDocuments", () => ({
  useCreateDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDocuments: () => ({ data: { data: [], total: 0 } }),
  useDownloadDocument: () => ({ mutate: vi.fn() }),
}));

vi.mock("./ProjectMeetingsTab", () => ({
  ProjectMeetingsTab: () => null,
}));

vi.mock("@/features/approvals/ApprovalsPage", () => ({
  ApprovalsPage: () => null,
}));

vi.mock("./TimeTrackingTab", () => ({
  TimeTrackingTab: () => null,
}));

let mockProject: Project | undefined;

const unarchiveMock = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  useProject: () => ({ data: mockProject, isLoading: false, isError: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUnarchiveProject: () => ({ mutate: unarchiveMock, isPending: false }),
}));

const { ProjectDetailPage } = await import("./ProjectDetailPage");

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Site vitrine",
    status: "IN_PROGRESS",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    progress: 40,
    taskDone: 2,
    taskTotal: 5,
    tasks: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/projects/project-1"]}>
      <Routes>
        <Route path="/app/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("ProjectDetailPage next-meeting badge — SEC-057 (U5)", () => {
  test("shows the badge when a recurring cadence is set with a next date", () => {
    mockProject = makeProject({ meetingFrequency: "WEEKLY", nextMeetingDate: "2026-08-01T00:00:00.000Z" });
    renderPage();
    expect(screen.getByText(/Prochaine réunion/)).toBeInTheDocument();
  });

  test("hides the badge when cadence is NONE", () => {
    mockProject = makeProject({ meetingFrequency: "NONE", nextMeetingDate: null });
    renderPage();
    expect(screen.queryByText(/Prochaine réunion/)).not.toBeInTheDocument();
  });

  test("hides the badge when no cadence field is present at all", () => {
    mockProject = makeProject();
    renderPage();
    expect(screen.queryByText(/Prochaine réunion/)).not.toBeInTheDocument();
  });
});

describe("ProjectDetailPage archive/unarchive buttons — SEC-078", () => {
  test("shows Archiver and not Désarchiver on a non-archived project (ADMIN)", () => {
    mockProject = makeProject({ archivedAt: null });
    renderPage();
    expect(screen.getByRole("button", { name: /Archiver/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Désarchiver/ })).not.toBeInTheDocument();
  });

  test("shows Désarchiver and not Archiver on an archived project (ADMIN)", () => {
    mockProject = makeProject({ archivedAt: "2026-07-19T00:00:00.000Z" });
    renderPage();
    expect(screen.getByRole("button", { name: /Désarchiver/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Archiver/ })).not.toBeInTheDocument();
  });

  test("clicking Désarchiver then confirming calls the real unarchive mutation with the project id", async () => {
    const user = userEvent.setup();
    mockProject = makeProject({ archivedAt: "2026-07-19T00:00:00.000Z" });
    renderPage();

    await user.click(screen.getByRole("button", { name: /Désarchiver/ }));
    await user.click(screen.getByRole("button", { name: "Désarchiver" }));

    expect(unarchiveMock).toHaveBeenCalledWith("project-1", expect.anything());
  });
});

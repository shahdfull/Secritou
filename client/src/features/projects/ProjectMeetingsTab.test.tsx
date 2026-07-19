// SEC-055 (F6): ProjectMeetingsTab had no edit/delete for a logged meeting — confirmed by grep
// (zero "delete"/"update"/"edit" matches), and server/src/routes/project.routes.ts only declared
// GET/POST on /:id/meetings (no PUT/DELETE existed even server-side, now added alongside this).
//
// This test renders the real ProjectMeetingsTab, mocking only apiClient (not the component's own
// logic), and proves:
// 1. A meeting created by the current user shows edit/delete controls.
// 2. A meeting created by someone else, viewed by a non-ADMIN, shows neither control — matching
//    the server's own MEETING_NOT_YOURS authorization this correctif introduces, so the UI
//    doesn't offer an action the server will predictably refuse.
// 3. Clicking delete + confirming calls the real DELETE endpoint for that meeting.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types/auth";

const getMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

const { ProjectMeetingsTab } = await import("./ProjectMeetingsTab");

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-author",
    email: "author@test.local",
    name: "Author Manager",
    role: "MANAGER",
    ...overrides,
  } as User;
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("fr");
  getMock.mockReset();
  putMock.mockReset();
  deleteMock.mockReset();
  deleteMock.mockResolvedValue({ data: {} });
  getMock.mockImplementation((url: string) => {
    if (url.includes("/meeting-schedule")) {
      return Promise.resolve({ data: { data: { id: "sched-1", meetingFrequency: "NONE", nextMeetingDate: null } } });
    }
    return Promise.resolve({ data: { data: [], total: 0 } });
  });
});

describe("ProjectMeetingsTab edit/delete authorization — SEC-055 (F6)", () => {
  test("shows edit/delete controls on a meeting created by the current user", async () => {
    useAuthStore.setState({ user: makeUser({ id: "user-author" }), status: "authenticated" });
    getMock.mockImplementation((url: string) => {
      if (url.includes("/meeting-schedule")) {
        return Promise.resolve({ data: { data: { id: "sched-1", meetingFrequency: "NONE", nextMeetingDate: null } } });
      }
      return Promise.resolve({
        data: {
          data: [
            {
              id: "meeting-1",
              projectId: "project-1",
              meetingDate: "2026-07-10T00:00:00.000Z",
              participants: null,
              notes: "note de test",
              createdBy: { id: "user-author", name: "Author Manager" },
              createdAt: "2026-07-10T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      });
    });

    render(<ProjectMeetingsTab projectId="project-1" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Modifier")).toBeInTheDocument();
      expect(screen.getByLabelText("Supprimer")).toBeInTheDocument();
    });
  });

  test("hides edit/delete controls on a meeting created by someone else (non-ADMIN viewer)", async () => {
    useAuthStore.setState({ user: makeUser({ id: "user-viewer" }), status: "authenticated" });
    getMock.mockImplementation((url: string) => {
      if (url.includes("/meeting-schedule")) {
        return Promise.resolve({ data: { data: { id: "sched-1", meetingFrequency: "NONE", nextMeetingDate: null } } });
      }
      return Promise.resolve({
        data: {
          data: [
            {
              id: "meeting-2",
              projectId: "project-1",
              meetingDate: "2026-07-10T00:00:00.000Z",
              participants: null,
              notes: "note d'un autre manager",
              createdBy: { id: "user-someone-else", name: "Someone Else" },
              createdAt: "2026-07-10T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      });
    });

    render(<ProjectMeetingsTab projectId="project-1" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText("note d'un autre manager")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Modifier")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Supprimer")).not.toBeInTheDocument();
  });

  test("clicking delete then confirming calls the real DELETE endpoint for that meeting", async () => {
    useAuthStore.setState({ user: makeUser({ id: "user-author" }), status: "authenticated" });
    getMock.mockImplementation((url: string) => {
      if (url.includes("/meeting-schedule")) {
        return Promise.resolve({ data: { data: { id: "sched-1", meetingFrequency: "NONE", nextMeetingDate: null } } });
      }
      return Promise.resolve({
        data: {
          data: [
            {
              id: "meeting-3",
              projectId: "project-1",
              meetingDate: "2026-07-10T00:00:00.000Z",
              participants: null,
              notes: "à supprimer",
              createdBy: { id: "user-author", name: "Author Manager" },
              createdAt: "2026-07-10T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      });
    });

    const user = userEvent.setup();
    render(<ProjectMeetingsTab projectId="project-1" />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByLabelText("Supprimer")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Supprimer"));
    await user.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/projects/project-1/meetings/meeting-3");
    });
  });
});

// SEC-059 (rapport Product Owner, §7 constat P2, session 2026-07-19) : un commentaire de tâche
// n'était jamais modifiable ni supprimable côté UI (ni côté serveur — voir
// server/test/taskCommentUpdateDelete.test.ts). Ce test rend le composant réel et vérifie que les
// boutons Modifier/Supprimer n'apparaissent que pour l'auteur du commentaire ou un ADMIN, et que
// l'édition/suppression appelle bien les handlers réels avec les bons arguments.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import type { Comment } from "@/types/comment";
import type { User } from "@/types/auth";

// @tanstack/react-virtual renders zero items in JSDOM (no real viewport size to compute visible
// rows against, same limitation already hit in TasksListView.test.tsx for SEC-056) — mocked out
// here since virtualization itself isn't what this test is about; it asserts comment edit/delete
// authorization, which needs the comment rows to actually render.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 84,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * 84, size: 84 })),
  }),
}));

// TaskDetailDrawer now also renders TaskAttachments (SEC-060), which calls useDocuments/apiClient —
// mocked here since attachment behavior isn't what this test covers (comment edit/delete auth).
const getMock = vi.fn().mockResolvedValue({ data: { data: [], total: 0, page: 1, pageSize: 50 } });
vi.mock("@/api/axios", () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// @radix-ui/react-scroll-area needs ResizeObserver, absent from JSDOM.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

const { TaskDetailDrawer } = await import("./TaskDetailDrawer");

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeUser(id: string, name: string): User {
  return { id, name, email: `${id}@test.local`, role: "MANAGER", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as User;
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    content: "Premier jet",
    taskId: "task-1",
    authorId: "user-author",
    author: makeUser("user-author", "Author Manager"),
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(): Task {
  return {
    id: "task-1",
    title: "Task with comments",
    status: "TODO",
    priority: "NORMAL",
    projectId: "project-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderDrawer(
  comments: Comment[],
  overrides: Partial<{ currentUserId: string | undefined; isAdmin: boolean }> = {}
) {
  const onUpdateComment = vi.fn();
  const onDeleteComment = vi.fn();
  render(
    <TaskDetailDrawer
      open={true}
      onOpenChange={() => {}}
      task={makeTask()}
      projectName="Site vitrine"
      projectClientId="client-1"
      userById={new Map()}
      comments={comments}
      onAddComment={() => {}}
      createCommentMutation={{ isPending: false }}
      currentUserId={overrides.currentUserId ?? "user-author"}
      isAdmin={overrides.isAdmin ?? false}
      canManageAttachments={true}
      onUpdateComment={onUpdateComment}
      onDeleteComment={onDeleteComment}
      isUpdatingComment={false}
      isDeletingComment={false}
    />,
    { wrapper: makeWrapper() }
  );
  return { onUpdateComment, onDeleteComment };
}

describe("TaskDetailDrawer comment edit/delete authorization — SEC-059", () => {
  test("shows edit/delete controls on a comment authored by the current user", () => {
    renderDrawer([makeComment({ authorId: "user-author" })], { currentUserId: "user-author", isAdmin: false });
    expect(screen.getByLabelText("Modifier")).toBeInTheDocument();
    expect(screen.getByLabelText("Supprimer")).toBeInTheDocument();
  });

  test("hides edit/delete controls on a comment authored by someone else (non-ADMIN viewer)", () => {
    renderDrawer([makeComment({ authorId: "user-someone-else" })], { currentUserId: "user-viewer", isAdmin: false });
    expect(screen.queryByLabelText("Modifier")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Supprimer")).not.toBeInTheDocument();
  });

  test("shows edit/delete controls for ADMIN regardless of authorship", () => {
    renderDrawer([makeComment({ authorId: "user-someone-else" })], { currentUserId: "user-admin", isAdmin: true });
    expect(screen.getByLabelText("Modifier")).toBeInTheDocument();
    expect(screen.getByLabelText("Supprimer")).toBeInTheDocument();
  });

  test("editing a comment and saving calls onUpdateComment with the new content", async () => {
    const user = userEvent.setup();
    const { onUpdateComment } = renderDrawer([makeComment({ id: "comment-42", content: "ancien texte" })]);

    await user.click(screen.getByLabelText("Modifier"));
    const textarea = screen.getByDisplayValue("ancien texte");
    await user.clear(textarea);
    await user.type(textarea, "nouveau texte");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onUpdateComment).toHaveBeenCalledWith("comment-42", "nouveau texte");
  });

  test("clicking delete then confirming calls onDeleteComment with the comment id", async () => {
    const user = userEvent.setup();
    const { onDeleteComment } = renderDrawer([makeComment({ id: "comment-77" })]);

    await user.click(screen.getByLabelText("Supprimer"));
    await user.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(onDeleteComment).toHaveBeenCalledWith("comment-77");
  });
});

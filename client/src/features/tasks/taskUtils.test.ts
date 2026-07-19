// SEC-054: the "Assigné à" selector (TaskCreateDialog/TaskEditDialog) listed every user
// returned by usersApi.getUsers() with no role filter, including CLIENT — even though the server
// (task.service.ts#assertAssigneeIsValid) always rejects a CLIENT assignee with
// 422 INVALID_ASSIGNEE_ROLE. The error only surfaced after submission, never anticipated in the
// form. filterAssignableUsers is the real filter TasksPage applies before handing `users` to
// either dialog; this test calls it directly.

import { describe, expect, test } from "vitest";
import type { User } from "@/types/auth";
import { filterAssignableUsers } from "./taskUtils";

function makeUser(role: User["role"], id: string): User {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("filterAssignableUsers — SEC-054", () => {
  test("excludes CLIENT users", () => {
    const users = [
      makeUser("ADMIN", "admin-1"),
      makeUser("MANAGER", "manager-1"),
      makeUser("FREELANCER", "freelancer-1"),
      makeUser("CLIENT", "client-1"),
    ];

    const result = filterAssignableUsers(users);

    expect(result.map((u) => u.id)).toEqual(["admin-1", "manager-1", "freelancer-1"]);
    expect(result.some((u) => u.role === "CLIENT")).toBe(false);
  });

  test("keeps every ADMIN/MANAGER/FREELANCER user (the server's own allowed set)", () => {
    const users = [makeUser("ADMIN", "a"), makeUser("MANAGER", "m"), makeUser("FREELANCER", "f")];
    expect(filterAssignableUsers(users)).toEqual(users);
  });

  test("returns an empty array unchanged", () => {
    expect(filterAssignableUsers([])).toEqual([]);
  });
});

// SEC-060 (mentions @ dans les commentaires) : ce test rend le composant réel et vérifie que
// taper "@" ouvre l'autocomplete parmi mentionableUsers, que la sélection insère bien le token
// `@[Nom](userId)` attendu par le serveur (utils/mentions.ts#extractMentionedUserIds), et que le
// filtrage par texte tapé après "@" restreint correctement les suggestions.

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, beforeAll } from "vitest";
import i18n from "@/i18n";
import type { User } from "@/types/auth";
import { MentionTextarea } from "./MentionTextarea";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeUser(id: string, name: string): User {
  return { id, name, email: `${id}@test.local`, role: "MANAGER", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as User;
}

const users = [makeUser("user-1", "Alice Martin"), makeUser("user-2", "Bob Dupont")];

function Harness({ mentionableUsers }: { mentionableUsers: User[] }) {
  const [value, setValue] = useState("");
  return <MentionTextarea value={value} onChange={setValue} mentionableUsers={mentionableUsers} />;
}

describe("MentionTextarea — SEC-060", () => {
  test("typing @ opens the autocomplete listing mentionable users", async () => {
    const user = userEvent.setup();
    render(<Harness mentionableUsers={users} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Salut @");

    expect(await screen.findByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("Bob Dupont")).toBeInTheDocument();
  });

  test("typing more text after @ filters the suggestions", async () => {
    const user = userEvent.setup();
    render(<Harness mentionableUsers={users} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Salut @ali");

    expect(await screen.findByText("Alice Martin")).toBeInTheDocument();
    expect(screen.queryByText("Bob Dupont")).not.toBeInTheDocument();
  });

  test("selecting a suggestion inserts the @[Name](userId) token the server expects", async () => {
    const user = userEvent.setup();
    render(<Harness mentionableUsers={users} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(textarea, "Salut @Alice");
    await user.click(await screen.findByText("Alice Martin"));

    expect(textarea.value).toBe("Salut @[Alice Martin](user-1) ");
  });
});

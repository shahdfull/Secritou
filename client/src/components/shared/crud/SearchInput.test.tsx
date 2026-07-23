// SEC-204: SearchInput.tsx (5 reuses across the app) exposed only a placeholder as its only hint
// to a value — not a reliable accessible name (some screen readers skip placeholders, and it
// disappears entirely once a value is typed). Fixed by falling back the placeholder into
// aria-label. This test queries the real rendered DOM (getByRole with the accessible-name lookup
// that a screen reader itself uses) and specifically re-checks the name AFTER typing a value,
// since a fix that only worked on the empty field would miss the actual bug (placeholder
// disappearing on input).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SearchInput } from "./SearchInput";

describe("SearchInput accessibility (SEC-204)", () => {
  test("exposes the placeholder as an accessible name via aria-label", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Rechercher un client" />);
    expect(screen.getByRole("searchbox", { name: "Rechercher un client" })).toBeInTheDocument();
  });

  test("keeps its accessible name after a value is typed, unlike a bare placeholder", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Rechercher un client" />);

    const input = screen.getByRole("searchbox", { name: "Rechercher un client" });
    await user.type(input, "Acme");

    expect(screen.getByRole("searchbox", { name: "Rechercher un client" })).toBeInTheDocument();
  });
});

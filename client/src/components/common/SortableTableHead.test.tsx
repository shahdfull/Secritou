// SEC-204: SortableTableHead.tsx used to render its sort control as a <div onClick>, invisible
// to keyboard/screen-reader users (no role, no tabIndex, no key handler, no accessible name for
// the sort state). Fixed with a real <button> (native Tab/Enter support) carrying an aria-label
// describing the column and current sort state, plus aria-sort on the parent <th>. This test
// queries the real rendered DOM (getByRole, aria-sort attribute) — not a reimplementation of the
// component's internals — and covers both the "not sorted" and "sorted" states, since a wrong fix
// could pass a superficial "a button exists" check while never actually reflecting sort state.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SortableTableHead } from "./SortableTableHead";

function renderInTable(props: React.ComponentProps<typeof SortableTableHead>) {
  return render(
    <table>
      <thead>
        <tr>
          <SortableTableHead {...props} />
        </tr>
      </thead>
    </table>
  );
}

describe("SortableTableHead accessibility (SEC-204)", () => {
  test("exposes a real, keyboard-focusable button with an accessible name when not sorted", () => {
    const onSort = vi.fn();
    renderInTable({ column: "name", label: "Nom", sortBy: "createdAt", sortOrder: "asc", onSort });

    const button = screen.getByRole("button", { name: "Trier par Nom" });
    expect(button).toBeInTheDocument();
    expect(button.closest("th")).toHaveAttribute("aria-sort", "none");
  });

  test("reflects the active sort column and order in aria-sort and the accessible name", () => {
    const onSort = vi.fn();
    renderInTable({ column: "name", label: "Nom", sortBy: "name", sortOrder: "desc", onSort });

    const button = screen.getByRole("button", { name: "Trier par Nom, ordre décroissant" });
    expect(button.closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  test("is reachable and activatable via keyboard alone (Tab + Enter), not just mouse click", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderInTable({ column: "name", label: "Nom", sortBy: "createdAt", sortOrder: "asc", onSort });

    await user.tab();
    expect(screen.getByRole("button", { name: "Trier par Nom" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSort).toHaveBeenCalledWith("name");
  });
});

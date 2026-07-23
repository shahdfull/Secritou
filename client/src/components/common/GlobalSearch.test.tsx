// SEC-204: GlobalSearch.tsx (the global search field present on every authenticated page via the
// header) exposed only a placeholder as its only hint to a value — same defect class as
// SearchInput.tsx, fixed the same way (aria-label={t("search.placeholder")} alongside the
// placeholder). This test queries the real rendered DOM (getByRole with the accessible-name
// lookup a screen reader itself uses) against the real component — network layer mocked, not the
// component's own logic.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, beforeAll, vi } from "vitest";
import i18n from "@/i18n";

vi.mock("@/api/search.api", () => ({
  searchApi: { search: vi.fn() },
}));

const { GlobalSearch } = await import("./GlobalSearch");

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("GlobalSearch accessibility (SEC-204)", () => {
  test("exposes an accessible name matching the visible placeholder", () => {
    render(
      <MemoryRouter>
        <GlobalSearch />
      </MemoryRouter>
    );

    const expectedName = i18n.t("search.placeholder");
    expect(screen.getByRole("searchbox", { name: expectedName })).toBeInTheDocument();
  });
});

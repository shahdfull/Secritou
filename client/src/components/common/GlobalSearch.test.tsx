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

// SEC-093: the header's search field wrapper (AdminLayout.tsx) leaves at most ~160px of usable
// width for this input on a narrow phone viewport (390px) once the sidebar trigger, gaps, and
// notification/avatar icons take their share — confirmed by a real Playwright bounding-box
// measurement during the original investigation. A long placeholder ("Rechercher les leads,
// clients, projets...", 37 chars) visually truncated against the icons at that width. This test
// can't reproduce the real layout math without a browser, but it does assert the one thing that
// actually matters and IS checkable here: the placeholder text itself stays short enough to have
// a chance of fitting — regressing back to a long placeholder would fail this even though the
// dynamic i18n.t() lookup above would stay green regardless of length.
describe("GlobalSearch placeholder length (SEC-093)", () => {
  test("fr and en placeholders stay short enough to fit a narrow mobile header", () => {
    const MAX_LENGTH = 20;
    for (const lng of ["fr", "en"]) {
      const placeholder = i18n.getFixedT(lng)("search.placeholder");
      expect(placeholder.length).toBeLessThanOrEqual(MAX_LENGTH);
    }
  });
});

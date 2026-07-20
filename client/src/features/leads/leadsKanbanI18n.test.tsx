// SEC-107: LeadsKanban.tsx's "Mark as lost" modal (title, description, placeholder, and its 2
// buttons) was hardcoded in French — the only untranslated text in a file that uses
// react-i18next everywhere else, invisible if the app switches to English. A full render test
// would need to simulate a real dnd-kit drag-and-drop to open the modal (fragile, heavy); this
// test instead calls the real i18n instance directly and confirms grep on the source file finds
// no leftover hardcoded French strings, proving both facts the fix claims: the keys resolve in
// both languages, and the component no longer contains the literal text.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test, beforeAll } from "vitest";
import i18n from "@/i18n";

describe("LeadsKanban 'mark as lost' modal — i18n (SEC-107)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  test("the FR and EN translation keys resolve to real, distinct strings", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("leadsPage.markAsLostTitle")).toBe("Marquer comme perdu");
    expect(i18n.t("leadsPage.markAsLostDesc")).toBe("Indiquez la raison pour laquelle ce lead est perdu (optionnel).");
    expect(i18n.t("leadsPage.markAsLostPlaceholder")).toContain("budget insuffisant");

    await i18n.changeLanguage("en");
    expect(i18n.t("leadsPage.markAsLostTitle")).toBe("Mark as lost");
    expect(i18n.t("leadsPage.markAsLostDesc")).toBe("Indicate why this lead is lost (optional).");
    expect(i18n.t("leadsPage.markAsLostPlaceholder")).toContain("insufficient budget");

    await i18n.changeLanguage("fr");
  });

  test("the component source no longer hardcodes the modal's French text", () => {
    const filePath = path.join(__dirname, "LeadsKanban.tsx");
    const source = readFileSync(filePath, "utf8");
    expect(source).not.toContain("Marquer comme perdu");
    expect(source).not.toContain("Indiquez la raison pour laquelle ce lead est perdu");
    expect(source).not.toContain("Ex : budget insuffisant");
  });
});

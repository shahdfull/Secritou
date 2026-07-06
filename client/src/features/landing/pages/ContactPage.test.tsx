import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import { ContactPage } from "./ContactPage";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

vi.mock("@calcom/embed-react", () => ({
  __esModule: true,
  default: () => null,
  getCalApi: () => Promise.resolve(() => {}),
}));

const submitContactRequestMock = vi.fn().mockResolvedValue({ success: true, message: "ok" });
vi.mock("@/services/contact.service", async () => {
  const actual = await vi.importActual<typeof import("@/services/contact.service")>(
    "@/services/contact.service"
  );
  return {
    ...actual,
    submitContactRequest: (...args: unknown[]) => submitContactRequestMock(...args),
  };
});

function renderContactPage() {
  return render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>
  );
}

function fieldByName(name: string): HTMLElement {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`Field "${name}" not found`);
  return el as HTMLElement;
}

async function fillValidFormExceptPhone(user: ReturnType<typeof userEvent.setup>) {
  await user.type(fieldByName("name"), "Jane Doe");
  await user.type(fieldByName("email"), "jane@example.com");
  await user.type(fieldByName("company"), "Acme");
  await user.type(
    fieldByName("message"),
    "Ceci est un message suffisamment long pour la validation."
  );
  // budget defaults to the empty placeholder option, which fails the
  // (unrelated) optional enum validation — select a real value so these
  // phone-focused tests aren't blocked by that pre-existing UX gap (see
  // audit/03-formulaires.md A6).
  await user.selectOptions(fieldByName("budget"), "< 1 000 DT");
}

describe("ContactPage phone validation (audit 03 #6)", () => {
  test("an invalid phone number blocks submission with a translated error", async () => {
    submitContactRequestMock.mockClear();
    const user = userEvent.setup();
    renderContactPage();

    await fillValidFormExceptPhone(user);
    await user.type(fieldByName("phone"), "12345678");
    await user.click(screen.getByRole("button", { name: /envoyer et planifier/i }));

    await waitFor(() => {
      expect(screen.getByText(/numéro de téléphone valide/i)).toBeInTheDocument();
    });
    expect(submitContactRequestMock).not.toHaveBeenCalled();
  });

  test("a valid Tunisian phone number (+216) passes validation", async () => {
    submitContactRequestMock.mockClear();
    const user = userEvent.setup();
    renderContactPage();

    await fillValidFormExceptPhone(user);
    await user.type(fieldByName("phone"), "+21622123456");
    await user.click(screen.getByRole("button", { name: /envoyer et planifier/i }));

    await waitFor(() => {
      expect(submitContactRequestMock).toHaveBeenCalledTimes(1);
    });
  });

  test("an empty phone number (optional field) passes validation", async () => {
    submitContactRequestMock.mockClear();
    const user = userEvent.setup();
    renderContactPage();

    await fillValidFormExceptPhone(user);
    await user.click(screen.getByRole("button", { name: /envoyer et planifier/i }));

    await waitFor(() => {
      expect(submitContactRequestMock).toHaveBeenCalledTimes(1);
    });
  });
});

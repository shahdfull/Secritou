// SEC-092: useStreamMessage already exposed a real cancel() (AbortController.abort()) but nothing
// in the UI ever called it — no Cancel button existed during isStreaming. This test renders the
// real ChatInput and asserts the Cancel button only appears while isStreaming is true, and that
// clicking it calls the real onCancel callback rather than the send button's onSend.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import { ChatInput } from "./AIAssistantPage";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("ChatInput cancel button (SEC-092)", () => {
  test("no Cancel button is rendered while not streaming", () => {
    render(
      <ChatInput value="" onChange={() => {}} onSend={() => {}} isLoading={false} isStreaming={false} />
    );
    expect(screen.queryByRole("button", { name: /arrêter/i })).not.toBeInTheDocument();
  });

  test("a Cancel button replaces the send button while streaming, and calls onCancel when clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSend = vi.fn();
    render(
      <ChatInput
        value=""
        onChange={() => {}}
        onSend={onSend}
        isLoading={false}
        isStreaming={true}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /arrêter/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});

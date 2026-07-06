import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeAll, beforeEach } from "vitest";
import i18n from "@/i18n";
import { FileUploadField } from "./FileUploadField";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

vi.mock("@/hooks/useUpload", () => ({
  useUpload: () => ({
    upload: vi.fn(),
    result: undefined,
    isUploading: false,
    deleteUploaded: vi.fn(),
  }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

function buildFile(name: string, sizeBytes: number, type: string) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("FileUploadField maxSizeMb", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  test("rejects a file above maxSizeMb and does not call onUploaded", async () => {
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(
      <FileUploadField context="cv" accept=".pdf" maxSizeMb={10} onUploaded={onUploaded} />
    );

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const bigFile = buildFile("cv.pdf", 11 * 1024 * 1024, "application/pdf");
    await user.upload(input, bigFile);

    expect(onUploaded).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Fichier trop volumineux (max 10 Mo).");
  });

  test("accepts a file at or below maxSizeMb", async () => {
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(
      <FileUploadField context="cv" accept=".pdf" maxSizeMb={10} onUploaded={onUploaded} />
    );

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const okFile = buildFile("cv.pdf", 5 * 1024 * 1024, "application/pdf");
    await user.upload(input, okFile);

    expect(onUploaded).toHaveBeenCalledWith(okFile);
  });
});

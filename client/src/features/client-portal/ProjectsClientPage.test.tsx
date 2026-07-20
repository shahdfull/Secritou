// SEC-116: ProjectsClientPage mounted ProjectTimeline (which polls every 30s) unconditionally
// for every project card — up to 100 cards per client (pageSize: 100), so the total polling cost
// scaled linearly with both active clients and projects per client, with no cap. This test
// renders the real page with several projects, mocks IntersectionObserver to control which cards
// are "visible", and proves the timeline's real API call (getTimelineStatus) only fires for a
// card once it becomes visible — not for every card up front.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

const getMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let observedElements: Array<{ element: Element; callback: ObserverCallback }> = [];

class FakeIntersectionObserver {
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
  observe(element: Element) {
    observedElements.push({ element, callback: this.callback });
  }
  disconnect() {
    observedElements = observedElements.filter((o) => o.callback !== this.callback);
  }
  unobserve() {}
}

function makeIntersecting(element: Element) {
  const entry = observedElements.find((o) => o.element === element);
  entry?.callback([{ isIntersecting: true, target: element }]);
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getMock.mockReset();
  observedElements = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

const { ProjectsClientPage } = await import("./ProjectsClientPage");

describe("ProjectsClientPage — lazy-mounted timelines (SEC-116)", () => {
  test("does not call getTimelineStatus for any project before it becomes visible", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/projects/my") {
        return Promise.resolve({
          data: {
            data: [
              { id: "project-1", name: "Site vitrine", status: "IN_PROGRESS", progress: 40 },
              { id: "project-2", name: "Application mobile", status: "PLANNING", progress: 0 },
            ],
            total: 2,
          },
        });
      }
      if (url.includes("/completed-tasks")) return Promise.resolve({ data: { data: [] } });
      if (url.includes("/timeline-status")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<ProjectsClientPage />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Site vitrine")).toBeInTheDocument();

    await vi.waitFor(() => {
      expect(observedElements.length).toBe(2);
    });

    expect(getMock).not.toHaveBeenCalledWith(expect.stringContaining("/timeline-status"));
  });

  test("calls getTimelineStatus for a project once its card becomes visible", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/projects/my") {
        return Promise.resolve({
          data: { data: [{ id: "project-1", name: "Site vitrine", status: "IN_PROGRESS", progress: 40 }], total: 1 },
        });
      }
      if (url.includes("/completed-tasks")) return Promise.resolve({ data: { data: [] } });
      if (url.includes("/timeline-status")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<ProjectsClientPage />, { wrapper: makeWrapper() });

    await screen.findByText("Site vitrine");
    await vi.waitFor(() => {
      expect(observedElements.length).toBe(1);
    });

    makeIntersecting(observedElements[0].element);

    await vi.waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/projects/project-1/timeline-status");
    });
  });
});

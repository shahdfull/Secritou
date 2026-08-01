import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { describe, expect, test, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth.store";
import { ProtectedRoute, computeLoginRedirectTarget } from "./ProtectedRoute";

function LoginProbe() {
  const [searchParams] = useSearchParams();
  return <div>Login page — redirect={searchParams.get("redirect") ?? "(none)"}</div>;
}

describe("computeLoginRedirectTarget (audit 03 #8)", () => {
  test("preserves the path and query string", () => {
    expect(computeLoginRedirectTarget("/login", "/app/invoices?page=2")).toBe(
      "/login?redirect=%2Fapp%2Finvoices%3Fpage%3D2"
    );
  });

  test("does not add a redirect param when already on the target path", () => {
    expect(computeLoginRedirectTarget("/login", "/login")).toBe("/login");
  });
});

describe("ProtectedRoute redirect propagation (audit 03 #8)", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      status: "unauthenticated",
      bootstrapped: true,
      accessToken: null,
    } as never);
  });

  test("an expired session on /app/invoices?page=2 redirects to /login with the path+query preserved", () => {
    render(
      <MemoryRouter initialEntries={["/app/invoices?page=2"]}>
        <Routes>
          <Route
            path="/app/invoices"
            element={
              <ProtectedRoute>
                <div>Invoices page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText("Login page — redirect=/app/invoices?page=2")
    ).toBeInTheDocument();
  });
});

describe("ProtectedRoute MANAGER guard on ADMIN-only routes (SEC-091)", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "m1", email: "m@test.local", name: "M", role: "MANAGER", serviceId: "s1" },
      status: "authenticated",
      bootstrapped: true,
      accessToken: "x",
    } as never);
  });

  test("MANAGER navigating directly to /app/booking is redirected to /app instead of rendering the page", () => {
    render(
      <MemoryRouter initialEntries={["/app/booking"]}>
        <Routes>
          <Route
            path="/app/booking"
            element={
              <ProtectedRoute>
                <div>Booking admin page (should never render for MANAGER)</div>
              </ProtectedRoute>
            }
          />
          <Route path="/app" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.queryByText("Booking admin page (should never render for MANAGER)")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  test("MANAGER navigating to /app/commissions (not ADMIN-only) still renders normally", () => {
    render(
      <MemoryRouter initialEntries={["/app/commissions"]}>
        <Routes>
          <Route
            path="/app/commissions"
            element={
              <ProtectedRoute>
                <div>Commissions page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Commissions page")).toBeInTheDocument();
  });
});

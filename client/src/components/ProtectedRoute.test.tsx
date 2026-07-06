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

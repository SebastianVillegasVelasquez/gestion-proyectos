import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/use-auth";

vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: vi.fn() }));

function renderAt(auth: { isAuthenticated: boolean; isBootstrapping: boolean }) {
  vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={["/privado"]}>
      <Routes>
        <Route path="/login" element={<p>pantalla de login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/privado" element={<p>contenido privado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("waits instead of redirecting while the session is being checked", () => {
    renderAt({ isAuthenticated: false, isBootstrapping: true });

    expect(screen.getByRole("status")).toHaveAccessibleName("Comprobando tu sesión");
    expect(screen.queryByText("pantalla de login")).not.toBeInTheDocument();
    expect(screen.queryByText("contenido privado")).not.toBeInTheDocument();
  });

  it("sends you to the login screen once there is no session", () => {
    renderAt({ isAuthenticated: false, isBootstrapping: false });

    expect(screen.getByText("pantalla de login")).toBeInTheDocument();
  });

  it("renders the route when the session is valid", () => {
    renderAt({ isAuthenticated: true, isBootstrapping: false });

    expect(screen.getByText("contenido privado")).toBeInTheDocument();
  });
});

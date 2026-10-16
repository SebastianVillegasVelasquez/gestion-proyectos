import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileDestinationHint } from "./FileDestinationHint";

const useTaskDestination = vi.fn();
vi.mock("../hooks/use-project-files", () => ({
  useTaskDestination: (...args: unknown[]) => useTaskDestination(...args) as unknown,
}));

describe("FileDestinationHint", () => {
  beforeEach(() => {
    useTaskDestination.mockReset();
  });

  it("shows the element folder the final file will be linked in", () => {
    useTaskDestination.mockReturnValue({ data: { folder_id: "f", path: ["Curso", "Módulo 1"] } });
    render(<FileDestinationHint projectId="p" taskId="t" workingPlace="la carpeta de tu equipo" />);

    expect(screen.getByText("la carpeta de tu equipo")).toBeInTheDocument();
    expect(screen.getByText("Curso › Módulo 1")).toBeInTheDocument();
  });

  it("says so when the task has no folder in the structure yet", () => {
    useTaskDestination.mockReturnValue({ data: null });
    render(<FileDestinationHint projectId="p" taskId="t" workingPlace="tu carpeta personal" />);

    expect(screen.getByText(/aún no tiene carpeta en la estructura/i)).toBeInTheDocument();
  });
});

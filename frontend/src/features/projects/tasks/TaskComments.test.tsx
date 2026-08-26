import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TaskComments } from "./TaskComments";
import { tasksApi } from "../api/tasks.api";
import { membersApi, directoryApi } from "../api/members.api";

vi.mock("../api/tasks.api", () => ({
  tasksApi: {
    comments: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}));

vi.mock("../api/members.api", () => ({
  membersApi: { list: vi.fn(), progress: vi.fn() },
  directoryApi: { list: vi.fn(), search: vi.fn() },
  usersApi: { list: vi.fn() },
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ana", role: "user" } }),
}));

function renderComments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TaskComments taskId="t1" />, { wrapper: Wrapper });
}

const comments = [
  {
    id: "c1",
    task_id: "t1",
    author_id: "u1",
    author_name: "Ana García",
    body: "Falta el cierre del video",
    mentioned_user_ids: [],
    created_at: "2026-08-25T10:00:00Z",
  },
  {
    id: "c2",
    task_id: "t1",
    author_id: "u2",
    author_name: "Beto Ruiz",
    body: "Lo subo mañana",
    mentioned_user_ids: [],
    created_at: "2026-08-25T11:00:00Z",
  },
];

describe("TaskComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApi.comments).mockResolvedValue(comments);
    vi.mocked(tasksApi.addComment).mockResolvedValue(comments[0]);
    vi.mocked(tasksApi.deleteComment).mockResolvedValue(undefined);
    vi.mocked(directoryApi.list).mockResolvedValue([
      { id: "u2", name: "Beto", last_name: "Ruiz" },
    ] as never);
    vi.mocked(membersApi.list).mockResolvedValue([] as never);
  });

  it("muestra la conversación con autor y texto", async () => {
    renderComments();

    expect(await screen.findByText("Falta el cierre del video")).toBeTruthy();
    expect(screen.getByText("Ana García")).toBeTruthy();
    expect(screen.getByText("Beto Ruiz")).toBeTruthy();
  });

  it("publica un comentario", async () => {
    const user = userEvent.setup();
    renderComments();
    await screen.findByText("Falta el cierre del video");

    await user.type(screen.getByLabelText(/Escribe un comentario/i), "Ya está corregido");
    await user.click(screen.getByRole("button", { name: /^Comentar$/ }));

    await waitFor(() => {
      expect(tasksApi.addComment).toHaveBeenCalledWith("t1", {
        body: "Ya está corregido",
        mentioned_user_ids: [],
      });
    });
  });

  it("no deja publicar un comentario vacío", async () => {
    renderComments();
    await screen.findByText("Falta el cierre del video");

    expect(screen.getByRole("button", { name: /^Comentar$/ })).toHaveProperty("disabled", true);
  });

  it("menciona a alguien y envía su id, no el texto", async () => {
    const user = userEvent.setup();
    renderComments();
    await screen.findByText("Falta el cierre del video");

    await user.click(screen.getByRole("button", { name: /Mencionar/i }));
    await user.click(await screen.findByRole("button", { name: "Beto Ruiz" }));
    await user.type(screen.getByLabelText(/Escribe un comentario/i), "revisa el audio");
    await user.click(screen.getByRole("button", { name: /^Comentar$/ }));

    await waitFor(() => {
      expect(tasksApi.addComment).toHaveBeenCalledWith("t1", {
        body: "@Beto Ruiz revisa el audio",
        mentioned_user_ids: ["u2"],
      });
    });
  });

  it("no avisa a quien se quitó del texto antes de enviar", async () => {
    const user = userEvent.setup();
    renderComments();
    await screen.findByText("Falta el cierre del video");

    await user.click(screen.getByRole("button", { name: /Mencionar/i }));
    await user.click(await screen.findByRole("button", { name: "Beto Ruiz" }));
    // Se arrepiente y borra la mención escrita.
    await user.clear(screen.getByLabelText(/Escribe un comentario/i));
    await user.type(screen.getByLabelText(/Escribe un comentario/i), "mejor lo veo yo");
    await user.click(screen.getByRole("button", { name: /^Comentar$/ }));

    await waitFor(() => {
      expect(tasksApi.addComment).toHaveBeenCalledWith("t1", {
        body: "mejor lo veo yo",
        mentioned_user_ids: [],
      });
    });
  });

  it("solo deja borrar los comentarios propios", async () => {
    renderComments();
    await screen.findByText("Falta el cierre del video");

    // c1 es de u1 (la persona conectada); c2 es de otra.
    expect(screen.getAllByLabelText(/Borrar comentario/i)).toHaveLength(1);
  });

  it("avisa cuando no hay conversación todavía", async () => {
    vi.mocked(tasksApi.comments).mockResolvedValue([]);
    renderComments();

    expect(await screen.findByText(/Sin comentarios/i)).toBeTruthy();
  });
});

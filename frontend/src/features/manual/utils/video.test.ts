import { describe, it, expect } from "vitest";
import { resolveVideo } from "./video";

describe("resolveVideo", () => {
  it("sin URL no hay nada que reproducir", () => {
    expect(resolveVideo(null)).toEqual({ kind: "none" });
    expect(resolveVideo("")).toEqual({ kind: "none" });
    expect(resolveVideo("   ")).toEqual({ kind: "none" });
  });

  it("convierte la URL de YouTube que copia el navegador a su forma incrustable", () => {
    expect(resolveVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "embed",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    expect(resolveVideo("https://youtu.be/dQw4w9WgXcQ?t=30")).toEqual({
      kind: "embed",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("acepta una URL de YouTube que ya viene incrustable", () => {
    expect(resolveVideo("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      kind: "embed",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("convierte Vimeo a su reproductor", () => {
    expect(resolveVideo("https://vimeo.com/123456789")).toEqual({
      kind: "embed",
      url: "https://player.vimeo.com/video/123456789",
    });
  });

  it("un fichero servido por nosotros se reproduce con el <video> del navegador", () => {
    expect(resolveVideo("https://cdn.obj.com/manual/recorrido.mp4")).toEqual({
      kind: "file",
      url: "https://cdn.obj.com/manual/recorrido.mp4",
    });
  });

  it("descarta lo que no sea http(s): nada raro llega a un src", () => {
    expect(resolveVideo("javascript:alert(1)")).toEqual({ kind: "none" });
    expect(resolveVideo("data:text/html,<script>")).toEqual({ kind: "none" });
    expect(resolveVideo("recorrido.mp4")).toEqual({ kind: "none" });
  });
});

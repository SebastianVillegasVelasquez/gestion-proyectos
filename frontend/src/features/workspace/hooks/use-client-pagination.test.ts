import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClientPagination } from "./use-client-pagination";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("useClientPagination", () => {
  it("recorta a la página actual y calcula totalPages", () => {
    const { result } = renderHook(() => useClientPagination(range(25), 10));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageItems).toEqual(range(10));
    expect(result.current.total).toBe(25);
  });

  it("navega con next/prev sin salirse del rango", () => {
    const { result } = renderHook(() => useClientPagination(range(25), 10));
    act(() => {
      result.current.next();
    });
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    act(() => {
      result.current.next();
      result.current.next();
    });
    expect(result.current.page).toBe(3);
    act(() => {
      result.current.prev();
      result.current.prev();
      result.current.prev();
    });
    expect(result.current.page).toBe(1);
  });

  it("si la lista encoge, la página se recorta al último rango con contenido", () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) => useClientPagination(items, 10),
      { initialProps: { items: range(25) } },
    );
    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);
    rerender({ items: range(8) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual(range(8));
  });
});

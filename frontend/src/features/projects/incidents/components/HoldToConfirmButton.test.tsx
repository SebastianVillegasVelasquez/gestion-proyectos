import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

function setup(props: { disabled?: boolean; holdMs?: number } = {}) {
  const onConfirm = vi.fn();
  render(
    <HoldToConfirmButton onConfirm={onConfirm} holdMs={props.holdMs ?? 1000} {...props}>
      Reflejar
    </HoldToConfirmButton>,
  );
  return { onConfirm, button: screen.getByRole("button", { name: "Reflejar" }) };
}

describe("HoldToConfirmButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not confirm on a quick click", () => {
    const { onConfirm, button } = setup();

    fireEvent.pointerDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms once after the press is held long enough", () => {
    const { onConfirm, button } = setup();

    fireEvent.pointerDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancels when the pointer leaves before the time is up", () => {
    const { onConfirm, button } = setup();

    fireEvent.pointerDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerLeave(button);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("works with the keyboard (hold space) and ignores key repeat", () => {
    const { onConfirm, button } = setup();

    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyDown(button, { key: " ", repeat: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("ignores secondary mouse buttons and a disabled state", () => {
    const secondary = setup();
    fireEvent.pointerDown(secondary.button, { button: 2 });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(secondary.onConfirm).not.toHaveBeenCalled();
  });

  it("never confirms while disabled", () => {
    const { onConfirm, button } = setup({ disabled: true });

    fireEvent.pointerDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

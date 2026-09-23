import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: () => null,
}));

import { TurnstileField } from "@/components/auth/turnstile-field";

describe("TurnstileField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.turnstile;
  });

  it("uses the compact challenge when its container is narrower than 300px", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 65,
      height: 65,
      left: 0,
      right: 280,
      top: 0,
      width: 280,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const renderWidget = vi.fn(() => "widget-1");
    window.turnstile = {
      remove: vi.fn(),
      render: renderWidget,
      reset: vi.fn(),
    };

    render(<TurnstileField siteKey="test-site-key" />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    expect(renderWidget).toHaveBeenNthCalledWith(
      1,
      expect.any(HTMLElement),
      expect.objectContaining({ size: "compact" })
    );
  });

  it("re-renders the challenge when the container crosses the compact breakpoint", async () => {
    let width = 320;
    let resizeCallback: ResizeObserverCallback | undefined;

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({
        bottom: 65,
        height: 65,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })
    );

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    }

    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const removeWidget = vi.fn();
    const renderWidget = vi
      .fn()
      .mockReturnValueOnce("widget-1")
      .mockReturnValueOnce("widget-2");
    window.turnstile = {
      remove: removeWidget,
      render: renderWidget,
      reset: vi.fn(),
    };

    render(<TurnstileField siteKey="test-site-key" />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    expect(renderWidget).toHaveBeenNthCalledWith(
      1,
      expect.any(HTMLElement),
      expect.objectContaining({ size: "flexible" })
    );

    width = 280;
    act(() => {
      resizeCallback?.(
        [{ contentRect: { width } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-1");
    expect(renderWidget).toHaveBeenNthCalledWith(
      2,
      expect.any(HTMLElement),
      expect.objectContaining({ size: "compact" })
    );
  });
});

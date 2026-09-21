import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminCommandPalette } from "./admin-command-palette";
import type { AdminShellNavigationItem } from "./admin-shell";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("AdminCommandPalette", () => {
  const navigationItems: AdminShellNavigationItem[] = [
    {
      group: "Overview",
      href: "/admin",
      iconKey: "dashboard",
      label: "Dashboard",
    },
    {
      group: "Membership",
      href: "/admin/applications",
      iconKey: "clipboard",
      label: "Applications",
    },
    {
      group: "Content",
      href: "/admin/content/notices",
      iconKey: "bell",
      label: "Notices",
    },
  ];

  it("does not render anything when isOpen is false", () => {
    const { container } = render(
      <AdminCommandPalette
        isOpen={false}
        onClose={vi.fn()}
        navigationItems={navigationItems}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders search input and options when isOpen is true", () => {
    render(
      <AdminCommandPalette
        isOpen={true}
        onClose={vi.fn()}
        navigationItems={navigationItems}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Admin command palette" });
    expect(dialog).toBeInTheDocument();

    const input = screen.getByRole("combobox");
    expect(input).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Applications")).toBeInTheDocument();
    expect(screen.getByText("Notices")).toBeInTheDocument();
  });

  it("filters items according to search query", () => {
    render(
      <AdminCommandPalette
        isOpen={true}
        onClose={vi.fn()}
        navigationItems={navigationItems}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "notices" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(screen.getByText("Notices")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("navigates to selected item on Enter and closes", () => {
    const onClose = vi.fn();
    render(
      <AdminCommandPalette
        isOpen={true}
        onClose={onClose}
        navigationItems={navigationItems}
      />
    );

    // Initial item is Dashboard
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // Now item 1 is Applications
    fireEvent.keyDown(window, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/admin/applications");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <AdminCommandPalette
        isOpen={true}
        onClose={onClose}
        navigationItems={navigationItems}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("wraps Tab focus from the last control back to the search input", () => {
    render(
      <AdminCommandPalette
        isOpen={true}
        onClose={vi.fn()}
        navigationItems={navigationItems}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "notices" } });
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    clearButton.focus();

    fireEvent.keyDown(window, { key: "Tab" });

    expect(input).toHaveFocus();
  });

  it("restores focus to the opener after the palette closes", () => {
    const onClose = vi.fn();
    const renderPalette = (isOpen: boolean) => (
      <>
        <button type="button">Open command palette</button>
        <AdminCommandPalette
          isOpen={isOpen}
          onClose={onClose}
          navigationItems={navigationItems}
        />
      </>
    );
    const { rerender } = render(renderPalette(false));
    const opener = screen.getByRole("button", { name: "Open command palette" });
    opener.focus();
    rerender(renderPalette(true));

    expect(screen.getByRole("combobox")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    rerender(renderPalette(false));

    expect(opener).toHaveFocus();
  });
});

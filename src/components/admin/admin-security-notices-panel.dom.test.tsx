import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AdminSecurityNoticesPanel,
  type AdminSecurityNotice,
} from "./admin-security-notices-panel";

describe("AdminSecurityNoticesPanel Component", () => {
  const sampleNotices: AdminSecurityNotice[] = [
    {
      id: "notice-1",
      title: "Native password update observed",
      summary: "Password change for admin account verified through Supabase Auth.",
      actorLabel: "Super Admin (Redwan)",
      occurredAt: "2026-10-14T10:00:00Z",
      severity: "warning",
      readAt: null,
      href: "/admin/audit?actor=test-actor",
      deliveryStatus: "delivered",
    },
    {
      id: "notice-2",
      title: "Admin invitation revoked",
      summary: "Pending invitation for editor role was revoked by admin.",
      actorLabel: "Admin Operator",
      occurredAt: "2026-10-14T09:00:00Z",
      severity: "info",
      readAt: "2026-10-14T09:30:00Z",
      href: null,
      deliveryStatus: "accepted",
    },
  ];

  it("renders notice list, severity badges, and unread count", () => {
    render(
      <AdminSecurityNoticesPanel
        notices={sampleNotices}
        page={1}
        pageSize={25}
        totalItems={2}
        unreadCount={1}
        availability="available"
      />
    );

    expect(screen.getByRole("heading", { name: "Security Notices" })).toBeInTheDocument();
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    expect(screen.getByText("Native password update observed")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Accepted by mail provider")).toBeInTheDocument();
  });

  it("calls onMarkRead only upon explicit button click", async () => {
    const onMarkRead = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AdminSecurityNoticesPanel
        notices={sampleNotices}
        page={1}
        pageSize={25}
        totalItems={2}
        unreadCount={1}
        availability="available"
        onMarkRead={onMarkRead}
      />
    );

    const markReadBtn = screen.getByRole("button", {
      name: /Mark notice as read: Native password update observed/i,
    });
    expect(markReadBtn).toBeInTheDocument();

    await user.click(markReadBtn);
    expect(onMarkRead).toHaveBeenCalledWith("notice-1");
  });

  it("calls onMarkAllRead on explicit click", async () => {
    const onMarkAllRead = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AdminSecurityNoticesPanel
        notices={sampleNotices}
        page={1}
        pageSize={25}
        totalItems={2}
        unreadCount={1}
        availability="available"
        onMarkAllRead={onMarkAllRead}
      />
    );

    const markAllBtn = screen.getByRole("button", { name: "Mark all as read" });
    await user.click(markAllBtn);

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("renders unavailable state gracefully without displaying fabricated zero count", () => {
    render(
      <AdminSecurityNoticesPanel
        notices={[]}
        page={1}
        pageSize={25}
        totalItems={0}
        unreadCount={null}
        availability="unavailable"
      />
    );

    expect(screen.getByText("Notice service temporarily unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/Security notification inbox unavailable/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/0 unread/i)).not.toBeInTheDocument();
  });
});

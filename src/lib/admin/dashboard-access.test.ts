import { describe, expect, it } from "vitest";
import {
  getAdminDashboardQuickLinks,
  type AdminDashboardCapabilities,
} from "@/lib/admin/dashboard-access";

const noCapabilities = {
  auditRead: false,
  bulkManage: false,
  certificatesManage: false,
  committeeManage: false,
  contentManage: false,
  decisionsRead: false,
  membershipManage: false,
  reconcileManage: false,
  reportsRead: false,
} satisfies AdminDashboardCapabilities;

describe("admin dashboard access helpers", () => {
  it("shows content links without membership/admin operational links", () => {
    const links = getAdminDashboardQuickLinks({
      ...noCapabilities,
      contentManage: true,
    });
    const hrefs = links.map((link) => link.href);

    expect(hrefs).toContain("/admin/content");
    expect(hrefs).toContain("/admin/content/blogs");
    expect(hrefs).toContain("/admin/content/events");
    expect(hrefs).not.toContain("/admin/invitations");
    expect(hrefs).not.toContain("/admin/membership");
    expect(hrefs).not.toContain("/admin/certificates");
    expect(hrefs).not.toContain("/admin/reconcile");
    expect(hrefs).not.toContain("/admin/decisions");
  });
});

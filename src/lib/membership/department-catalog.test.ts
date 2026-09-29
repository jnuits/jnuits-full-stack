import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

import { getActiveDepartmentCatalog } from "./department-catalog";

describe("getActiveDepartmentCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads explicit public fields for active departments in deterministic order", async () => {
    const query = {
      eq: vi.fn(),
      order: vi.fn(),
      select: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce({
        data: [
          { name: "Computer Science & Engineering", short_code: "CSE", sort_order: 20 },
          { name: "Accounting & Information Systems", short_code: "AIS", sort_order: 10 },
        ],
        error: null,
      });
    const from = vi.fn(() => query);
    mocks.createAdminClient.mockReturnValue({ from });

    const catalog = await getActiveDepartmentCatalog();

    expect(from).toHaveBeenCalledWith("departments");
    expect(query.select).toHaveBeenCalledWith("name, short_code, sort_order");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "name", { ascending: true });
    expect(catalog).toEqual([
      { name: "Accounting & Information Systems", shortCode: "AIS" },
      { name: "Computer Science & Engineering", shortCode: "CSE" },
    ]);
    expect(JSON.stringify(catalog)).not.toContain("sort_order");
    expect(JSON.stringify(catalog)).not.toContain("computer-science-engineering");
  });

  it("fails closed when the active catalog cannot be loaded", async () => {
    const query = {
      eq: vi.fn(),
      order: vi.fn(),
      select: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: null,
      error: { message: "private database detail" },
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    await expect(getActiveDepartmentCatalog()).rejects.toThrow(
      "Unable to load the active department catalog."
    );
  });
});

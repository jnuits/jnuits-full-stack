import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/errors/api-error", () => ({
  logServerError: (...args: unknown[]) => mocks.logServerError(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: mocks.getUserById } },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import {
  allowsOptionalEmail,
  getOptionalEmailRecipient,
} from "@/lib/notifications/preferences";

function preferenceQuery(result: unknown) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("optional email preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["admin_security_email_opt_in","admin_recommendation_email_opt_in"]as const)("defaults new optional preference %s to off",async preference=>{
    mocks.from.mockReturnValue(preferenceQuery({data:null,error:null}));
    expect(await allowsOptionalEmail("user-1",preference)).toBe(false);
    expect(await getOptionalEmailRecipient("user-1",preference)).toBeNull();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("requires a verified Auth address for the new admin email channels",async()=>{
    mocks.from.mockReturnValue(preferenceQuery({data:{admin_security_email_opt_in:true},error:null}));
    mocks.getUserById.mockResolvedValue({data:{user:{email:"operator@example.test",email_confirmed_at:null}},error:null});
    expect(await getOptionalEmailRecipient("user-1","admin_security_email_opt_in")).toBeNull();
    mocks.getUserById.mockResolvedValue({data:{user:{email:"operator@example.test",email_confirmed_at:"2026-10-16T00:00:00Z"}},error:null});
    expect(await getOptionalEmailRecipient("user-1","admin_security_email_opt_in")).toBe("operator@example.test");
  });

  it("uses the opt-in default when no preference row exists", async () => {
    mocks.from.mockReturnValue(preferenceQuery({ data: null, error: null }));

    await expect(
      allowsOptionalEmail("user-1", "notification_email_opt_in")
    ).resolves.toBe(true);
  });

  it("honors opt-out and fails closed when the preference cannot be read", async () => {
    mocks.from.mockReturnValue(
      preferenceQuery({ data: { ticket_digest_opt_in: false }, error: null })
    );
    await expect(
      allowsOptionalEmail("user-1", "ticket_digest_opt_in")
    ).resolves.toBe(false);

    mocks.from.mockReturnValue(
      preferenceQuery({ data: null, error: { code: "42501" } })
    );
    await expect(
      allowsOptionalEmail("user-1", "ticket_digest_opt_in")
    ).resolves.toBe(false);
    expect(mocks.logServerError).toHaveBeenCalled();
  });

  it("looks up a recipient only after the optional preference permits delivery", async () => {
    mocks.from.mockReturnValue(
      preferenceQuery({ data: { ticket_digest_opt_in: true }, error: null })
    );
    mocks.getUserById.mockResolvedValue({
      data: { user: { email: "operator@example.com" } },
      error: null,
    });

    await expect(
      getOptionalEmailRecipient("user-1", "ticket_digest_opt_in")
    ).resolves.toBe("operator@example.com");
    expect(mocks.getUserById).toHaveBeenCalledWith("user-1");
  });
});

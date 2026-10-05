import { describe, expect, it, vi } from "vitest";
import MembersJoinRedirectPage from "./page";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe("Members join redirect (F4)", () => {
  it("redirects /members/join directly to /membership-form", () => {
    redirectMock.mockClear();
    MembersJoinRedirectPage();
    expect(redirectMock).toHaveBeenCalledWith("/membership-form");
  });
});

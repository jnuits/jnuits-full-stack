import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CertificateVerifyIsland } from "./certificate-verify-island";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function responseFor(certificateId: string) {
  return {
    json: async () => ({
      data: [
        {
          certificate: {
            asset_url: null,
            certificate_id: certificateId,
            details: "completed the program",
            exam_or_event: "event",
            exam_or_event_name: `Program ${certificateId}`,
            full_name: `Member ${certificateId}`,
            issue_date: "2026-08-25",
          },
          certificateId,
          found: true,
        },
      ],
    }),
    ok: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CertificateVerifyIsland request ordering", () => {
  it("does not let an older response replace the latest verification", async () => {
    const user = userEvent.setup();
    const first = deferred<ReturnType<typeof responseFor>>();
    const second = deferred<ReturnType<typeof responseFor>>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<CertificateVerifyIsland />);

    const input = screen.getByLabelText("Certificate ID");
    await user.type(input, "FIRST");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await user.clear(input);
    await user.type(input, "SECOND");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    second.resolve(responseFor("SECOND"));
    expect(
      await screen.findByText("Member SECOND", { selector: "h2" }),
    ).toBeInTheDocument();

    first.resolve(responseFor("FIRST"));
    await waitFor(() => {
      expect(screen.queryByText("Member FIRST", { selector: "h2" })).toBeNull();
      expect(screen.getByText("Member SECOND", { selector: "h2" })).toBeInTheDocument();
    });
  });

  it("clears a previous result and explains an invalid empty submission", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor("VALID")));
    render(<CertificateVerifyIsland />);

    const input = screen.getByLabelText("Certificate ID");
    await user.type(input, "VALID");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(
      await screen.findByText("Member VALID", { selector: "h2" }),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(screen.queryByText("Member VALID", { selector: "h2" })).toBeNull();
    expect(screen.getByText("Enter a valid certificate ID.")).toBeInTheDocument();
  });
});

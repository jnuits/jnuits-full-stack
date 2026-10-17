import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectPendingPublicFormUploads,
  PublicFormScreen,
  uploadToCloudinary,
} from "@/components/forms/public-form-screen";
import { PUBLIC_FORM_HONEYPOT_CONTROL_NAME } from "@/lib/forms/control-names";
import { parseFormDefinition, type FormKind } from "@/lib/forms/definition";
import { getEventRegistrationSuccessContent } from "@/lib/forms/event-registration-result";
import { findAccessibilityViolations } from "../../../test/setup/axe";

/**
 * The first test that renders this screen.
 *
 * `public-form-presentation-contract.test.ts` has named this file since #52 and
 * it did not exist, so assertions about roles and structure stayed there as
 * string matches against the source. The live-region assertion moves here as
 * part of task 2.2, because the structure it described is exactly what this
 * slice changes and a string match cannot tell you whether a screen reader
 * would ever have heard it.
 */

const definition = parseFormDefinition({
  fields: [
    { id: "full_name", label: "Full name", required: true, type: "text" },
    { id: "email", label: "Email address", required: true, type: "email" },
  ],
  payment: { enabled: false },
});

const uploadDefinition = parseFormDefinition({
  fields: [
    { id: "website", label: "Website", required: true, type: "text" },
    { id: "identity_document", label: "Identity document", maxFiles: 1, required: true, type: "pdf" },
  ],
  payment: { enabled: false },
});

/**
 * A response-shaped object rather than a real `Response`.
 *
 * The screen reads `ok` and `json()` and nothing else, and constructing a real
 * `Response` would make this depend on which fetch implementation the runtime
 * happens to expose rather than on the screen's own behaviour.
 */
function stubFetch(payload: Record<string, unknown> = { success: true }) {
  const fetchMock = vi.fn(async () => ({ json: async () => payload, ok: true }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

/**
 * Rendered without a challenge on purpose. Turnstile mounts a third-party script
 * through `next/script`; requiring it here would test the stub, not the screen.
 */
function renderScreen(kind: FormKind = "membership_application") {
  return render(
    <PublicFormScreen
      captcha={{ required: false, siteKey: "" }}
      form={{
        definition,
        description: null,
        emailFieldId: "email",
        slug: "membership-2026",
        title: "Membership application",
      }}
      kind={kind}
      linkedEventId={kind === "event_registration" ? "event-1" : null}
    />
  );
}

async function submitValidAnswers(user: ReturnType<typeof userEvent.setup>, submitLabel: string) {
  await user.type(screen.getByLabelText(/Full name/), "Ayesha Rahman");
  await user.type(screen.getByLabelText(/Email address/), "ayesha@example.com");
  await user.click(screen.getByRole("button", { name: submitLabel }));
}

function uploadFile() {
  const file = new File([new Uint8Array([1, 2, 3])], "identity.pdf", {
    type: "application/pdf",
  });

  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new Uint8Array([1, 2, 3]).buffer,
  });

  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private upload transport", () => {
  it("sends the authenticated delivery type to the signed upload endpoint", async () => {
    const upload = { fieldId: "identity_document", file: uploadFile(), mimeType: "application/pdf" as const, sha256: "a".repeat(64), size: 3 };
    const instruction = { ...upload, allowedFormats: "pdf", apiKey: "public-key", assetFolder: "private/forms/fixture", context: "field_id=identity_document", publicId: "fixture.pdf", resourceType: "raw" as const, signature: "b".repeat(64), timestamp: 123, uploadId: "fixture", uploadUrl: "https://api.cloudinary.com/v1_1/fixture/raw/upload" };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, json: async () => ({ asset_id: "c".repeat(32), bytes: 3, public_id: "fixture.pdf", resource_type: "raw", version: 123 }) } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadToCloudinary(upload, instruction)).resolves.toMatchObject({ cloudinaryPublicId: "fixture.pdf", bytes: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(instruction.uploadUrl);
    const body = init?.body as FormData;
    expect(body.get("type")).toBe("authenticated");
    expect(body.get("signature")).toBe(instruction.signature);
    expect(body.get("public_id")).toBe(instruction.publicId);
    expect(body.get("file")).toBeInstanceOf(File);
  });
});

describe("the submission success state", () => {
  it("moves focus to the success heading instead of dropping it on the body", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen();

    await submitValidAnswers(user, "Submit and confirm email");

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Check your email",
    });

    await waitFor(() => expect(heading).toHaveFocus());

    // The actual regression. Success replaces the submit button that had focus,
    // and a removed element cannot keep it, so without this the browser hands
    // focus to <body> and the respondent is returned to the top of the document
    // with no statement of what happened.
    expect(document.activeElement).not.toBe(document.body);

    // A focus target, not a tab stop. -1 rather than 0 because nobody should
    // arrive on a heading by tabbing.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("does not put the focused heading inside a live region", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen();

    await submitValidAnswers(user, "Submit and confirm email");

    const heading = await screen.findByRole("heading", { level: 2 });

    await waitFor(() => expect(heading).toHaveFocus());

    // Moved here from public-form-presentation-contract.test.ts, and inverted.
    // The region used to wrap this heading and never announced anything, because
    // it mounted with its content already inside it. Now that focus lands on the
    // heading, a region around it would announce the same sentence twice.
    expect(heading.closest("[aria-live]")).toBeNull();
    expect(heading.closest('[role="status"]')).toBeNull();
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("focuses the registration heading too, whose wording differs", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen("event_registration");

    await submitValidAnswers(user, "Complete registration");

    // Read from the same source the screen reads, so this cannot pass by
    // asserting a copy of a string that has since been reworded.
    const { heading: expected } = getEventRegistrationSuccessContent(false);
    const heading = await screen.findByRole("heading", { level: 2, name: expected });

    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("leaves focus alone while the respondent uses the resend form", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen();

    await submitValidAnswers(user, "Submit and confirm email");

    const heading = await screen.findByRole("heading", { level: 2 });
    await waitFor(() => expect(heading).toHaveFocus());

    const resend = screen.getByRole("button", { name: "Resend confirmation email" });
    await user.click(resend);

    // The resend form re-renders this whole branch on each of its own state
    // changes. An effect keyed on the state object rather than on its status
    // would fire again here and drag focus back up to the heading, out of the
    // form the respondent is working in.
    await screen.findByRole("status");

    expect(heading).not.toHaveFocus();
    expect(resend).toHaveFocus();
  });

  it("does not touch focus when the submission fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ error: "Applications are closed.", success: false }),
        ok: false,
      }))
    );
    renderScreen();

    await submitValidAnswers(user, "Submit and confirm email");

    expect(await screen.findByRole("alert")).toHaveTextContent("Applications are closed.");
    // The form is still on screen, so there is nothing to move focus to and the
    // alert announces itself.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.getByRole("button", { name: "Submit and confirm email" })).toHaveFocus();
  });

  it("reports no axe violations in the success state", async () => {
    const user = userEvent.setup();
    stubFetch();
    const { container } = renderScreen();

    await submitValidAnswers(user, "Submit and confirm email");

    // Finding 14.5: prove the scan saw the success card rather than the form it
    // replaced, which would pass this for the wrong reason.
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(container).toContainElement(heading);

    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

describe("public form non-question controls", () => {
  it("collects a required upload when the respondent answers a Website question", async () => {
    vi.stubGlobal("crypto", {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) },
    });
    const formData = new FormData();
    formData.set("website", "https://member.example.test");
    formData.set("identity_document", uploadFile());

    const result = await collectPendingPublicFormUploads(formData, uploadDefinition);

    expect(result.honeypot).toBe("");
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0]).toMatchObject({ fieldId: "identity_document" });
  });

  it("short-circuits uploads only for the structurally unreachable honeypot name", async () => {
    const formData = new FormData();
    formData.set("website", "https://member.example.test");
    formData.set(PUBLIC_FORM_HONEYPOT_CONTROL_NAME, "https://spam.example.test");
    formData.set("identity_document", uploadFile());

    const result = await collectPendingPublicFormUploads(formData, uploadDefinition);

    expect(result.honeypot).toBe("https://spam.example.test");
    expect(result.uploads).toEqual([]);
  });
});

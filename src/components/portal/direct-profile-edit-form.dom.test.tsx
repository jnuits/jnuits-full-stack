import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectProfileEditForm } from "./direct-profile-edit-form";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DirectProfileEditForm Component", () => {
  const baseValues = {
    phone: "01711000000",
    currentOrganization: "Jagannath University",
    designation: "Lecturer",
    workLocation: "Dhaka",
    facebookUrl: "https://facebook.com/user",
    linkedinUrl: "https://linkedin.com/in/user",
    websiteUrl: "https://example.com",
    professionalVisibility: "members-only",
  };

  it("retains legacy form behavior and excludes workplaceApplicability when workplaceContractReady is false", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Profile changes saved." }),
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();

    render(
      <DirectProfileEditForm
        currentValues={baseValues}
        stepUpActive={true}
        workplaceContractReady={false}
      />
    );

    // Workplace applicability control must not exist when contract not ready
    expect(screen.queryByLabelText(/Workplace applicability/i)).not.toBeInTheDocument();

    const phoneInput = screen.getByLabelText(/^Phone/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, "01811000000");

    await user.click(screen.getByRole("button", { name: "Save direct changes" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const callArgs = fetch.mock.calls[0];
    expect(callArgs[0]).toBe("/api/profile/direct");
    const sentPayload = JSON.parse(callArgs[1].body);
    expect(sentPayload).toEqual({ phone: "01811000000" });
    expect(sentPayload).not.toHaveProperty("workplaceApplicability");
  });

  it("disables inputs and buttons when stepUpActive is false", () => {
    render(
      <DirectProfileEditForm
        currentValues={baseValues}
        stepUpActive={false}
        workplaceContractReady={true}
      />
    );

    expect(screen.getByLabelText(/^Phone/i)).toBeDisabled();
    expect(screen.getByLabelText(/Workplace applicability/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save direct changes" })).toBeDisabled();
  });

  it("prevents submitting not_applicable when workplace fields are non-blank", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();

    render(
      <DirectProfileEditForm
        currentValues={baseValues}
        stepUpActive={true}
        workplaceContractReady={true}
        workplaceApplicability="applicable"
      />
    );

    const applicabilitySelect = screen.getByLabelText(/Workplace applicability/i);
    await user.selectOptions(applicabilitySelect, "not_applicable");

    await user.click(screen.getByRole("button", { name: "Save direct changes" }));

    expect(
      screen.getByText(
        /To declare workplace not applicable, please clear current organization, designation, and work location first/i
      )
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows explicit local clearing of workplace fields and submits not_applicable cleanly", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Profile changes saved." }),
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();

    render(
      <DirectProfileEditForm
        currentValues={baseValues}
        stepUpActive={true}
        workplaceContractReady={true}
        workplaceApplicability="applicable"
      />
    );

    const applicabilitySelect = screen.getByLabelText(/Workplace applicability/i);
    await user.selectOptions(applicabilitySelect, "not_applicable");

    const clearButton = screen.getByRole("button", {
      name: "Clear workplace fields locally",
    });
    await user.click(clearButton);

    // Verify fields were cleared in the DOM before save
    expect(screen.getByLabelText(/Current organization/i)).toHaveValue("");
    expect(screen.getByLabelText(/Designation/i)).toHaveValue("");
    expect(screen.getByLabelText(/Work location/i)).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Save direct changes" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const sentPayload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sentPayload).toMatchObject({
      currentOrganization: "",
      designation: "",
      workLocation: "",
      workplaceApplicability: "not_applicable",
    });
  });

  it("handles server error responses gracefully", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Session step-up expired." }),
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();

    render(
      <DirectProfileEditForm
        currentValues={baseValues}
        stepUpActive={true}
        workplaceContractReady={false}
      />
    );

    const phoneInput = screen.getByLabelText(/^Phone/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, "01911000000");

    await user.click(screen.getByRole("button", { name: "Save direct changes" }));

    await waitFor(() => {
      expect(screen.getByText("Session step-up expired.")).toBeInTheDocument();
    });
  });
  it("keeps unsaved edits after a rejected save so the owner can retry", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({message:"Try again"})}));
    const user=userEvent.setup();
    render(<DirectProfileEditForm currentValues={baseValues} stepUpActive />);
    const input=screen.getByRole("textbox",{name:"Phone"});
    await user.clear(input);await user.type(input,"01812345678");
    await user.click(screen.getByRole("button",{name:"Save direct changes"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(input).toHaveValue("01812345678");
  });


  it("reconciles a successful canonical refresh before an unrelated save", async () => {
    const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({message:"Saved"})});
    vi.stubGlobal("fetch",fetch);
    const user=userEvent.setup();
    const initial={...baseValues,currentOrganization:"",designation:"",workLocation:""};
    const view=render(<DirectProfileEditForm currentValues={initial} stepUpActive workplaceContractReady workplaceApplicability={null}/>);
    await user.type(screen.getByLabelText(/Current organization/i),"New Organization");
    await user.click(screen.getByRole("button",{name:"Save direct changes"}));
    await screen.findByText("Saved");
    view.rerender(<DirectProfileEditForm currentValues={{...initial,currentOrganization:"New Organization"}} stepUpActive workplaceContractReady workplaceApplicability="applicable"/>);
    expect(screen.getByLabelText(/Workplace applicability/i)).toHaveValue("applicable");
    const phone=screen.getByLabelText(/^Phone/i);
    await user.clear(phone); await user.type(phone,"01812345678");
    await user.click(screen.getByRole("button",{name:"Save direct changes"}));
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({phone:"01812345678"});
  });

  it("preserves an unsaved applicability choice through an unrelated canonical update",async()=>{
    const user=userEvent.setup();
    const view=render(<DirectProfileEditForm currentValues={baseValues} stepUpActive workplaceContractReady workplaceApplicability={null}/>);
    await user.selectOptions(screen.getByLabelText(/Workplace applicability/i),"not_applicable");
    view.rerender(<DirectProfileEditForm currentValues={baseValues} stepUpActive workplaceContractReady workplaceApplicability="applicable"/>);
    expect(screen.getByLabelText(/Workplace applicability/i)).toHaveValue("not_applicable");
  });

});

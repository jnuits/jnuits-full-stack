import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmSubmitButton } from "./confirm-submit-button";

describe("viewport confirmation and native form submission", () => {
  it("preserves the form draft on cancel and submits it once only after confirmation", async () => {
    const submit = vi.fn(); const user = userEvent.setup();
    render(<form onSubmit={event => {
      event.preventDefault(); submit(new FormData(event.currentTarget).get("note"));
    }}><fieldset><label>Review note<input name="note" defaultValue="Checked eligibility" /></label>
      <ConfirmSubmitButton title="Record decision?" description="Confirm this exact decision." confirmLabel="Record decision">Save</ConfirmSubmitButton>
    </fieldset></form>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Review note")).toHaveValue("Checked eligibility");
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Record decision" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith("Checked eligibility");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps keyboard focus in the viewport confirmation and restores it on cancel", async () => {
    const user = userEvent.setup();
    render(<form onSubmit={event => event.preventDefault()}>
      <ConfirmSubmitButton title="Record decision?" description="Confirm this exact decision." confirmLabel="Record decision">Save</ConfirmSubmitButton>
      <button type="button">Background control</button>
    </form>);
    const opener = screen.getByRole("button", { name: "Save" });
    await user.click(opener);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Record decision" });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true }); expect(confirm).toHaveFocus();
    await user.tab(); expect(cancel).toHaveFocus();
    await user.tab(); expect(confirm).toHaveFocus();
    await user.tab(); expect(cancel).toHaveFocus();
    expect(screen.getByRole("button", { name: "Background control" })).not.toHaveFocus();
    await user.click(cancel); expect(opener).toHaveFocus();
  });
  it("cannot submit through a disabled caller or leave a confirmation bypass armed", async () => {
    const submit = vi.fn(); const user = userEvent.setup();
    const view = (disabled: boolean) => <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <fieldset disabled={disabled}><ConfirmSubmitButton title="Record decision?" description="Confirm this exact decision." confirmLabel="Record decision">Save</ConfirmSubmitButton></fieldset>
    </form>;
    const { rerender } = render(view(false));
    await user.click(screen.getByRole("button", { name: "Save" }));
    rerender(view(true));
    await user.click(screen.getByRole("button", { name: "Record decision" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    rerender(view(false));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Record decision" }));
    expect(submit).toHaveBeenCalledOnce();
  });
  it("Escape cancels the confirmation and restores focus without submitting", async () => {
    const submit = vi.fn(); const user = userEvent.setup();
    render(<form onSubmit={event => { event.preventDefault(); submit(); }}>
      <ConfirmSubmitButton title="Record decision?" description="Confirm this exact decision.">Save</ConfirmSubmitButton>
    </form>);
    const opener = screen.getByRole("button", { name: "Save" });
    await user.click(opener);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CommitteeLeadershipSpeechField } from "./committee-leadership-speech-field";
describe("leadership quote editor", () => {
  it.each(["president","general-secretary"])("labels the %s quote, enforces 160 and updates the counter", async roleCode => {
    const user=userEvent.setup(); render(<CommitteeLeadershipSpeechField roleCode={roleCode} speech={null} />);
    const field=screen.getByRole("textbox",{name:"Leadership speech / quote"});
    expect(field).toHaveAttribute("maxLength","160");
    await user.type(field,"Welcome"); expect(screen.getByText("7 / 160")).toBeVisible();
    expect(field).toHaveValue("Welcome");
  });
  it("clears the submitted value when switching to a non-spokesperson role", () => {
    const {container,rerender}=render(<CommitteeLeadershipSpeechField roleCode="president" speech="Leadership quote" />);
    rerender(<CommitteeLeadershipSpeechField roleCode="treasurer" speech="Leadership quote" />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="speech"]')).toHaveValue("");
  });
});

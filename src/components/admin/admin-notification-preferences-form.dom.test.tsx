import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminNotificationPreferencesForm } from "./admin-notification-preferences-form";

describe("AdminNotificationPreferencesForm Component", () => {
  it("renders essential security notice callout and optional toggles with loaded defaults", () => {
    render(
      <AdminNotificationPreferencesForm
        ready={true}
        admin_security_email_opt_in={false}
        admin_recommendation_email_opt_in={true}
      />
    );

    expect(
      screen.getByText("Essential account security notices are always active")
    ).toBeInTheDocument();

    const securityCheckbox = screen.getByLabelText(
      /Receive peer security email alerts/i
    );
    const recommendationCheckbox = screen.getByLabelText(
      /Receive monthly personal recommendations digest/i
    );

    expect(securityCheckbox).not.toBeChecked();
    expect(recommendationCheckbox).toBeChecked();
  });

  it("submits modified preferences via onSave callback and displays feedback", async () => {
    const onSave = vi.fn().mockResolvedValue({
      success: true,
      message: "Preferences updated successfully.",
    });
    const user = userEvent.setup();

    render(
      <AdminNotificationPreferencesForm
        ready={true}
        admin_security_email_opt_in={false}
        admin_recommendation_email_opt_in={false}
        onSave={onSave}
      />
    );

    const securityCheckbox = screen.getByLabelText(
      /Receive peer security email alerts/i
    );
    await user.click(securityCheckbox);
    expect(securityCheckbox).toBeChecked();

    const submitBtn = screen.getByRole("button", {
      name: "Save notification preferences",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        admin_security_email_opt_in: true,
        admin_recommendation_email_opt_in: false,
      });
      expect(
        screen.getByText("Preferences updated successfully.")
      ).toBeInTheDocument();
    });
  });

  it("displays error message when onSave returns an error", async () => {
    const onSave = vi.fn().mockResolvedValue({
      success: false,
      message: "Network request failed.",
    });
    const user = userEvent.setup();

    render(
      <AdminNotificationPreferencesForm
        ready={true}
        admin_security_email_opt_in={true}
        admin_recommendation_email_opt_in={true}
        onSave={onSave}
      />
    );

    const submitBtn = screen.getByRole("button", {
      name: "Save notification preferences",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Network request failed.")).toBeInTheDocument();
    });
  });

  it("renders disabled message when ready is false", () => {
    render(
      <AdminNotificationPreferencesForm
        ready={false}
      />
    );

    expect(
      screen.getByText("Notification preferences will be available shortly")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save notification preferences" })
    ).not.toBeInTheDocument();
  });
});

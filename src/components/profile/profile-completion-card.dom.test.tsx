import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ProfileCompletionCard,
  type ProfileCompletion,
  type CompletionNextStep,
} from "./profile-completion-card";

describe("ProfileCompletionCard Component", () => {
  it("renders accessible progress bar with server-supplied score and counts", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "available",
      percent: 89,
      completed: 8,
      applicable: 9,
      missing: ["workplace"],
    };

    const nextSteps: CompletionNextStep[] = [
      {
        field: "workplace",
        label: "Add current organization, designation and location",
        href: "/portal/profile/edit",
        mode: "self_edit",
        state: "missing",
        focusId: "dpe-currentOrganization",
      },
    ];

    render(<ProfileCompletionCard summary={summary} nextSteps={nextSteps} />);

    expect(screen.getByRole("heading", { name: "Profile completeness" })).toBeInTheDocument();
    expect(screen.getByTestId("profile-completion-percent")).toHaveTextContent("89%");
    expect(screen.getByText("8 of 9 core checks complete")).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "89");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute(
      "aria-valuetext",
      "89% complete, 8 of 9 checks passed"
    );

    const link = screen.getByRole("link", { name: /Update/i });
    expect(link).toHaveAttribute("href", "/portal/profile/edit#dpe-currentOrganization");
  });

  it("limits next steps to at most 3 even when more are provided", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "available",
      percent: 50,
      completed: 4,
      applicable: 8,
      missing: ["phone", "workplace", "photo", "department"],
    };

    const nextSteps: CompletionNextStep[] = [
      {
        field: "phone",
        label: "Provide contact phone number",
        href: "/portal/profile/edit",
        mode: "self_edit",
        state: "missing",
        focusId: "dpe-phone",
      },
      {
        field: "workplace",
        label: "Specify workplace organization",
        href: "/portal/profile/edit",
        mode: "self_edit",
        state: "missing",
        focusId: "dpe-workplaceApplicability",
      },
      {
        field: "photo",
        label: "Upload profile avatar",
        href: "/portal/profile/edit",
        mode: "self_edit",
        state: "missing",
        focusId: "dpe-photo",
      },
      {
        field: "department",
        label: "Request academic department review",
        href: "/portal/profile/request-change",
        mode: "reviewed_identity",
        state: "pending_review",
      },
    ];

    render(<ProfileCompletionCard summary={summary} nextSteps={nextSteps} />);

    const stepList = screen.getByRole("list", { name: "Profile completion steps" });
    const items = stepList.querySelectorAll("li");
    expect(items).toHaveLength(3);

    expect(screen.getByText("Provide contact phone number")).toBeInTheDocument();
    expect(screen.getByText("Specify workplace organization")).toBeInTheDocument();
    expect(screen.getByText("Upload profile avatar")).toBeInTheDocument();
    expect(screen.queryByText("Request academic department review")).not.toBeInTheDocument();
  });

  it("renders pending review state badge and view status link correctly", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "available",
      percent: 88,
      completed: 7,
      applicable: 8,
      missing: ["department"],
    };

    const nextSteps: CompletionNextStep[] = [
      {
        field: "department",
        label: "Department correction request",
        href: "/portal/profile#change-requests",
        mode: "reviewed_identity",
        state: "pending_review",
      },
    ];

    render(<ProfileCompletionCard summary={summary} nextSteps={nextSteps} />);

    expect(screen.getByText("Under review")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /View status/i });
    expect(link).toHaveAttribute("href", "/portal/profile#change-requests");
  });

  it("renders unavailable state gracefully without displaying 0% or fake missing items", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "unavailable",
      percent: null,
      completed: 0,
      applicable: 0,
      missing: [],
    };

    render(<ProfileCompletionCard summary={summary} nextSteps={[]} />);

    expect(screen.getByText("Completion status is temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-completion-percent")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/could not be evaluated at this time/i)).toBeInTheDocument();
  });

  it("renders 100% complete state with applicable details complete notice", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "available",
      percent: 100,
      completed: 9,
      applicable: 9,
      missing: [],
    };

    render(<ProfileCompletionCard summary={summary} nextSteps={[]} />);

    expect(screen.getByTestId("profile-completion-percent")).toHaveTextContent("100%");
    expect(screen.getByText("Applicable details complete")).toBeInTheDocument();
    expect(
      screen.getByText(/All core identity and profile checks pass the current rubric/i)
    ).toBeInTheDocument();
  });

  it("does not leak protected student ID, email or phone values in generic focus links", () => {
    const summary: ProfileCompletion = {
      version: 1,
      status: "available",
      percent: 78,
      completed: 7,
      applicable: 9,
      missing: ["phone", "workplace"],
    };

    const nextSteps: CompletionNextStep[] = [
      {
        field: "phone",
        label: "Add contact phone",
        href: "/portal/profile/edit",
        mode: "self_edit",
        state: "missing",
        focusId: "dpe-phone",
      },
    ];

    render(<ProfileCompletionCard summary={summary} nextSteps={nextSteps} />);

    const link = screen.getByRole("link", { name: /Update/i });
    const href = link.getAttribute("href") || "";
    expect(href).not.toMatch(/\+880/);
    expect(href).not.toMatch(/@/);
    expect(href).not.toMatch(/\d{6,}/);
    expect(href).toBe("/portal/profile/edit#dpe-phone");
  });
});

it("labels separate admin and linked member cards with unique heading IDs",()=>{
 const summary:ProfileCompletion={version:1,status:"available",percent:100,completed:3,applicable:3,missing:[]};
 render(<><ProfileCompletionCard summary={summary} title="Admin profile"/><ProfileCompletionCard summary={summary} title="Linked member"/></>);
 const cards=screen.getAllByTestId("profile-completion-card");
 const ids=cards.map(card=>card.getAttribute("aria-labelledby"));
 expect(new Set(ids).size).toBe(2);
 expect(document.getElementById(ids[0]!)).toHaveTextContent("Admin profile");
 expect(document.getElementById(ids[1]!)).toHaveTextContent("Linked member");
});

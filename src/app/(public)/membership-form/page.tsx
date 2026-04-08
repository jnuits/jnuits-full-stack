"use client";

import { useState } from "react";
import Link from "next/link";
import { departments } from "@/lib/departments";

type MembershipStatus = "pending" | "approved" | "rejected";

const statusClassNames: Record<MembershipStatus, string> = {
  pending: "text-[var(--brand-gold)]",
  approved: "text-[var(--brand-green)]",
  rejected: "text-[var(--brand-rust)]",
};

export default function MembershipFormPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    departmentCode: "",
    batchLabel: "",
    studentId: "",
    photoUrl: "",
    facebookUrl: "",
    phone: "",
    linkedinUrl: "",
    website: "",
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusEmail, setStatusEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<MembershipStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  function updateField(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      const response = await fetch("/api/membership-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Membership application submission failed.");
      }

      setSubmitMessage(
        payload?.message ||
          "Application submitted successfully. Current status: pending."
      );
      setStatusEmail(formData.email);
      setStatusValue("pending");
      setStatusMessage("Latest status: pending");
      setFormData({
        name: "",
        email: "",
        departmentCode: "",
        batchLabel: "",
        studentId: "",
        photoUrl: "",
        facebookUrl: "",
        phone: "",
        linkedinUrl: "",
        website: "",
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Membership application submission failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusCheck() {
    if (!statusEmail.trim()) {
      setStatusMessage("Enter the email used in your application.");
      setStatusValue(null);
      return;
    }

    setIsCheckingStatus(true);
    setStatusMessage(null);
    setStatusValue(null);

    try {
      const response = await fetch(
        `/api/membership-form/status?email=${encodeURIComponent(statusEmail.trim())}`
      );
      const payload = (await response.json().catch(() => null)) as
        | { found?: boolean; status?: MembershipStatus | null; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to check application status.");
      }

      if (!payload?.found || !payload.status) {
        setStatusMessage("No application found with this email.");
        return;
      }

      setStatusValue(payload.status);
      setStatusMessage(`Latest status: ${payload.status}`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to check application status."
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }

  return (
    <div className="shell py-12">
      <section className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Membership transition</span>
          <h1 className="section-title mt-4">
            Apply for membership while the invitation-first model is phased in.
          </h1>
          <p className="section-copy mt-4">
            This temporary flow preserves the old public application path without
            routing users through the Strapi stack. Submissions land in Supabase
            for operator review, and applicants can still check the latest status
            by email.
          </p>

          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <input
              name="name"
              placeholder="Full name"
              required
              value={formData.name}
              onChange={updateField}
            />
            <input
              name="email"
              type="email"
              placeholder="Email address"
              required
              value={formData.email}
              onChange={updateField}
            />
            <select
              name="departmentCode"
              required
              value={formData.departmentCode}
              onChange={updateField}
            >
              <option value="">Select your department</option>
              {departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                name="batchLabel"
                placeholder="Batch"
                required
                value={formData.batchLabel}
                onChange={updateField}
              />
              <input
                name="studentId"
                placeholder="Student ID"
                required
                value={formData.studentId}
                onChange={updateField}
              />
            </div>
            <input
              name="phone"
              placeholder="Phone number"
              value={formData.phone}
              onChange={updateField}
            />
            <input
              name="facebookUrl"
              placeholder="Facebook profile URL"
              value={formData.facebookUrl}
              onChange={updateField}
            />
            <input
              name="linkedinUrl"
              placeholder="LinkedIn profile URL"
              value={formData.linkedinUrl}
              onChange={updateField}
            />
            <input
              name="photoUrl"
              placeholder="Photo URL"
              value={formData.photoUrl}
              onChange={updateField}
            />
            <div style={{ display: "none" }}>
              <input
                name="website"
                value={formData.website}
                onChange={updateField}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {submitMessage ? <p className="status-pill">{submitMessage}</p> : null}
            {submitError ? (
              <p className="text-sm font-semibold text-[var(--brand-rust)]">
                {submitError}
              </p>
            ) : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : "Submit application"}
            </button>
          </form>
        </div>

        <div className="grid gap-6">
          <article className="route-tile">
            <h3>Application status</h3>
            <p className="mb-4">
              Check the latest recorded review status using the email address you
              submitted with the application.
            </p>
            <input
              type="email"
              placeholder="Application email"
              value={statusEmail}
              onChange={(event) => setStatusEmail(event.target.value)}
            />
            <button
              className="secondary-button mt-3"
              disabled={isCheckingStatus}
              onClick={handleStatusCheck}
              type="button"
            >
              {isCheckingStatus ? "Checking..." : "Check status"}
            </button>
            {statusMessage ? (
              <p
                className={`mt-3 text-sm font-semibold ${
                  statusValue ? statusClassNames[statusValue] : "text-[var(--muted)]"
                }`}
              >
                {statusMessage}
              </p>
            ) : null}
          </article>

          <article className="route-tile">
            <h3>Existing members</h3>
            <p>
              If you already have an invitation code, use the claim flow instead of
              submitting a new membership application.
            </p>
            <Link href="/register" className="secondary-button mt-4 inline-flex">
              Claim profile
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}

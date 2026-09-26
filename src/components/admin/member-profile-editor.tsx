"use client";

import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";

import { updateMemberProfileAction } from "@/app/admin/membership/profile-actions";
import type { MemberProfileActionMember } from "@/app/admin/membership/profile-actions";

export type MemberProfileEditorRecord = MemberProfileActionMember;

export function MemberProfileEditor({
  member,
  onSaved,
}: {
  member: MemberProfileEditorRecord;
  onSaved?: (member: MemberProfileActionMember) => void;
}) {
  const [fullName, setFullName] = useState(member.fullName);
  const [departmentCode, setDepartmentCode] = useState(member.departmentCode || "");
  const [batchNo, setBatchNo] = useState(member.batchNo?.toString() || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [studentId, setStudentId] = useState(member.studentId || "");
  const [facebookUrl, setFacebookUrl] = useState(member.facebookUrl || "");
  const [linkedinUrl, setLinkedinUrl] = useState(member.linkedinUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(member.websiteUrl || "");
  const [auditNote, setAuditNote] = useState("");
  const [feedback, setFeedback] = useState<null | {
    message: string;
    tone: "error" | "success";
  }>(null);
  const [isPending, startTransition] = useTransition();
  const headingId = `member-profile-heading-${member.id}`;

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await updateMemberProfileAction({
          auditNote,
          batchNo,
          departmentCode,
          expectedUpdatedAt: member.expectedUpdatedAt,
          facebookUrl,
          fullName,
          linkedinUrl,
          memberId: member.id,
          phone,
          studentId,
          websiteUrl,
        });
        if (!result.ok) {
          setFeedback({ message: result.message, tone: "error" });
          return;
        }
        setFeedback({ message: result.message, tone: "success" });
        setAuditNote("");
        onSaved?.(result.member);
      } catch {
        setFeedback({
          message: "Unable to save the member profile. Check your connection and try again.",
          tone: "error",
        });
      }
    });
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-4 border-b border-border p-5">
      <div>
        <h3 className="text-sm font-semibold" id={headingId}>Identity and profile</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Blank optional fields preserve existing values. Identity, classification, portal access,
          directory privacy, and roles are not changed here.
        </p>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="input-label">
            JnUITS ID
            <input readOnly value={member.jnuitsId} />
          </label>
          <label className="input-label">
            Email
            <input readOnly type="email" value={member.email} />
          </label>
          <label className="input-label">
            Classification
            <input readOnly value={member.lifecycleStatus} />
          </label>
          <label className="input-label sm:col-span-2">
            Full name
            <input maxLength={180} onChange={(event) => setFullName(event.currentTarget.value)} required value={fullName} />
          </label>
          <label className="input-label">
            Department code
            <input maxLength={40} onChange={(event) => setDepartmentCode(event.currentTarget.value)} value={departmentCode} />
          </label>
          <label className="input-label">
            Batch
            <input inputMode="numeric" maxLength={20} onChange={(event) => setBatchNo(event.currentTarget.value)} value={batchNo} />
          </label>
          <label className="input-label">
            Phone
            <input maxLength={60} onChange={(event) => setPhone(event.currentTarget.value)} value={phone} />
          </label>
          <label className="input-label">
            Student ID
            <input maxLength={80} onChange={(event) => setStudentId(event.currentTarget.value)} value={studentId} />
          </label>
          <label className="input-label">
            Facebook URL
            <input maxLength={500} onChange={(event) => setFacebookUrl(event.currentTarget.value)} type="url" value={facebookUrl} />
          </label>
          <label className="input-label">
            LinkedIn URL
            <input maxLength={500} onChange={(event) => setLinkedinUrl(event.currentTarget.value)} type="url" value={linkedinUrl} />
          </label>
          <label className="input-label">
            Website URL
            <input maxLength={500} onChange={(event) => setWebsiteUrl(event.currentTarget.value)} type="url" value={websiteUrl} />
          </label>
          <label className="input-label sm:col-span-2 xl:col-span-3">
            Audit note
            <textarea
              maxLength={1000}
              onChange={(event) => setAuditNote(event.currentTarget.value)}
              placeholder="Optional reason or source for this correction"
              rows={2}
              value={auditNote}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="admin-btn admin-btn--primary" disabled={isPending} type="submit">
            {isPending ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <Save aria-hidden="true" size={15} />}
            Save profile
          </button>
          {feedback ? (
            <p
              className={`portal-message ${feedback.tone === "error" ? "portal-message--error" : "portal-message--success"}`}
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function MemberEditorDialog({ children, dirty, email, memberName, membershipId, onClose, pending }: {
  children: (requestClose: () => void) => ReactNode;
  dirty: boolean;
  email: string | null;
  memberName: string;
  membershipId: string;
  onClose: () => void;
  pending: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const discardId = useId();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element?.showModal) element.showModal(); else element?.setAttribute("open", "");
    heading.current?.focus();
    return () => {
      if (element?.open && element.close) element.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (confirming) keepEditing.current?.focus();
    else heading.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!dirty) return;
    function preventUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  function requestClose() {
    if (pending) return;
    if (dirty) setConfirming(true);
    else onClose();
  }

  return (
    <dialog
      aria-labelledby={confirming ? discardId : titleId}
      aria-modal="true"
      className="member-editor-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirming) setConfirming(false); else requestClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          if (!pending) { if (confirming) setConfirming(false); else requestClose(); }
          return;
        }
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"))
          .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      ref={dialog}
      role={confirming ? "alertdialog" : "dialog"}
    >
      <div className="member-editor-dialog__header">
        <div className="min-w-0">
          <h2 id={titleId} ref={heading} tabIndex={-1}>Edit {memberName}</h2>
          <p>{membershipId} · {email || "No email"}</p>
        </div>
        {!confirming ? <button aria-label="Close member editor" className="ghost-button" disabled={pending} onClick={requestClose} type="button"><X aria-hidden="true" size={18} /><span>Close</span></button> : null}
      </div>
      {confirming ? (
        <section className="member-editor-dialog__confirmation">
          <h3 id={discardId}>Discard unsaved changes?</h3>
          <p>Your profile and account edits have not all been saved.</p>
          <div className="flex flex-wrap gap-3">
            <button className="admin-btn admin-btn--primary" onClick={() => setConfirming(false)} ref={keepEditing} type="button">Keep editing</button>
            <button className="admin-btn admin-btn--danger" disabled={pending} onClick={onClose} type="button">Discard changes</button>
          </div>
        </section>
      ) : null}
      <div hidden={confirming}>{children(requestClose)}</div>
    </dialog>
  );
}

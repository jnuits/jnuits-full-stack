"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  formatCertificateIssueDate,
  getCertificateDisplayName,
  getCertificateNarrative,
  getCertificateSubjectColumnLabel,
  getCertificateType,
} from "@/lib/certificates/presentation";
import {
  isValidCertificateId,
  normalizeCertificateId,
  type PublicCertificateRecord,
} from "@/lib/certificates/public-batch";

type VerificationOutcome =
  | { status: "idle" }
  | { status: "loading"; certificateId: string }
  | { status: "valid"; certificateId: string; certificate: PublicCertificateRecord }
  | { status: "missing"; certificateId: string }
  | { status: "invalid" }
  | { status: "unavailable"; certificateId: string };

function VerificationStateIcon({ tone }: { tone: "missing" | "valid" }) {
  return (
    <span className="certificate-state__icon" data-tone={tone} aria-hidden="true">
      {tone === "valid" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12.5 9.5 17 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M7.5 7.5 16.5 16.5" strokeLinecap="round" />
          <path d="m16.5 7.5-9 9" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function CertificateVerifyIsland() {
  const searchParams = useSearchParams();
  // null until the visitor edits the field; before that the input mirrors ?q=.
  const [typedValue, setTypedValue] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerificationOutcome>({ status: "idle" });
  const autoVerifyQueryRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<{
    controller: AbortController;
    sequence: number;
  } | null>(null);

  const verify = useCallback(async (rawId: string) => {
    const certificateId = normalizeCertificateId(rawId);
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    activeRequestRef.current?.controller.abort();

    if (!isValidCertificateId(certificateId)) {
      activeRequestRef.current = null;
      setOutcome({ status: "invalid" });
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = { controller, sequence };

    // Yield before the first setState so callers inside effects never
    // trigger a synchronous state update during the effect pass.
    await Promise.resolve();
    if (requestSequenceRef.current !== sequence) {
      return;
    }
    setOutcome({ status: "loading", certificateId });

    try {
      const response = await fetch("/api/certificates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [certificateId] }),
        signal: controller.signal,
      });

      if (requestSequenceRef.current !== sequence) {
        return;
      }

      if (!response.ok) {
        setOutcome({ status: "unavailable", certificateId });
        return;
      }

      const payload = (await response.json()) as {
        data?: Array<{
          certificateId: string;
          found: boolean;
          certificate: PublicCertificateRecord | null;
        }>;
      };
      const match = payload.data?.[0];

      if (match?.found && match.certificate) {
        setOutcome({
          status: "valid",
          certificateId: match.certificate.certificate_id,
          certificate: match.certificate,
        });
      } else {
        setOutcome({ status: "missing", certificateId });
      }
    } catch {
      if (
        controller.signal.aborted ||
        requestSequenceRef.current !== sequence
      ) {
        return;
      }
      setOutcome({ status: "unavailable", certificateId });
    } finally {
      if (activeRequestRef.current?.sequence === sequence) {
        activeRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => activeRequestRef.current?.controller.abort();
  }, []);

  useEffect(() => {
    const rawQuery =
      searchParams.get("q") ?? searchParams.get("certificateId") ?? "";

    if (!rawQuery || autoVerifyQueryRef.current === rawQuery) {
      return;
    }

    autoVerifyQueryRef.current = rawQuery;
    void verify(rawQuery);
  }, [searchParams, verify]);

  const queryId = normalizeCertificateId(
    searchParams.get("q") ?? searchParams.get("certificateId") ?? "",
  );
  const inputValue =
    typedValue ?? (isValidCertificateId(queryId) ? queryId : "");

  const certificate =
    outcome.status === "valid" ? outcome.certificate : null;
  const certificateName = certificate
    ? getCertificateDisplayName(certificate)
    : "";
  const certificateType = certificate ? getCertificateType(certificate) : null;
  const certificateNarrative = certificate
    ? getCertificateNarrative(certificate)
    : "";
  const certificateSubjectLabel = certificate
    ? getCertificateSubjectColumnLabel(certificate)
    : "Program";

  return (
    <>
      <form
        className="certificate-search-form"
        action="/certificates"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          void verify(inputValue);
        }}
      >
        <label className="sr-only" htmlFor="certificate-id-input">
          Certificate ID
        </label>
        <input
          id="certificate-id-input"
          name="q"
          value={inputValue}
          onChange={(event) => setTypedValue(event.target.value)}
          placeholder="Enter a certificate ID, e.g. 24007 or W25SPEAKUPPT065"
        />
        <button className="primary-button" type="submit">
          Verify
        </button>
      </form>

      {outcome.status === "loading" ? (
        <div className="certificate-result-card" aria-live="polite">
          <div className="certificate-state" data-tone="missing">
            <VerificationStateIcon tone="missing" />
            <div>
              <p className="certificate-state__title">Checking…</p>
              <p className="certificate-state__copy">
                Looking up <strong>{outcome.certificateId}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {outcome.status === "invalid" ? (
        <div className="certificate-result-card" role="alert">
          <div className="certificate-state" data-tone="missing">
            <VerificationStateIcon tone="missing" />
            <div>
              <p className="certificate-state__title">
                Enter a valid certificate ID.
              </p>
              <p className="certificate-state__copy">
                The field cannot be empty and must not contain control characters.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {outcome.status === "valid" && certificate ? (
        <div className="certificate-result-card">
          <div className="certificate-state" data-tone="valid">
            <VerificationStateIcon tone="valid" />
            <div>
              <p className="certificate-state__title">The certificate is valid.</p>
              <p className="certificate-state__copy">
                This verification record matches an issued JnUITS certificate.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="status-pill">Certificate found</span>
            {certificateType ? (
              <span className="detail-chip">{certificateType.label} certificate</span>
            ) : null}
          </div>

          <h2 className="mt-5 font-[family-name:var(--font-heading)] text-[clamp(2.2rem,4vw,3.35rem)] font-semibold leading-[0.96] tracking-[-0.05em] uppercase">
            {certificateName}
          </h2>
          <p className="mt-3 text-sm font-medium tracking-[0.01em] text-[var(--muted-foreground)]">
            {certificate.certificate_id} · {certificate.exam_or_event_name}
          </p>
          <p className="certificate-summary mt-6">{certificateNarrative}</p>

          <dl className="certificate-table mt-8">
            <div className="certificate-table__row">
              <dt>Name</dt>
              <dd>{certificateName}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Certificate ID</dt>
              <dd>{certificate.certificate_id}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>{certificateSubjectLabel}</dt>
              <dd>{certificate.exam_or_event_name}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Issued date</dt>
              <dd>{formatCertificateIssueDate(certificate.issue_date)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {outcome.status === "missing" ? (
        <div className="certificate-result-card">
          <div className="certificate-state" data-tone="missing">
            <VerificationStateIcon tone="missing" />
            <div>
              <p className="certificate-state__title">Certificate not found</p>
              <p className="certificate-state__copy">
                No certificate matched <strong>{outcome.certificateId}</strong>.
              </p>
            </div>
          </div>

          <p className="certificate-missing-copy mt-6">
            If you believe this is an error or if your certificate ID is valid but
            not found in our database, please contact us at{" "}
            <a href="mailto:info@jnuits.org.bd">info@jnuits.org.bd</a>.
          </p>
        </div>
      ) : null}

      {outcome.status === "unavailable" ? (
        <div className="certificate-result-card">
          <div className="certificate-state" data-tone="missing">
            <VerificationStateIcon tone="missing" />
            <div>
              <p className="certificate-state__title">
                Certificate verification is temporarily unavailable
              </p>
              <p className="certificate-state__copy">
                We could not complete the database lookup for{" "}
                <strong>{outcome.certificateId}</strong>. Please try again shortly.
              </p>
            </div>
          </div>

          <p className="certificate-missing-copy mt-6">
            If this keeps happening, contact us at{" "}
            <a href="mailto:info@jnuits.org.bd">info@jnuits.org.bd</a> with
            the certificate ID.
          </p>
        </div>
      ) : null}

      {outcome.status === "idle" ? (
        <div className="certificate-help-grid">
          <article className="route-tile">
            <h3>Certificate type</h3>
            <p>
              JnUITS currently verifies two public certificate categories:
              <strong> Course</strong> and <strong>Event</strong>.
            </p>
          </article>
          <article className="route-tile">
            <h3>Legacy QR compatibility</h3>
            <p>
              Older printed QR codes can keep pointing to
              ` /certificates?q=[certificateId]` without breaking verification.
            </p>
          </article>
          <article className="route-tile">
            <h3>Need the full page?</h3>
            <p>
              The verification detail route at ` /certificates/[certificateId]` still
              exists, but the public search page is now the primary response surface.
            </p>
          </article>
        </div>
      ) : null}
    </>
  );
}

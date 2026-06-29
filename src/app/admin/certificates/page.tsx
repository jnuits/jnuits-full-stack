import { cookies } from "next/headers";
import Link from "next/link";
import { AutoSubmitForm } from "@/components/admin/auto-submit-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  bulkImportCertificatesAction,
  deleteCertificateAction,
  fixCertTypeAction,
  upsertCertificateAction,
} from "@/app/admin/certificates/actions";
import { DeleteCertButton } from "@/app/admin/certificates/delete-cert-button";
import {
  Award,
  BookOpen,
  Calendar,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Hash,
  Layers,
  Link2,
  Plus,
  Search,
  ShieldAlert,
  Upload,
  User,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type CertRow = {
  id: string;
  certificate_id: string;
  first_name: string;
  last_name: string;
  details: string;
  exam_or_event: string;
  exam_or_event_name: string;
  issue_date: string;
  asset_url: string | null;
  created_at: string;
  updated_at: string;
};

type BatchRow = {
  id: string;
  source_name: string;
  status: string;
  source_row_count: number;
  inserted_count: number;
  updated_count: number;
  rejected_count: number;
  started_at: string;
  finished_at: string | null;
  report: Record<string, unknown> | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}



function batchStatusClass(status: string) {
  if (status === "completed") return "portal-badge--verified";
  if (status === "processing") return "portal-badge--pending";
  if (status === "failed") return "portal-badge--returned";
  return "portal-badge--draft";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export const metadata = { title: "Certificates | JnUITS Admin" };

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const sp = await searchParams;

  // ── Filters from URL ──
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filterType = typeof sp.type === "string" ? sp.type.trim() : "";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const editId = typeof sp.edit === "string" ? sp.edit : "";
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  // ── Queries ──
  let query = admin
    .from("certificates")
    .select("id, certificate_id, first_name, last_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url, created_at, updated_at", { count: "exact" });

  if (q) {
    query = query.or(
      `certificate_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,exam_or_event_name.ilike.%${q}%`
    );
  }
  if (filterType) {
    query = query.ilike("exam_or_event", filterType);
  }

  query = query.order("issue_date", { ascending: false }).range(offset, offset + pageSize - 1);

  const [certsResult, batchesResult] = await Promise.all([
    query,
    admin
      .from("certificate_import_batches")
      .select("id, source_name, status, source_row_count, inserted_count, updated_count, rejected_count, started_at, finished_at, report")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const certs = (certsResult.data || []) as CertRow[];
  const totalCount = certsResult.count ?? 0;
  const batches = (batchesResult.data || []) as BatchRow[];

  // Stats: counts by type
  const { data: typeStats } = await admin
    .from("certificates")
    .select("exam_or_event");
  const typeCounts = (typeStats || []).reduce<Record<string, number>>((acc, r) => {
    const k = (r.exam_or_event || "other").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Dirty cert types (not Exam/Event/Course)
  const dirtyCount = Object.entries(typeCounts)
    .filter(([k]) => !["exam", "event", "course"].includes(k))
    .reduce((s, [, v]) => s + v, 0);

  // Record selected for edit
  const editRecord = editId
    ? certs.find((c) => c.id === editId) ?? null
    : null;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="grid gap-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Certificates</p>
          <h1 className="admin-page-header__title">Certificate Registry</h1>
          <p className="admin-page-header__desc">
            Issue, search, edit, and bulk-import member certificates. Manage import batches and fix data quality issues.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {dirtyCount > 0 && (
            <span className="portal-badge portal-badge--pending">
              <ShieldAlert size={10} /> {dirtyCount} type fix{dirtyCount !== 1 ? "es" : ""} needed
            </span>
          )}
          <span className="portal-badge portal-badge--verified">
            <Database size={10} /> {totalCount} total
          </span>
        </div>
      </div>

      {/* ── Flash ───────────────────────────────────────────────────────────── */}
      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--muted-foreground)" }}>
            Operator feedback
          </p>
          <h2 style={{ marginTop: "0.35rem", fontFamily: "var(--font-heading)", fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
            {flash.title}
          </h2>
          <p style={{ marginTop: "0.3rem", fontSize: "0.88rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>{flash.message}</p>
        </section>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
            <div className="portal-stat-card__icon" style={{ width: "1.75rem", height: "1.75rem" }}><Award size={13} /></div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Total</p>
          </div>
          <p className="metric-card__value">{totalCount}</p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>All certificate records</p>
        </article>

        <article className="metric-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
            <div className="portal-stat-card__icon" style={{ width: "1.75rem", height: "1.75rem" }}><BookOpen size={13} /></div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Events</p>
          </div>
          <p className="metric-card__value">{typeCounts["event"] ?? 0}</p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>Event attendance certs</p>
        </article>

        <article className="metric-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
            <div className="portal-stat-card__icon" style={{ width: "1.75rem", height: "1.75rem" }}><FileCheck2 size={13} /></div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Exams</p>
          </div>
          <p className="metric-card__value">{typeCounts["exam"] ?? 0}</p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>Exam completion certs</p>
        </article>

        <article className="metric-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
            <div className="portal-stat-card__icon" style={{ width: "1.75rem", height: "1.75rem" }}><Layers size={13} /></div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Courses</p>
          </div>
          <p className="metric-card__value">{typeCounts["course"] ?? 0}</p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>Course completion certs</p>
        </article>

        <article className="metric-card" data-tone={dirtyCount > 0 ? "warn" : undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
            <div className="portal-stat-card__icon" style={{ width: "1.75rem", height: "1.75rem" }}><ShieldAlert size={13} /></div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Data issues</p>
          </div>
          <p className="metric-card__value">{dirtyCount}</p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>Unrecognised type values</p>
        </article>
      </section>

      {/* ── Forms row: Add cert + Bulk import ───────────────────────────────── */}
      <section style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))", alignItems: "start" }}>
        {/* Add / edit certificate */}
        <form action={upsertCertificateAction} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">{editRecord ? "Edit certificate" : "Add certificate"}</span>
            <h2 style={{ marginTop: "0.75rem", fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem,3vw,2.1rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
              {editRecord ? `Editing ${editRecord.certificate_id}` : "Issue a new certificate"}
            </h2>
            <p style={{ marginTop: "0.4rem", fontSize: "0.84rem", color: "var(--muted-foreground)", lineHeight: 1.65 }}>
              {editRecord
                ? "Modify any field below. The certificate ID cannot be changed — delete and re-add if needed."
                : "Create a single certificate record manually. For bulk imports, use the CSV panel."}
            </p>
          </div>

          {editRecord && <input name="id" type="hidden" value={editRecord.id} />}

          <div className="portal-form-grid">
            <label className="input-label" htmlFor="cert-id">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Hash size={11} /> Certificate ID *</span>
              <input
                id="cert-id"
                name="certificate_id"
                defaultValue={editRecord?.certificate_id ?? ""}
                placeholder="CERT-2026-001"
                required
                readOnly={!!editRecord}
                style={editRecord ? { opacity: 0.65, cursor: "not-allowed" } : undefined}
              />
            </label>

            <label className="input-label" htmlFor="cert-type">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><FileText size={11} /> Type *</span>
              <select id="cert-type" name="exam_or_event" defaultValue={editRecord?.exam_or_event ?? "Event"} required>
                <option value="Event">Event</option>
                <option value="Exam">Exam</option>
                <option value="Course">Course</option>
              </select>
            </label>

            <label className="input-label" htmlFor="cert-first">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><User size={11} /> First name *</span>
              <input id="cert-first" name="first_name" defaultValue={editRecord?.first_name ?? ""} placeholder="Mohammad" required />
            </label>

            <label className="input-label" htmlFor="cert-last">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><User size={11} /> Last name *</span>
              <input id="cert-last" name="last_name" defaultValue={editRecord?.last_name ?? ""} placeholder="Rahman" required />
            </label>

            <label className="input-label sm:col-span-2" htmlFor="cert-event-name">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><BookOpen size={11} /> Event / Exam / Course name *</span>
              <input
                id="cert-event-name"
                name="exam_or_event_name"
                defaultValue={editRecord?.exam_or_event_name ?? ""}
                placeholder="Speak Up: Interactive Public Speaking Workshop"
                required
              />
            </label>

            <label className="input-label" htmlFor="cert-date">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Calendar size={11} /> Issue date *</span>
              <input
                id="cert-date"
                name="issue_date"
                type="date"
                defaultValue={editRecord?.issue_date ? editRecord.issue_date.slice(0, 10) : ""}
                required
              />
            </label>

            <label className="input-label" htmlFor="cert-details">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><FileText size={11} /> Details</span>
              <input id="cert-details" name="details" defaultValue={editRecord?.details ?? ""} placeholder="Optional additional info" />
            </label>

            <label className="input-label sm:col-span-2" htmlFor="cert-asset">
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Link2 size={11} /> Asset URL</span>
              <input id="cert-asset" name="asset_url" defaultValue={editRecord?.asset_url ?? ""} placeholder="https://…/cert.pdf" type="url" />
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <button className="primary-button" type="submit">
              <Plus size={14} /> {editRecord ? "Save changes" : "Create certificate"}
            </button>
            {editRecord && (
              <Link href="/admin/certificates" className="secondary-button">Cancel edit</Link>
            )}
          </div>
        </form>

        {/* Bulk CSV import */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <form action={bulkImportCertificatesAction} className="section-band grid gap-4">
            <div>
              <span className="eyebrow">Bulk import</span>
              <h2 style={{ marginTop: "0.75rem", fontFamily: "var(--font-heading)", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                CSV certificate import
              </h2>
              <p style={{ marginTop: "0.4rem", fontSize: "0.84rem", color: "var(--muted-foreground)", lineHeight: 1.65 }}>
                Paste CSV rows below. Each row must contain 6–7 columns in this order:
              </p>
              <div className="portal-info-row" style={{ marginTop: "0.65rem" }}>
                <span className="portal-info-row__label">Expected columns</span>
                <code style={{ fontSize: "0.74rem", lineHeight: 1.6, color: "var(--foreground)", fontFamily: "var(--font-mono)" }}>
                  certId, firstName, lastName, type, eventName, issueDate, assetUrl?
                </code>
              </div>
            </div>

            <div className="portal-form-grid">
              <label className="input-label" htmlFor="import-source">
                <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Database size={11} /> Batch source name</span>
                <input
                  id="import-source"
                  name="source_name"
                  placeholder={`manual-import-${new Date().toISOString().slice(0, 10)}`}
                />
              </label>

              <label className="input-label" htmlFor="import-conflict">
                On duplicate cert ID
                <select id="import-conflict" name="on_conflict" defaultValue="skip">
                  <option value="skip">Skip (keep existing)</option>
                  <option value="update">Overwrite existing</option>
                </select>
              </label>

              <label className="input-label sm:col-span-2" htmlFor="import-csv">
                CSV data *
                <textarea
                  id="import-csv"
                  name="csv_data"
                  rows={10}
                  placeholder={"CERT-2026-001,Mohammad,Rahman,Event,Speak Up Workshop,2026-01-15\nCERT-2026-002,Ayesha,Khan,Exam,Basic Computer Course,2026-02-20,https://…/cert.pdf"}
                  required
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}
                />
              </label>
            </div>

            <button className="primary-button" type="submit">
              <Upload size={14} /> Import certificates
            </button>
          </form>

          {/* Import batches history */}
          <div className="section-band grid gap-3">
            <div>
              <span className="eyebrow">Import history</span>
              <h2 style={{ marginTop: "0.65rem", fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
                Recent batches
              </h2>
            </div>

            {batches.length === 0 ? (
              <div className="empty-state">No import batches found.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {batches.map((batch) => (
                  <div key={batch.id} className="portal-draft-card">
                    <div className="portal-draft-card__header">
                      <p className="portal-draft-card__title" style={{ fontSize: "0.82rem" }}>{batch.source_name}</p>
                      <span className={`portal-badge ${batchStatusClass(batch.status)}`}>{batch.status}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem" }}>
                      <span className="detail-chip"><Download size={9} /> {batch.inserted_count} inserted</span>
                      {batch.updated_count > 0 && <span className="detail-chip">{batch.updated_count} updated</span>}
                      {batch.rejected_count > 0 && <span className="detail-chip" style={{ color: "var(--brand-rust)" }}>{batch.rejected_count} rejected</span>}
                      <span className="detail-chip">{batch.source_row_count} rows</span>
                    </div>
                    <div className="portal-draft-card__footer">
                      <span className="portal-draft-card__date">{fmtDate(batch.started_at)}</span>
                      {batch.finished_at && (
                        <span className="portal-draft-card__date">{fmtDate(batch.finished_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Search + Filter bar ──────────────────────────────────────────────── */}
      <section className="section-band">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div>
            <span className="eyebrow">Certificate registry</span>
            <h2 style={{ marginTop: "0.65rem", fontFamily: "var(--font-heading)", fontSize: "clamp(1.7rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
              Browse &amp; manage certificates
            </h2>
            {(q || filterType) && (
              <p style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted-foreground)" }}>
                Showing {certs.length} of {totalCount} results
                {q ? ` matching "${q}"` : ""}
                {filterType ? ` — type: ${filterType}` : ""}
              </p>
            )}
          </div>
          <Link
            href="/certificates"
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <ExternalLink size={13} /> Public verification
          </Link>
        </div>

        {/* Search & filter form */}
        <AutoSubmitForm action="/admin/certificates" className="admin-filter-form">
          <div className="admin-filter-grid">
          <label className="input-label" htmlFor="cert-search" style={{ position: "relative" }}>
            <input
              id="cert-search"
              name="q"
              defaultValue={q}
              placeholder="Search by certificate ID, name, or event…"
              style={{ paddingLeft: "2.2rem" }}
            />
            <Search
              size={13}
              style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }}
            />
          </label>

          <label className="input-label" htmlFor="type-filter">
            <select id="type-filter" name="type" defaultValue={filterType}>
              <option value="">All types</option>
              <option value="Event">Event</option>
              <option value="Exam">Exam</option>
              <option value="Course">Course</option>
            </select>
          </label>

          {(q || filterType) && (
            <Link href="/admin/certificates" className="ghost-button" style={{ textAlign: "center", fontSize: "0.82rem" }}>
              Clear filters
            </Link>
          )}
          </div>
        </AutoSubmitForm>
      </section>

      {/* ── Certificate table ────────────────────────────────────────────────── */}
      <section className="section-band" style={{ padding: 0, overflow: "hidden" }}>
        <div className="admin-responsive-table-shell" style={{ overflowX: "auto" }}>
          <table className="admin-responsive-table" style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.82rem",
          }}>
            <thead>
              <tr style={{ background: "color-mix(in oklab, var(--panel) 72%, transparent)", borderBottom: "1px solid var(--line)" }}>
                {["Certificate ID", "Name", "Type", "Event / Exam", "Issue Date", "Asset", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--muted-foreground)", fontSize: "0.88rem" }}>
                    {q || filterType ? "No certificates match your search criteria." : "No certificates found in the database."}
                  </td>
                </tr>
              ) : (
                certs.map((cert, idx) => {
                  const isOdd = idx % 2 === 0;
                  const isDirty = !["exam", "event", "course"].includes(cert.exam_or_event.toLowerCase());
                  return (
                    <tr
                      key={cert.id}
                      style={{
                        background: isOdd
                          ? "color-mix(in oklab, var(--card) 95%, transparent)"
                          : "color-mix(in oklab, var(--panel) 55%, transparent)",
                        borderBottom: "1px solid var(--line)",
                        transition: "background 120ms",
                      }}
                    >
                      {/* Cert ID */}
                      <td data-label="Certificate ID" style={{ padding: "0.7rem 1rem" }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 700, color: "var(--brand-blue)" }}>
                          {cert.certificate_id}
                        </code>
                      </td>

                      {/* Name */}
                      <td data-label="Name" style={{ padding: "0.7rem 1rem", fontWeight: 600 }}>
                        {cert.first_name} {cert.last_name}
                      </td>

                      {/* Type */}
                      <td data-label="Type" style={{ padding: "0.7rem 1rem" }}>
                        {isDirty ? (
                          <form action={fixCertTypeAction} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <input type="hidden" name="id" value={cert.id} />
                            <select
                              name="exam_or_event"
                              defaultValue="Event"
                              style={{ fontSize: "0.72rem", padding: "0.2rem 0.4rem", borderRadius: "0.4rem" }}
                            >
                              <option value="Event">Event</option>
                              <option value="Exam">Exam</option>
                              <option value="Course">Course</option>
                            </select>
                            <button
                              type="submit"
                              title="Fix type"
                              style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brand-rust)", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Fix
                            </button>
                          </form>
                        ) : (
                          <span
                            className="portal-badge"
                            style={{
                              background: cert.exam_or_event.toLowerCase() === "event"
                                ? "color-mix(in oklab, var(--brand-blue) 10%, transparent)"
                                : cert.exam_or_event.toLowerCase() === "exam"
                                  ? "color-mix(in oklab, var(--brand-green) 10%, transparent)"
                                  : "color-mix(in oklab, var(--brand-gold) 10%, transparent)",
                              color: cert.exam_or_event.toLowerCase() === "event"
                                ? "var(--brand-blue)"
                                : cert.exam_or_event.toLowerCase() === "exam"
                                  ? "var(--brand-green)"
                                  : "color-mix(in oklab, var(--brand-gold) 80%, var(--foreground))",
                              borderColor: "transparent",
                            }}
                          >
                            {cert.exam_or_event}
                          </span>
                        )}
                      </td>

                      {/* Event name */}
                      <td data-label="Event / Exam" style={{ padding: "0.7rem 1rem", maxWidth: "18rem" }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5, color: "var(--muted-foreground)" }}>
                          {cert.exam_or_event_name}
                        </span>
                      </td>

                      {/* Issue date */}
                      <td data-label="Issue Date" style={{ padding: "0.7rem 1rem", whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <Calendar size={11} /> {fmtDate(cert.issue_date)}
                        </span>
                      </td>

                      {/* Asset URL */}
                      <td data-label="Asset" style={{ padding: "0.7rem 1rem" }}>
                        {cert.asset_url ? (
                          <a
                            href={cert.asset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="queue-link"
                            title={cert.asset_url}
                            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <ExternalLink size={11} /> PDF
                          </a>
                        ) : (
                          <span style={{ color: "var(--muted-foreground)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" style={{ padding: "0.7rem 1rem" }}>
                        <div className="admin-action-row" style={{ gap: "0.5rem" }}>
                          <Link
                            href={`/admin/certificates?edit=${cert.id}#add-form`}
                            className="ghost-button"
                            style={{ padding: "0.3rem 0.65rem", fontSize: "0.74rem", minHeight: "auto", borderRadius: "0.5rem" }}
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/certificates?id=${cert.certificate_id}`}
                            target="_blank"
                            className="ghost-button"
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.74rem", minHeight: "auto", borderRadius: "0.5rem" }}
                            title="Verify publicly"
                          >
                            <ExternalLink size={11} />
                          </Link>
                          <DeleteCertButton
                            formAction={deleteCertificateAction}
                            certId={cert.id}
                            displayId={cert.certificate_id}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.8rem 1.25rem",
            borderTop: "1px solid var(--line)",
            background: "color-mix(in oklab, var(--panel) 55%, transparent)",
          }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", fontWeight: 600 }}>
              Page {page} of {totalPages} · {totalCount} total records
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {page > 1 && (
                <Link
                  href={`/admin/certificates?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${filterType ? `&type=${filterType}` : ""}`}
                  className="ghost-button"
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem", minHeight: "auto" }}
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/certificates?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${filterType ? `&type=${filterType}` : ""}`}
                  className="ghost-button"
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem", minHeight: "auto" }}
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Data quality panel ──────────────────────────────────────────────── */}
      {dirtyCount > 0 && (
        <section className="section-band">
          <div>
            <span className="eyebrow">Data quality</span>
            <h2 style={{ marginTop: "0.65rem", fontFamily: "var(--font-heading)", fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
              Unrecognised certificate types
            </h2>
            <p style={{ marginTop: "0.4rem", fontSize: "0.84rem", color: "var(--muted-foreground)", lineHeight: 1.65 }}>
              {dirtyCount} certificates have an <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>exam_or_event</code> value
              that is not <strong>Event</strong>, <strong>Exam</strong>, or <strong>Course</strong>. Use the inline fix controls in the table above, or filter by type to batch-review them.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.5rem" }}>
            {Object.entries(typeCounts)
              .filter(([k]) => !["exam", "event", "course"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="portal-info-row" style={{ padding: "0.55rem 0.85rem" }}>
                  <span className="portal-info-row__label">type value</span>
                  <span className="portal-info-row__value">
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>&quot;{k}&quot;</code>{" "}
                    <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem" }}>({v} records)</span>
                  </span>
                </div>
              ))}

            <Link
              href="/admin/certificates?type=Valid+Upto"
              className="secondary-button"
              style={{ alignSelf: "center" }}
            >
              <Search size={13} /> Filter by unknown type
            </Link>
          </div>
        </section>
      )}

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="route-tile">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><ExternalLink size={14} /> Public certificate verification</h3>
          <p>Members and employers can verify certificates at the public portal.</p>
          <Link href="/certificates" target="_blank" className="queue-link" style={{ marginTop: "0.5rem", display: "inline-flex" }}>
            Open verification page ↗
          </Link>
        </div>
        <div className="route-tile">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><Database size={14} /> Import format reference</h3>
          <p>CSV column order: <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>certId, firstName, lastName, type, eventName, issueDate, assetUrl?</code></p>
          <p style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted-foreground)" }}>Types: Event · Exam · Course. Dates: YYYY-MM-DD.</p>
        </div>
      </section>
    </div>
  );
}

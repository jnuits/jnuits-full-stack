import Link from "next/link";
import { CalendarDays, LinkIcon, Lock, Save } from "lucide-react";
import { NoticeEditorSaveIndicator } from "@/components/admin/notice-editor-save-indicator";
import { NoticeMarkdownEditor } from "@/components/admin/notice-markdown-editor";
import { NoticePdfUploadField } from "@/components/admin/notice-pdf-upload-field";
import { NoticeSummaryField } from "@/components/admin/notice-summary-field";
import { saveNotice } from "./actions";
import type { AdminNoticeListItem } from "@/lib/content/notices";

type NoticeEditorFormProps = {
  initialSaved?: boolean;
  notice: AdminNoticeListItem | null;
};

const baseCategoryOptions = ["Notice", "Announcement", "Decision", "Membership", "Event"];

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function normalizeNoticeStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "published" || normalized === "archived") {
    return normalized;
  }

  return "draft";
}

export function NoticeEditorForm({
  initialSaved = false,
  notice,
}: NoticeEditorFormProps) {
  const categoryOptions = Array.from(
    new Set([
      ...baseCategoryOptions,
      ...(notice?.category ? [notice.category] : []),
    ])
  );
  const isAutoSlug = !notice?.slug;
  const statusValue = normalizeNoticeStatus(notice?.status);

  return (
    <form action={saveNotice} className="notice-editor">
      <input name="noticeId" type="hidden" value={notice?.id || ""} />

      <header className="admin-page-header admin-page-header--event-editor notice-editor__header">
        <div>
          <p className="admin-page-header__breadcrumb">
            Admin / Content / Notices / {notice ? "Edit" : "New"}
          </p>
          <h1 className="admin-page-header__title">
            {notice ? "Edit notice" : "New notice"}
          </h1>
          <p className="admin-page-header__desc">
            Publish official announcements with stable public routes and clear
            dates.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <Link className="admin-btn admin-btn--ghost" href="/admin/content/notices">
            Back to notices
          </Link>
          <button className="admin-btn admin-btn--primary" type="submit">
            <Save aria-hidden="true" size={15} />
            Save notice
          </button>
        </div>
      </header>

      <section className="notice-editor-card notice-editor-card--identity">
        <p className="notice-editor-card__eyebrow">Identity & status</p>
        <label className="notice-editor-field notice-editor-field--title">
          <span>Title *</span>
          <input
            className="notice-admin-field notice-editor-title-field"
            defaultValue={notice?.title || ""}
            maxLength={220}
            name="title"
            placeholder="Official notice title"
            required
          />
        </label>

        <div className="notice-editor-grid notice-editor-grid--slug-status">
          <label className="notice-editor-field">
            <span>Slug</span>
            <input
              className="notice-admin-field notice-admin-field--mono"
              defaultValue={notice?.slug || ""}
              maxLength={180}
              name="slug"
              placeholder="generated-from-title"
            />
            <small>
              <Lock aria-hidden="true" size={12} />
              {isAutoSlug
                ? "Auto-generated from title when left empty"
                : "Edit only when the public route must change"}
            </small>
          </label>

          <label className="notice-editor-field">
            <span>Status</span>
            <select
              className="notice-admin-field notice-editor-status-select"
              defaultValue={statusValue}
              key={`${notice?.id || "new"}-${statusValue}`}
              name="status"
            >
              <option value="published">● Published</option>
              <option value="draft">● Draft</option>
              <option value="archived">● Archived</option>
            </select>
          </label>
        </div>
      </section>

      <section className="notice-editor-card">
        <p className="notice-editor-card__eyebrow">Classification & metadata</p>
        <div className="notice-editor-grid notice-editor-grid--two">
          <label className="notice-editor-field">
            <span>Category</span>
            <select
              className="notice-admin-field"
              defaultValue={notice?.category || "Notice"}
              name="category"
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="notice-editor-field">
            <span>Published date</span>
            <div className="notice-editor-input-with-icon">
              <CalendarDays aria-hidden="true" size={15} />
              <input
                className="notice-admin-field"
                defaultValue={toDateTimeLocal(notice?.publishedAt || null)}
                name="publishedAt"
                type="datetime-local"
              />
            </div>
          </label>
        </div>

        <label className="notice-editor-field">
          <span>Related link or attachment URL</span>
          <div className="notice-editor-input-with-icon">
            <LinkIcon aria-hidden="true" size={15} />
            <input
              className="notice-admin-field"
              defaultValue={notice?.ctaHref || ""}
              maxLength={1000}
              name="ctaHref"
              placeholder="https://... or /internal-route"
            />
          </div>
          <small>Use a full URL for external attachments or a local route path.</small>
        </label>

        <label className="notice-editor-field">
          <span>PDF notice attachment</span>
          <NoticePdfUploadField />
          <small>
            Uploads to Cloudinary folder jnuits/jnuits-full-stack/notices. A
            new PDF replaces the related link field on save.
          </small>
        </label>
      </section>

      <section className="notice-editor-card">
        <p className="notice-editor-card__eyebrow">Content</p>
        <NoticeSummaryField defaultValue={notice?.summary || ""} />

        <label className="notice-editor-field">
          <span>Notice body</span>
          <NoticeMarkdownEditor
            defaultValue={notice?.body || ""}
            name="body"
            placeholder={"## Notice details\n\nWrite the full notice using Markdown."}
          />
        </label>
      </section>

      <div className="notice-editor__footer">
        <NoticeEditorSaveIndicator initialSaved={initialSaved} />
        <div className="notice-editor__footer-actions">
          <Link className="admin-btn admin-btn--ghost" href="/admin/content/notices">
            Cancel
          </Link>
          <button className="admin-btn admin-btn--primary" type="submit">
            <Save aria-hidden="true" size={15} />
            Save notice
          </button>
        </div>
      </div>
    </form>
  );
}

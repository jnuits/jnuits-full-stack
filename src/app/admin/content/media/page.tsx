import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { saveMediaAsset } from "@/app/admin/content/actions";
import {
  moveMediaAssetToTrashAction,
  restoreMediaAssetFromTrashAction,
} from "@/app/admin/content/media/actions";
import { CloudinaryUploadPanel } from "@/components/admin/cloudinary-upload-panel";
import {
  getCloudinaryPublicConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary/config";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import { AlertCircle, Image as ImageIcon, RotateCcw, Trash2, Upload } from "lucide-react";

type MediaAssetOption = {
  deleted_at: string | null;
  id: string;
  media_kind: string;
  public_id: string;
  resource_type: string;
  secure_url: string;
  title: string | null;
  trash_restore_deadline: string | null;
};

export const metadata = { title: "Media & Assets — Admin | JnUITS" };

export default async function MediaPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const cloudinaryConfigured = isCloudinaryConfigured();
  const cloudinaryConfig = cloudinaryConfigured ? getCloudinaryPublicConfig() : null;

  const mediaResult = await admin
    .from("media_assets")
    .select(
      "id, title, public_id, media_kind, resource_type, secure_url, deleted_at, trash_restore_deadline"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const media = (mediaResult.data || []) as MediaAssetOption[];

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Media &amp; Assets</h1>
          <p className="admin-page-header__desc">
            Upload photos and videos directly to Cloudinary. All new assets are registered in Supabase so they can be linked to posts, gallery entries, and page content.
          </p>
        </div>
        <span className={`abadge ${cloudinaryConfigured ? "abadge--active" : "abadge--draft"}`}>
          {cloudinaryConfigured ? "Cloudinary ready" : "Cloudinary not configured"}
        </span>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {!cloudinaryConfigured && (
        <div className="admin-review-card" style={{ borderLeft: "3px solid var(--brand-gold)" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <AlertCircle size={18} style={{ color: "var(--brand-gold)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="font-semibold text-sm">Cloudinary environment not configured</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_SECRET to enable direct uploads.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Direct upload panel */}
      <CloudinaryUploadPanel
        cloudName={cloudinaryConfig?.cloudName || "unconfigured"}
        configured={cloudinaryConfigured}
        defaultFolder={CLOUDINARY_PROJECT_ROOT_FOLDER}
      />

      {/* Manual register form */}
      <section>
        <p className="admin-section-label">Register existing Cloudinary asset</p>
        <div className="admin-review-card">
          <form action={saveMediaAsset} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Title
                <input name="title" placeholder="Workshop cover image" />
              </label>
              <label className="input-label">
                Public ID
                <input name="publicId" placeholder="jnuits/events/cover" required />
              </label>
              <label className="input-label">
                Media kind
                <select defaultValue="image" name="mediaKind">
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="input-label">
                Resource type
                <input defaultValue="image" name="resourceType" placeholder="image or video" required />
              </label>
              <label className="input-label sm:col-span-2">
                Secure URL
                <input name="secureUrl" placeholder="https://res.cloudinary.com/..." required />
              </label>
              <label className="input-label sm:col-span-2">
                Alt text
                <input name="altText" placeholder="Accessible description" />
              </label>
              <label className="input-label">
                Width
                <input name="width" type="number" />
              </label>
              <label className="input-label">
                Height
                <input name="height" type="number" />
              </label>
              <label className="input-label">
                Public visibility
                <select defaultValue="true" name="isPublic">
                  <option value="true">Public</option>
                  <option value="false">Internal only</option>
                </select>
              </label>
              <label className="input-label">
                Format
                <input name="format" placeholder="jpg, webp, mp4" />
              </label>
            </div>
            <div>
              <button className="admin-btn admin-btn--primary" type="submit">
                <Upload size={14} /> Save media asset
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Asset library */}
      <section>
        <p className="admin-section-label">Registered assets ({media.length})</p>
        {media.length === 0 ? (
          <div className="admin-review-card" style={{ textAlign: "center", padding: "2rem" }}>
            <ImageIcon size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
            <p className="text-sm font-semibold">No media registered yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              Upload via the panel above or register an existing Cloudinary asset manually.
            </p>
          </div>
        ) : (
          <div className="admin-card-list">
            {media.slice(0, 6).map((asset) => (
              <div key={asset.id} className="admin-card-row">
                <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                  <ImageIcon size={16} />
                </div>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{asset.title || asset.public_id}</p>
                  <p className="admin-card-row__meta">{asset.public_id}</p>
                  {asset.deleted_at ? (
                    <p className="admin-card-row__meta">
                      Restore window:{" "}
                      {asset.trash_restore_deadline
                        ? new Date(asset.trash_restore_deadline).toLocaleDateString("en-GB")
                        : "manual review required"}
                    </p>
                  ) : null}
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge ${asset.deleted_at ? "abadge--draft" : "abadge--active"}`}>
                    {asset.deleted_at ? "In trash" : asset.media_kind}
                  </span>
                  {asset.deleted_at ? (
                    <form action={restoreMediaAssetFromTrashAction}>
                      <input name="assetId" type="hidden" value={asset.id} />
                      <button className="admin-btn admin-btn--secondary" type="submit">
                        <RotateCcw size={14} /> Restore
                      </button>
                    </form>
                  ) : (
                    <form action={moveMediaAssetToTrashAction}>
                      <input name="assetId" type="hidden" value={asset.id} />
                      <button className="admin-btn admin-btn--secondary" type="submit">
                        <Trash2 size={14} /> Move to trash
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {media.length > 6 && (
              <details className="admin-expandable-details mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)] py-1 hover:underline">
                  Show {media.length - 6} more registered assets
                </summary>
                <div className="admin-card-list mt-2">
                  {media.slice(6).map((asset) => (
                    <div key={asset.id} className="admin-card-row">
                      <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                        <ImageIcon size={16} />
                      </div>
                      <div className="admin-card-row__body">
                        <p className="admin-card-row__title">{asset.title || asset.public_id}</p>
                        <p className="admin-card-row__meta">{asset.public_id}</p>
                        {asset.deleted_at ? (
                          <p className="admin-card-row__meta">
                            Restore window:{" "}
                            {asset.trash_restore_deadline
                              ? new Date(asset.trash_restore_deadline).toLocaleDateString("en-GB")
                              : "manual review required"}
                          </p>
                        ) : null}
                      </div>
                      <div className="admin-card-row__actions">
                        <span className={`abadge ${asset.deleted_at ? "abadge--draft" : "abadge--active"}`}>
                          {asset.deleted_at ? "In trash" : asset.media_kind}
                        </span>
                        {asset.deleted_at ? (
                          <form action={restoreMediaAssetFromTrashAction}>
                            <input name="assetId" type="hidden" value={asset.id} />
                            <button className="admin-btn admin-btn--secondary" type="submit">
                              <RotateCcw size={14} /> Restore
                            </button>
                          </form>
                        ) : (
                          <form action={moveMediaAssetToTrashAction}>
                            <input name="assetId" type="hidden" value={asset.id} />
                            <button className="admin-btn admin-btn--secondary" type="submit">
                              <Trash2 size={14} /> Move to trash
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

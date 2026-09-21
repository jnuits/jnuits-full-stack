import { cookies } from "next/headers";

import {
  commitBulkOperationAction,
  previewBulkOperationAction,
} from "@/app/admin/bulk-operations/actions";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type BulkOperationRecord = {
  id: string;
  operation_type: string;
  status: string;
  original_filename: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  committed_rows: number;
  created_at: string;
};

type BulkRowRecord = {
  id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  status: string;
  errors: string[];
  result: Record<string, unknown>;
};

export const metadata = { title: "Bulk Operations | JnUITS Admin" };

export default async function AdminBulkOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("admin.bulk.manage", {
    fallbackPath: "/admin",
  });
  const params = await searchParams;
  const operationId = typeof params.operationId === "string" ? params.operationId : "";
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [{ data: operationsData }, selectedResult] = await Promise.all([
    flexibleAdmin
      .from("bulk_operations" as string)
      .select(
        "id, operation_type, status, original_filename, total_rows, valid_rows, error_rows, committed_rows, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(15),
    operationId
      ? flexibleAdmin
          .from("bulk_operation_rows" as string)
          .select("id, row_number, raw_data, normalized_data, status, errors, result")
          .eq("operation_id", operationId)
          .order("row_number", { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const operations = (operationsData || []) as BulkOperationRecord[];
  const selectedOperation =
    operations.find((operation) => operation.id === operationId) || null;
  const selectedRows = (selectedResult.data || []) as BulkRowRecord[];

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Bulk Operations</p>
          <h1 className="admin-page-header__title">Preview and commit CSV operations</h1>
          <p className="admin-page-header__desc">
            CSV rows are validated into a staged preview before any member, role, or invitation data changes.
          </p>
        </div>
        <span className="status-pill">{operations.length} recent</span>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="section-band">
        <form action={previewBulkOperationAction} className="grid gap-4">
          <div className="portal-form-grid">
            <label className="input-label">
              Operation type
              <select name="operationType" required>
                <option value="legacy_member_import">Legacy member import</option>
                <option value="member_invite">Member invite</option>
                <option value="alumni_invite">Alumni invite</option>
                <option value="lifecycle_update">Lifecycle update</option>
                <option value="role_update">Portal role update</option>
                <option value="alumni_conversion">Alumni conversion</option>
                <option value="account_deletion_review">Account deletion review</option>
              </select>
            </label>
            <label className="input-label">
              Legacy/year block
              <input defaultValue="0000" maxLength={4} name="legacyYearBlock" />
            </label>
            <label className="input-label sm:col-span-2">
              Filename label
              <input defaultValue="bulk-upload.csv" name="originalFilename" />
            </label>
          </div>
          <label className="input-label">
            CSV content
            <textarea
              name="csvContent"
              placeholder={"full_name,email,member_type\\nFormer Member,former@example.com,former"}
              required
              rows={12}
            />
          </label>
          <button className="primary-button" type="submit">
            Preview CSV
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="section-band">
          <span className="eyebrow">Recent previews</span>
          <div className="mt-5 grid gap-3">
            {operations.length === 0 ? (
              <div className="empty-state">No bulk operations staged yet.</div>
            ) : (
              <>
                {operations.slice(0, 5).map((operation) => (
                  <a
                    key={operation.id}
                    className="route-tile"
                    href={`/admin/bulk-operations?operationId=${operation.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3>{operation.operation_type.replaceAll("_", " ")}</h3>
                        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                          {operation.original_filename || "CSV"} • {operation.created_at.slice(0, 10)}
                        </p>
                      </div>
                      <span className="status-pill">{operation.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="detail-chip">{operation.total_rows} total</span>
                      <span className="detail-chip">{operation.valid_rows} valid</span>
                      <span className="detail-chip">{operation.error_rows} errors</span>
                      <span className="detail-chip">{operation.committed_rows} committed</span>
                    </div>
                  </a>
                ))}
                {operations.length > 5 && (
                  <details className="admin-expandable-details mt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)] py-1 hover:underline">
                      Show {operations.length - 5} older previews
                    </summary>
                    <div className="mt-3 grid gap-3">
                      {operations.slice(5).map((operation) => (
                        <a
                          key={operation.id}
                          className="route-tile"
                          href={`/admin/bulk-operations?operationId=${operation.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3>{operation.operation_type.replaceAll("_", " ")}</h3>
                              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                                {operation.original_filename || "CSV"} • {operation.created_at.slice(0, 10)}
                              </p>
                            </div>
                            <span className="status-pill">{operation.status}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="detail-chip">{operation.total_rows} total</span>
                            <span className="detail-chip">{operation.valid_rows} valid</span>
                            <span className="detail-chip">{operation.error_rows} errors</span>
                            <span className="detail-chip">{operation.committed_rows} committed</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>

        <div className="section-band">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Selected preview</span>
              <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.5rem)] leading-[0.96] tracking-[-0.04em]">
                {selectedOperation
                  ? selectedOperation.operation_type.replaceAll("_", " ")
                  : "No operation selected"}
              </h2>
            </div>
            {selectedOperation ? (
              <form action={commitBulkOperationAction}>
                <input name="operationId" type="hidden" value={selectedOperation.id} />
                <button
                  className="primary-button"
                  disabled={
                    selectedOperation.status !== "previewed" ||
                    selectedOperation.error_rows > 0
                  }
                  type="submit"
                >
                  Commit valid preview
                </button>
              </form>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3">
            {selectedRows.length === 0 ? (
              <div className="empty-state">Select a preview to inspect rows.</div>
            ) : (
              <>
                {selectedRows.slice(0, 5).map((row) => (
                  <article key={row.id} className="application-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-[family-name:var(--font-heading)] text-[1.25rem]">
                          Row {row.row_number}
                        </h3>
                        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                          {JSON.stringify(row.normalized_data)}
                        </p>
                      </div>
                      <span className="status-pill">{row.status}</span>
                    </div>
                    {row.errors.length > 0 ? (
                      <ul className="mt-3 grid gap-1 text-sm text-[var(--brand-rust)]">
                        {row.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
                {selectedRows.length > 5 && (
                  <details className="admin-expandable-details mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)] py-1 hover:underline">
                      Show remaining {selectedRows.length - 5} preview rows
                    </summary>
                    <div className="mt-3 grid gap-3">
                      {selectedRows.slice(5).map((row) => (
                        <article key={row.id} className="application-card">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-[family-name:var(--font-heading)] text-[1.25rem]">
                                Row {row.row_number}
                              </h3>
                              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                                {JSON.stringify(row.normalized_data)}
                              </p>
                            </div>
                            <span className="status-pill">{row.status}</span>
                          </div>
                          {row.errors.length > 0 ? (
                            <ul className="mt-3 grid gap-1 text-sm text-[var(--brand-rust)]">
                              {row.errors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

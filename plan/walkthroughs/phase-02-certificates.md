# Phase 02: Certificates

## Goal

Ship the first complete vertical slice: certificate import staging, upsert, parity reporting, and public verification.

## Implementation checklist

- Keep the public routes `/certificates` and `/certificates/[certificateId]`.
- Keep `POST /api/certificates/batch` and `GET /api/certificates/view/[id]`.
- Use `certificate_import_batches` and `certificates_import_staging` for imports.
- Keep `certificate_id` as the idempotent upsert key.
- Store import reports under `artifacts/reports/certificates/`.

## Verification checklist

- Run `npm run certificates:import -- --file <csv> --dry-run`
- Run `npm run certificates:import -- --file <csv> --apply`
- Run `npm run certificates:verify -- --file <csv>`
- Confirm inserted/updated/rejected counts land in the batch record.
- Confirm sampled public certificate lookups resolve correctly.

## Test data or fixture needs

- The legacy import-ready certificate CSV
- At least five sampled certificate IDs for public spot checks

## Acceptance gate

The import report and parity report both match the source CSV expectations, and public verification works without relying on Strapi.

## Rollback or recovery notes

If an apply run is bad, capture the batch ID, export the affected rows, and repair with a new controlled import batch instead of editing rows ad hoc.

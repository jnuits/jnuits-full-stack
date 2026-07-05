# Admin Responsive UI Checklist

This checklist keeps admin UI changes consistent across the operator workspace without adding UI packages.

## Viewports

Verify each changed admin page at these widths:

- 375px mobile
- 768px tablet
- 1280px desktop
- 1536px wide desktop

## Required Checks

- No unintended page-level horizontal overflow.
- Sidebar drawer opens, closes, and does not hide primary actions on mobile.
- Topbar actions fit without overlapping the page title.
- Search/filter controls wrap or auto-submit without oversized Apply buttons.
- Desktop tables remain dense; mobile tables render as stacked cards with visible field labels.
- Long emails, IDs, URLs, slugs, and notes wrap safely.
- Primary actions remain keyboard reachable with visible focus states.
- Empty states include a clear next action or explanation.
- Editor pages use one column on mobile/tablet and only use side-by-side panels on comfortable desktop widths.

## Responsive Table Contract

Use `membership-table` for membership/workplace/invitation operational tables or `admin-responsive-table` for generic admin tables. Every mobile-visible `<td>` should include `data-label` so stacked cards remain understandable.

## Filter Contract

Use `AutoSubmitForm` for non-destructive admin filters. Text inputs debounce, selects submit immediately, and reset remains a link to the unfiltered route.

## Guardrail Script

Run this blocking check during UI work:

```bash
npm run audit:admin-ui
```

The default finding budget is `0`. New risky patterns fail the check unless a reviewer intentionally raises `ADMIN_UI_AUDIT_MAX_FINDINGS` for a temporary, documented exception.

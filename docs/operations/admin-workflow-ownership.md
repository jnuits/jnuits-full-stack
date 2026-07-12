# Admin Workflow Ownership

This register defines the primary responsibility of every visible admin
navigation item. It is a navigation and operational-boundary guide, not a
replacement for RBAC. The central permission map in src/lib/admin/access.ts
remains the authorization source of truth.

## Overview

| Navigation item | Primary data / service | Operator boundary |
| --- | --- | --- |
| Dashboard | Derived operational snapshot from membership applications, invitations, profile requests, members, and audit events | Summary and routing only. Do not duplicate queue decisions here. |

## Membership

| Navigation item | Primary data / service | Operator boundary |
| --- | --- | --- |
| Applications | membership_applications | Review and decide new member intake. |
| Invitations | member_invitations, invitation_batches, email delivery state | Own claim-code issuance, delivery, resend, revoke, and onboarding visibility. |
| Profile Requests | profile_update_requests | One moderation queue for workplace, identity, contact, and social profile changes. |
| Membership DB | members, membership_cycles, membership_cycle_memberships, membership_lifecycle_events | Searchable member directory and lifecycle management. It is not a second application or invitation queue. |
| Bulk Operations | approved member lifecycle and invitation operations | High-volume, preview-and-commit work only. Do not use it as a replacement for daily moderation. |

## Content

| Navigation item | Primary data / service | Operator boundary |
| --- | --- | --- |
| Content Hub | Derived overview of content_pages, content_posts, media_assets, gallery_albums, projects, and events | CMS overview and routing, not a second editor. |
| About page | content_pages | Specialized About and homepage content editor. |
| Slider images | content_pages plus media assets | Specialized homepage slider ordering and media editor. |
| Media | media_assets | Canonical Cloudinary asset registry and reuse picker. |
| Blogs | content_posts | Editorial authoring, review, and publishing of blogs. |
| Notices | content_posts | Institutional announcements; separate editorial semantics from blogs. |
| Events | events and event_registrations | Event publishing, registration, attendance, and check-in. |
| Gallery | gallery_albums and gallery_album_items | Canonical album-first gallery management. Do not add new gallery_entries reads or writes. |
| Projects | projects, project_contributors, developer_profiles | Project publishing and contributor attribution. |

## Organization

| Navigation item | Primary data / service | Operator boundary |
| --- | --- | --- |
| Committee | committee_terms, committee_roles, committee_assignments, advisor_profiles | Executive and advisor roster administration. |
| Audit Explorer | audit_events and security_events | Generic investigation, filters, and export. It is not a decision queue. |
| Reports | operator_reports | Create and retain time-stamped operational evidence. |
| Certificates | certificates and certificate_import_batches | Certificate issue, import, management, and public verification. |
| Decisions Log | membership applications and profile_update_requests with audit context | Accountability view for approved, rejected, and pending human decisions. It is not a raw audit-event browser. |

## Settings

| Navigation item | Primary data / service | Operator boundary |
| --- | --- | --- |
| System Health | Runtime integrations, migration parity, rate-limit backend, and health probes | Current operational state, not historical reporting. |
| Admin Accounts | admin_profiles, admin_invitations, admin-scope RBAC grants | Admin identity metadata, lifecycle, invitations, and governed role changes. |
| Security Settings | auth assurance state, security_events, RBAC snapshot | MFA, session, security posture, and operator safeguards. |
| Notification Settings | portal_user_settings and delivery preferences | Operator preference and notification-delivery configuration. |
| Contact Settings | contact content and support configuration | Public support/contact surface configuration. |

## Hidden Compatibility Routes

These routes remain available for old links but are not independent navigation
workflows:

| Route | Canonical destination / ownership |
| --- | --- |
| /admin/settings/profile | Admin Accounts self-profile tab |
| /admin/dashboard | Dashboard / post-login routing |
| /admin/workplace | Profile Requests moderation workflow |
| /admin/content/pages | Advanced singleton-page CMS workflow |
| /admin/reconcile | Reconciliation snapshot workflow; keep until a separately approved Reports consolidation |

## Maintenance Rule

Before adding a new admin page, update this register and answer three questions:

1. Which existing data model owns the workflow?
2. Why can its action not live in the current owner page?
3. Which page must no longer offer the same action?

This keeps high-volume onboarding simple without reducing the capabilities that
operators need.

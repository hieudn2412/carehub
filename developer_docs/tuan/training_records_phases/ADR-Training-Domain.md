# ADR - Training Domain Open Decisions

## Context

Phase 01 implements the database, domain foundation, and shared security scope for Training Records Management. Phase 00 still contains business decisions that require stakeholder confirmation, so the implementation keeps those areas explicit and configurable rather than baking in unapproved rules.

## Implemented Stance For Phase 01

- Employees map to the existing `users` table.
- Job position maps to the existing `positions` table.
- Department maps to the existing `departments` table.
- `professional_fields` is added as a foundation table because the current codebase had no equivalent table.
- Only `SUBMITTED` records are counted by the compliance calculator.
- `AT_RISK` is returned only when a requirement has `warning_threshold_hours`.
- Direct/manual records are validated with the SRS 24-hour upper limit; legacy import can bypass that limit for later review.
- No conversion is performed for `LESSON`, `CREDIT`, `DAY`, `MONTH`, or `YEAR`.
- Approved records cannot be reopened by the default state machine until the business policy is confirmed.

## Implemented Stance For Phase 03

- The edit limit is configurable with `app.training.records.max-edit-count` and defaults to `2`; draft saves do not count, updates after a rejected/submitted workflow has begun do count.
- Duplicate records are surfaced as a warning on the response DTO instead of being hard-blocked for every role.
- The local Phase 03 evidence adapter validates extension, declared MIME type, magic bytes, size, checksum, and mock moderation metadata; PDF moderation remains metadata-only until the hospital policy is confirmed.
- Local evidence storage writes to `target/local-evidence-storage` by default and is a development/test adapter, not a production object-storage decision.
- Submit writes the `TRAINING_RECORD_SUBMITTED` audit event. No reviewer notification needed (review workflow removed).

## Implemented Stance For Phase 04

- List date filters use `training_records.start_date` until a separate completion-date policy is confirmed.
- Non-admin list scope is enforced server-side: regular users are constrained to their own records, and managers are constrained to their current department; out-of-scope filters return no rows instead of widening access.
- The Phase 04 list DTO includes evidence counts but no evidence binary or storage object keys.
- Detail responses include active evidence metadata, review timeline, and change history, but download URLs remain on-demand through the Phase 03 download-url endpoint.
- The temporary frontend for screens 15 and 16 is intentionally minimal for API testing and does not attempt final responsive/card design polish.

## Implemented Stance For Phase 05

- Requirement CRUD is admin-only and uses optimistic `version` checks; active requirements cannot overlap another active requirement with the exact same department, job position, professional field, and effective period.
- Requirement codes are normalized to uppercase on write. Requirement list search supports keyword, active status, scope filters, effective date, paging, and bounded sort fields.
- Applicable employee count is derived from the employee's department and position because the current HR schema does not store professional field on employees; professional field remains a requirement/status selector rather than an employee attribute.
- Personal compliance uses an inclusive rolling window ending at `asOf` or the current date. Only `SUBMITTED` records contribute to compliance hours.
- Requirement priority follows specificity, then newest `effective_from`: department + position + professional field, department + position, position + professional field, position/global variants, then global fallback. The status endpoints accept optional `professionalFieldId` to opt into professional-field-specific rules.
- `AT_RISK` remains disabled unless a requirement has `warning_threshold_hours`; otherwise non-compliant users remain `NON_COMPLIANT`.
- The Phase 05 frontend for requirement configuration and training status is intentionally minimal and exists to test the API flows.

## Implemented Stance For Phase 06

- Employee training hours list is Manager/Admin/System Job only. Admin can filter across departments; Manager scope is constrained to the manager's current department server-side.
- The Phase 06 list avoids per-employee database queries: scoped employee candidates, active requirements, and training records for the maximum active requirement cycle are fetched in batches, then each employee is evaluated with the same Phase 05 requirement priority and per-requirement rolling window. A database view/materialized view remains a future optimization if production volume requires it.
- The only date-window input exposed for Phase 06 is `asOf`; arbitrary custom date windows are not implemented because the business rule is not confirmed.
- `/training/employees/{employeeId}/records` uses the employee's selected requirement window and returns `SUBMITTED` ledger rows. If no requirement is configured, the status response explains `NOT_CONFIGURED` and the compliance ledger is empty.
- Ledger running total counts `SUBMITTED` hours (declared_hours); this is the only active state that contributes to compliance.
- Evidence, review, and change timeline data on the Phase 06 ledger is summarized as counts per record; full record detail and download URLs remain delegated to the Phase 04/03 endpoints.
- The Phase 06 frontend for employee list/detail is intentionally minimal and exists to test the API flows.

## Implemented Stance For Phase 07

- Legacy Excel import is Manager/Admin/System Job only. Admin can import all employees; Manager can import only employees in the manager's current department.
- Import uses a two-step flow: multipart Excel preview persists `training_import_batches` and `training_import_rows`, then apply creates business records only for `VALID` rows or `WARNING` rows explicitly confirmed by `confirmedRowIds` or `commitWarnings=true`.
- The source Excel has no reliable activity type column, so preview requires a selected `activityTypeId`; `professionalFieldId` is optional and applied to every committed row in the batch.
- Employee code normalization trims, uppercases, removes whitespace, and prefixes numeric-only codes with `VD`; suspicious/non-matching codes stay failed/manual-review and are not auto-corrected.
- Duration parsing stores raw text, parsed value, parsed unit, normalized hours, confidence, and warnings. Explicit hour values are normalized to hours. `LESSON`, `CREDIT`, `MONTH`, and `YEAR` are parsed without converting to hours because conversion rules are still open decisions.
- Rows with no evidence, Google Drive evidence, duplicate candidates, ambiguous numeric duration, snapshot mismatches, or unconfirmed units are warnings, not auto-applied. Invalid employee, missing title/date, unsafe date range, and unparseable duration block the row.
- Committed legacy rows create `SUBMITTED` training records with `sourceType=LEGACY_IMPORT`.
- Google Drive/legacy evidence is saved only in `legacy_external_url`; `object_key` remains null until a separate object-storage migration/download process is approved.
- The Phase 07 frontend is intentionally minimal and exists to upload, preview, confirm, and apply batches for API testing.

## Implemented Stance For Review Removal (Post-Phase-09)

- Review workflow (`PENDING_REVIEW`, `APPROVED`, `REJECTED`) is removed. Admin and Manager no longer review training records or evidence.
- Users self-manage their training hours and evidence. They are responsible for their own data.
- `SUBMITTED` is the final active state; `SUBMITTED` hours count toward compliance (using `declared_hours`).
- Evidence moderation still validates file format/size/magic bytes but does **not** block submission. Evidence is optional.
- The `training_record_reviews` table and `ReviewDecision` enum are removed.
- `approved_hours`, `latest_reviewed_by_user_id`, `latest_reviewed_at`, `latest_rejection_reason` columns are removed from `training_records`.
- `declared_hours` is used for compliance calculation instead of `approved_hours`.
- `app.training.records.review-enabled` property gates the legacy review workflow (default: `false` — self-managed).
- Audit events `APPROVED` and `REJECTED` are removed from `TrainingRecordChangeType`.
- Notification hooks for submit-to-review-queue, approve, and reject are removed.
- Manager review pages (`/manager/evidence-review`) are removed.
- State machine simplified to: `DRAFT → SUBMITTED → (optional) CANCELLED`.
- `requireEditable()` check simplified: only `DRAFT` records are editable (no more `REJECTED` resubmit).

## Open Decisions

1. How many hours a `LESSON` represents.
2. Whether `CREDIT` values can be converted to hours.
3. Whether long courses are one record or split records.
4. Whether reviewers can approve a different hour count from the declared value.
5. Whether evidence is required for every activity type.
6. How the maximum two edits are counted.
7. Whether an approved record can be reopened, and by whom.
8. The final formula for `AT_RISK`.
9. Whether requirement scope should use job position, professional title, or another HR dimension.
10. How training history is attributed when an employee changes departments.
11. How PDF moderation should work beyond the local metadata mock.
12. Whether old Google Drive evidence must be copied into object storage.

## Consequences

- Phase 02+ services must keep using `TrainingAccessPolicy`, `TrainingRecordStateMachine`, and `TrainingComplianceCalculator`.
- CRUD endpoints must not let clients set `workflowStatus`, `approvedHours`, reviewer fields, or computed compliance fields.
- Import services must keep raw duration data until conversion rules are confirmed.

# ADR - Training Domain Open Decisions

## Context

Phase 01 implements the database, domain foundation, and shared security scope for Training Records Management. Phase 00 still contains business decisions that require stakeholder confirmation, so the implementation keeps those areas explicit and configurable rather than baking in unapproved rules.

## Implemented Stance For Phase 01

- Employees map to the existing `users` table.
- Job position maps to the existing `positions` table.
- Department maps to the existing `departments` table.
- `professional_fields` is added as a foundation table because the current codebase had no equivalent table.
- Only `APPROVED` records are counted by the compliance calculator.
- `AT_RISK` is returned only when a requirement has `warning_threshold_hours`.
- Direct/manual records are validated with the SRS 24-hour upper limit; legacy import can bypass that limit for later review.
- No conversion is performed for `LESSON`, `CREDIT`, `DAY`, `MONTH`, or `YEAR`.
- Approved records cannot be reopened by the default state machine until the business policy is confirmed.

## Implemented Stance For Phase 03

- The edit limit is configurable with `app.training.records.max-edit-count` and defaults to `2`; draft saves do not count, updates after a rejected/submitted workflow has begun do count.
- Duplicate records are surfaced as a warning on the response DTO instead of being hard-blocked for every role.
- The local Phase 03 evidence adapter validates extension, declared MIME type, magic bytes, size, checksum, and mock moderation metadata; PDF moderation remains metadata-only until the hospital policy is confirmed.
- Local evidence storage writes to `target/local-evidence-storage` by default and is a development/test adapter, not a production object-storage decision.
- Submit writes the `TRAINING_RECORD_SUBMITTED` audit event and leaves reviewer notification delivery to Phase 08, where notification hooks, reviewer routing, duplicate suppression, and transport policy are defined.

## Implemented Stance For Phase 04

- List date filters use `training_records.start_date` until a separate completion-date policy is confirmed.
- Non-admin list scope is enforced server-side: regular users are constrained to their own records, and managers are constrained to their current department; out-of-scope filters return no rows instead of widening access.
- The Phase 04 list DTO includes evidence counts but no evidence binary or storage object keys.
- Detail responses include active evidence metadata, review timeline, and change history, but download URLs remain on-demand through the Phase 03 download-url endpoint.
- The temporary frontend for screens 15 and 16 is intentionally minimal for API testing and does not attempt final responsive/card design polish.

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

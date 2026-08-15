# Evaluation multi-field redesign — implementation status

## Current phase

Phase 8 — cutover gates and remote preflight (implemented, production generation gated).

## Implemented

- Direct question-bank pool for multi-field configurations.
- Stable ID ordering, versioned seed derivation and deterministic shuffle.
- Question-family/paraphrase exclusion within each paper.
- Optional zero-overlap across variants with per-cell capacity validation.
- Generation batch with a unique idempotency key and request hash conflict detection.
- Config row locking so concurrent requests for the same config/key converge on one batch.
- Pool checksum over algorithm/config/filter/question state and conflict on a stale preview.
- Immutable blueprint, taxonomy, provenance and generation snapshots.
- Actual snapshot matrix validation before publish.
- Admin generation checkpoint and overlap/coverage preview.
- Assignment requests require an idempotency key and use request-hash conflict detection.
- Assignment snapshots a resolved audience and one published paper variant per employee.
- Attempts use the target paper snapshot; retakes either keep or rotate the published batch variant.
- Dedicated assignment form selects only a published paper and an active audience; no single-field, purpose or question-set control remains.
- At grading, idempotent result aggregates are rebuilt from immutable paper-question snapshots for field, cognitive level and field × cognitive cell.
- Field thresholds use the blueprint threshold or fall back to the paper passing score; cell results flag one-question samples.
- Result APIs provide assignment coverage/heatmap and an attempt → field → cognitive → question snapshot drill-down.
- `FIELD_SCORE_LT` audience rules use the field aggregate with LATEST/FIRST/BEST attempt selection, source assignment/time filters and a explainable preview.
- Regrade requires `RECALCULATE_SNAPSHOT`, a reason, `EXAM_PUBLISHER`, and an audit record; it does not re-emit the passed event.

## Assumptions

- `QuestionBankQuestion.parentQuestion` identifies a paraphrase family; walking to the root produces the family ID.
- `randomSeed` remains the API name for the batch master seed to preserve existing clients.
- Overlap is reported as repeated source-question occurrences divided by all selected occurrences in the batch.
- Legacy question-set papers remain readable; the new direct-bank path does not query question-set repositories.

## Database

- V11 creates `exam_paper_generation_batches` and `exam_paper_generation_batch_cells`.
- V12 adds assignment batch/policy metadata and a non-null paper snapshot per assignment target.
- V13 creates `exam_attempt_field_results`, `exam_attempt_cognitive_results` and `exam_attempt_cell_results`.
- Remote PostgreSQL đã chạy thành công V13; ba bảng aggregate đã tồn tại. V13 là expand-only và không viết lại attempt cũ.

## Verification

- Backend focused Phase 7 unit/integration/API tests thành công, gồm aggregate, audience, report permission, export snapshot và submit ghi aggregate trong H2. Baseline trước cutover: 839 tests, 0 failures/errors, 9 skipped.
- Backend full suite after Phase 8 guards, cognitive reviewer workflow, real-HTTP reviewer permission coverage, nested audience validation, malformed-rule rejection, the real-HTTP audience preview/activation flow, production audience-selection anti-bypass tests, ACTIVE-audience assignment resolution and open-time gate rechecks: 857 tests, 0 failures/errors, 9 skipped. Frontend lint, 156 tests và production build thành công (`npm test -- --no-file-parallelism --maxWorkers=1 --hookTimeout=30000` dùng để tránh timeout import động khi máy chạy song song thiếu tài nguyên). Evidence: `developer_docs/evaluation-multi-field-redesign/phase-08/baselines/backend-test-20260814-final-summary.txt` và `frontend-test-20260814.txt`.

## Known limitations

- Remote database chưa có lượt thi mới sau V13, nên ba bảng aggregate đang có 0 dòng. Khi có attempt được chấm mới, aggregate được tạo trong cùng transaction chấm; cần thực hiện smoke test chấm một đề thực tế trước nghiệm thu vận hành.
- Existing attempts created before V13 have no aggregates; Phase 7 reports show only attempts graded after V13 unless a separately approved historic regrade/backfill policy is introduced.

## Phase 8 cutover status (13/08/2026)

- Initial remote preflight: Flyway `13` successful; 270 questions, 11 categories and 28 professional fields. A later read-only recheck found 29 total / 26 active fields because one inactive custom field was added externally; the 270 question links and all integrity checks remain unchanged. See `developer_docs/evaluation-multi-field-redesign/phase-08/baselines/remote-recheck-20260813.txt`.
- Post-deploy read-only audit `verify-cutover.sql` passed (exit 0): no FK/orphan or duplicate-code failures, all required snapshot columns and indexes present. The 2026-08-14 rerun is recorded at `developer_docs/evaluation-multi-field-redesign/phase-08/baselines/remote-verify-rerun-20260814.txt`; evidence hash: `246bdf21a0916890ef8086729e5378115de3e5afdc96acaec216730486869c33`.
- Post-deploy backup `carehub-postdeploy-20260813.dump` is readable (`pg_restore --list` exit 0) and was fully restored into an isolated temporary PostgreSQL cluster; the historical restore matched 270 questions, 11 categories and 28 fields, then the temporary database/cluster were removed. The current remote recheck is recorded separately so the externally added field is not confused with the restore snapshot. The restore runbook now uses `DbHost` and separate psql/pg_restore arguments.
- Integrity: 270/270 questions have both `category_id` and `professional_field_id`; no orphaned question/category/field links.
- Legacy evaluation data: question sets, set versions/items, exam configs, papers, assignments and attempts are all `0` on the remote database. Legacy QuestionSet endpoints remain read-only/guarded because code consumers still exist; no destructive contract migration is run.
- Cognitive gate: `270/270` approved questions are currently missing `cognitive_verified_at`. No automatic medium-to-new-level mapping is performed. Direct paper generation and publication therefore remain disabled in production.
- Cognitive review operations: `POST /api/v1/questions/cognitive-review` accepts explicit question ID + one of the three cognitive levels, requires `QUESTION_REVIEWER`, and writes verified timestamp/by plus a `QUESTION_COGNITIVE_REVIEW` audit row for every decision. The frontend queue is `/admin/evaluation/question-bank/cognitive-review`; the real-HTTP API suite also proves an author-only token is rejected and a reviewer response contains the verified row.
- Runtime flags are exposed at `GET /api/v1/evaluation/cutover/status` and configured through `EVAL_QUESTION_DIRECT_FIELD`, `EVAL_COGNITIVE_VERIFIED`, `EVAL_AUDIENCE_RULES_V1`, `EVAL_LEGACY_INLINE_AUDIENCE_ENABLED`, `EVAL_MULTI_FIELD_BLUEPRINT`, `EVAL_MULTI_FIELD_GENERATION`, and `EVAL_FIELD_RESULTS`. The legacy inline audience compatibility flag defaults to false and is enabled only in the test profile.
- New exam-config requests with `questionSetId` are rejected in production while the legacy write flag is off; assignment creation requires both the audience and direct-generation gates.
- Default production posture: direct field and blueprint flows enabled; audience management and generation are fail-closed until their preflight gates pass; result APIs remain available.
- Schema ownership remains versioned Flyway with `JPA_DDL_AUTO=validate`; no reset/seed is performed by the cutover.
- When RabbitMQ is not provisioned, the email consumer bean/listener and RabbitAdmin auto-declaration are disabled by default (`RABBITMQ_LISTENER_ENABLED=false`). This prevents startup/reconnect loops from holding the backend; enable the flag only in an environment with a healthy broker.
- AI native model preload, E5 backfill and embedding-cache warmup are now opt-in by default (`E5_PRELOAD=false`, `VIETQUILL_PRELOAD=false`, `E5_BACKFILL_ON_STARTUP=false`, `E5_CACHE_WARMUP_ENABLED=false`). This prevents synchronous ONNX loading/warm-up from making an IntelliJ run appear hung; enable them explicitly only on a worker/production node with enough RAM.
- Notification policy seeding, scheduled scanning and the legacy startup constraint fixer are opt-in by default (`APP_NOTIFICATION_SEED_ENABLED=false`, `APP_NOTIFICATION_SCHEDULING_ENABLED=false`, `APP_NOTIFICATION_SCHEMA_FIX_ENABLED=false`). Enable all three explicitly only in the notification worker/runtime; a missing IntelliJ `.env.properties` must not trigger background DB writes or `ALTER TABLE`.
- Latest safe-start smoke with the local development env connected to remote PostgreSQL validated Flyway V13 and started Tomcat on port 18082 in 24.248 seconds with no RabbitMQ reconnect log, notification seed/scheduler, or startup constraint-fixer DDL. AI inference remains lazy and loads on first use when preload is off.
- A live read-only recheck at 00:44 +07:00 on 2026-08-14 could not connect to `116.118.6.153:5432` (Windows error 10060); the historical remote rerun is not treated as current certification. No remote write/reset/seed was attempted. The backend now has bounded JDBC/Hikari timeouts and a negative-path fail-fast smoke: `developer_docs/evaluation-multi-field-redesign/phase-08/baselines/remote-live-recheck-20260814.txt` and `backend-db-failfast-20260814.txt`.
- IntelliJ/Maven can now resolve `carehub-backend/.env.properties` whether the working directory is the backend module or repository root; root-working-directory fail-fast evidence is recorded in `developer_docs/evaluation-multi-field-redesign/phase-08/baselines/backend-root-start-failfast-20260814.txt`.
- Phase 8 read-only operational artifacts are available at `developer_docs/evaluation-multi-field-redesign/phase-08/cognitive-review-worklist.sql` and `shadow-matrix.sql`; they expose the remaining reviewer workload and cell shortages without mutating remote data or bypassing audit.
- Paraphrase candidates saved into the bank now use the same direct-field gate as manual/imported questions and inherit the source question's category, professional field and reviewer-verified cognitive snapshot; unverified sources are rejected.

Before enabling generation, a reviewer must classify and verify every intended question, then rerun the Phase 8 read-only preflight and shadow matrix. Only after those checks should `EVAL_COGNITIVE_VERIFIED=true` and `EVAL_MULTI_FIELD_GENERATION=true` be set in the deployment environment.

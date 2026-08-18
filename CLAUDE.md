# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CareHub — a hospital staff management platform for Continuing Medical Education (CME), quality evaluation via dynamic checklists/forms, and exam management. Monorepo with a Java Spring Boot backend and a React frontend.

## Development Commands

### Backend (`carehub-backend/`)
- **Run**: `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`)
- **Build**: `./mvnw clean package -DskipTests`
- **Test all**: `./mvnw test`
- **Test single class**: `./mvnw test -Dtest=ClassName`
- **Development infrastructure**: shared PostgreSQL 17 and RabbitMQ 4 on `116.118.6.153`; no local Compose stack

### Frontend (`carehub-frontend/`)
- **Dev server**: `npm run dev` (proxies `/api` to `http://localhost:8081` via Vite config — the dev server can be accessed at port 5173, but `VITE_API_BASE_URL` can be set to any environment)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Preview build**: `npm run preview`

### Environment
Backend defaults to profile `dev` and loads `.env.dev` from `carehub-backend` (or environment variables) for secrets: `JWT_SECRET`, `DB_*`, `RABBITMQ_*`, `MAIL_*`, `DEEPSEEK_API_KEY`, admin credentials, etc. Production uses profile `prod` and `.env.prod`. Frontend uses `.env` (copy from `.env.example`; default `VITE_API_BASE_URL=http://localhost:8081/api/v1`).

## Architecture

### Backend (`carehub-backend/`)

**Stack**: Java 17, Spring Boot 4.0.6, Spring Security (OAuth2 Resource Server + JWT), Spring Data JPA (Hibernate → PostgreSQL 17), RabbitMQ and Cloudflare R2 (file storage).

**API prefix**: `/api/v1` (configured via `app.api-prefix`).

**Package structure** under `vn.vietduc.carehubbackend`:

| Package | Purpose |
|---------|---------|
| `auth/` | Login, JWT (HMAC-SHA256, 15min access / 7d refresh), refresh token rotation, logout, password reset via OTP |
| `user/` | User CRUD, roles (ADMIN/MANAGER/USER), permissions, departments, positions, first-login setup flow, reference data sync |
| `training/` | CME training records, activity types (versioned, with change log), evidence file uploads (Cloudflare R2), training requirements, status tracking, legacy Excel import, manager review workflow |
| `form/` | Dynamic form/checklist builder — forms have versioned sections/questions/options. Sub-packages: `assignment/` (assign forms to employees/departments), `submission/` (submit responses, scoring), `importer/` (Google Forms import), `subject/` (employee/department targets), `scoring/` (recalculation jobs) |
| `questiongeneration/` | AI-powered question generation pipeline. Sub-packages: `generation/` (DeepSeek API with mock fallback, circuit breaker, router), `embedding/` (ONNX Runtime + multilingual-e5-small for semantic dedup), `paraphrase/` (VietQuill T5 model), `modelruntime/` (AI model status), `event/` (async events), `security/` (evaluation-specific security), `config/` (evaluation config properties), plus exam papers, assignments, attempts, question bank, categories, sets, classification rules |
| `notification/` | Email notifications via RabbitMQ (`EmailProducer` → queue → `EmailConsumer`), email templates, scheduled notifications (cron) |
| `imports/` | User/reference data import with audit logging |
| `dashboard/` | Aggregated dashboard data (admin, manager, training, evaluation) |
| `config/` | SecurityConfig (JWT encoder/decoder, stateless sessions, public endpoints), WebConfig (CORS), RabbitMQConfig, DataSeeder (admin account + question bank seed), CustomJwtAuthenticationConverter (extracts roles/permissions from JWT claims), R2Config (Cloudflare), JacksonConfig, JpaConfig |
| `common/` | BaseEntity, ApiResponse<T>, ErrorResponse, PageResponse<T>, CosineUtil |
| `exception/` | Custom exceptions (BadRequest, Conflict, Forbidden, ResourceNotFound, Token, Unauthorized, UnprocessableEntity, Validation, ServiceUnavailable) + `GlobalExceptionHandler` |
| `utils/` | Utility classes |

**Key patterns**:
- Controller → Service (interface) → ServiceImpl → Repository (Spring Data JPA)
- `@EnableScheduling` on main application class (`CarehubBackendApplication`) — scheduled tasks include notification scan (cron), embedding backfill, and model warmup.
- `@PreAuthorize` at the controller method level for role/permission checks. Some service methods also have `@PreAuthorize` for defense in depth. The evaluation module has a dedicated `EvaluationSecurity` utility for programmatic permission checks.
- DTOs per feature in `dto/` subdirectories with nested `request/` and `response/` subpackages
- Hand-written `@Component` mapper classes (NOT MapStruct — mapstruct dependency exists in pom.xml but is unused; all mappers manually map fields via constructors or builder methods)
- Lombok throughout (@Data, @Builder, @RequiredArgsConstructor, etc.)
- Hibernate ddl-auto: update (auto-creates/updates tables from entities)
- JWT claims carry roles and permissions; `CustomJwtAuthenticationConverter` maps them to Spring Security GrantedAuthorities (ROLE_ADMIN, ROLE_MANAGER, plus permission strings)
- `@EnableMethodSecurity` enabled — controllers and services use `@PreAuthorize` annotations

**Standard response format**:
- Success: `ApiResponse<T>` with `{success: true, message: string, data: T}` — wrapped in `ResponseEntity.ok()`
- Paginated: `ApiResponse<PageResponse<T>>` where `PageResponse` has `{content, page, size, totalElements, totalPages, sort}`
- Error: `ErrorResponse` record with `{error_code, message, correlation_id, details}` — error responses include `X-Correlation-ID` header
- Error codes: `REQ_001` (bad request), `VAL_001` (validation), `AUTH_001` (auth), `AUTH_002` (forbidden), `SYS_404` (not found), `SYS_409` (conflict), `SYS_503` (unavailable), `SYS_001` (internal)
- All error messages are in Vietnamese

**Public endpoints** (no auth required): `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`.

**BaseEntity**: All entities extend `BaseEntity` which provides `id` (auto-increment Long), `createdAt`, `updatedAt` (JPA auditing), and `updatedBy`. Uses `@EntityListeners(AuditingEntityListener.class)`.

**Key data patterns**:
- **Optimistic locking**: `@Version` on `TrainingRecord`, `EmailTemplate`, `ProfessionalField`, `FormSubmission` — always handle `OptimisticLockException` / `ObjectOptimisticLockingFailureException` (mapped to 409 Conflict with Vietnamese message).
- **Soft delete**: `deleted` flag on `Form` (form_templates), `isDeleted` on `User`.
- **State machine**: `TrainingRecordStateMachine` manages the training-record workflow. `TrainingRecordStatus` has exactly three values — `DRAFT`, `SUBMITTED`, `CANCELLED` (there is no APPROVED/REJECTED status). Allowed transitions: `DRAFT → SUBMITTED`, `DRAFT → CANCELLED`, `SUBMITTED → DRAFT` (return-to-draft; ownership is checked in `TrainingRecordServiceImpl.returnToDraft`), `SUBMITTED → CANCELLED` (admin actor only). `CANCELLED` is terminal, and only `DRAFT` records are editable. Compliance hours count `SUBMITTED` records — see D1 in `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` for how this differs from SRS BR-05.
- **Async processing via RabbitMQ**: `EmailProducer`/`EmailConsumer` for email dispatch, async recalculation jobs for form scoring, async notification dispatching via `NotificationEventPublisher`/`NotificationEventListener`. Document question generation and paraphrase jobs are also processed asynchronously.
- **`AFTER_COMMIT` listeners must open their own transaction.** In that phase the parent transaction has committed but its synchronization is still bound to the thread, so a plain `@Transactional` (REQUIRED) joins the dead transaction and every write fails with `No active transaction` — and listeners that catch broadly swallow it, silently dropping the write. Two live bugs came from this (`ExamPassedTrainingListener`, `NotificationDispatcher`). Use `REQUIRES_NEW`; note that `@Transactional` placed directly on a `@TransactionalEventListener` method has **no effect** (Spring invokes the listener without going through the proxy) — annotate a separate bean or use `TransactionTemplate`.
- **Exam scores are on a 0–10 scale end to end** — `ExamAttemptService.gradeAttempt` computes `correctCount * 10 / totalQuestions`, `passingScore` is 0–10, and `CompetencyClassificationService` classifies on the same scale. The frontend displays `/10` and must never rescale.
- **Seeded data** (configurable via `app.seed.*`): Admin user (employee code from `ADMIN_EMPLOYEE_CODE`, password from `ADMIN_PASSWORD`), question bank from `hospital-review-questions.json`, professional fields from `nursing-professional-fields.json`, notification configurations.

**AI/ML pipeline** (in `questiongeneration/`):
- *Question generation*: `DocumentQuestionGenerator` interface → `DocumentQuestionGeneratorRouter` → `DeepSeekDocumentQuestionGenerator` (API) or `MockDocumentQuestionGenerator` (fallback). Configured via `ai.generation.*` properties. Includes circuit breaker and retry logic.
- *Embeddings*: `E5EmbeddingModelService` loads `intfloat/multilingual-e5-small` via ONNX Runtime for semantic duplicate detection. Backfills embeddings on startup by default. Supports ANN via LSH for approximate nearest neighbor search.
- *Paraphrasing*: `VietQuillParaphraseModelService` uses a T5-based Vietnamese paraphraser. Model files must be placed in `models/` directory (not in repo).
- Models are loaded from local `models/` paths (configured via `E5_MODEL_PATH`, `VIETQUILL_MODEL_PATH` env vars). These are NOT committed — download separately.
- Pipeline: Document upload → chunking → AI question generation → embedding → semantic dedup → candidate review → question bank
- **Full documentation lives in `docs/ai/`** (repo root, not `carehub-backend/docs/`) — `docs/ai/ai-models.md` covers the three flows end to end, every tunable and its range, all decision thresholds, measured benchmarks, and a troubleshooting table. Read it before changing anything under `questiongeneration/`. Benchmark reports are regenerated into `docs/ai/benchmarks/` by env-gated tests (`RUN_E5_BENCH`, `RUN_E5_CALIBRATION`, `RUN_VIETQUILL_BENCH`).
- Two config names are misleading and documented as such: `document.chunk.target-tokens` counts **words** and does **not** cut chunks (`max-tokens` does), and `ai.paraphrase.num-beams` is overridden by `requestedCount` so changing it has no effect.

**Database**: PostgreSQL 17, timezone set to `Asia/Ho_Chi_Minh` via HikariCP. Hibernate `ddl-auto: update` — schema evolves from entity classes, no migration framework used. Batch inserts configured (batch_size: 100).

### Frontend (`carehub-frontend/`)

**Stack**: React 19, Vite 8, React Router v7, `@ant-design/icons` (icons only, NOT Ant Design components), Axios, Recharts, custom CSS.

**Directory structure**:
```
src/
  main.jsx              — entry point
  app/                  — App, AppProviders (BrowserRouter + ToastProvider), router (all routes)
  features/
    auth/               — login, forgot password, OTP, reset password, email confirm, ProtectedRoute, tokenStorage
    admin/              — admin dashboard, accounts, reference data, system settings, quality checklists,
                          quality history, training config, evaluation management, reports
    staff/              — staff dashboard, CME training hours, exams, profile, notifications, competency
      pages/manager/    — manager-specific pages (employee oversight, evidence review, checklist eval, exam results)
      pages/training/   — training hours screens for staff
      pages/competency/ — staff competency page
    training/           — training foundation, records list/detail/form, status, employee status, legacy import, activity types
    evaluation/         — question documents, categories, sets, bank, classification rules, exam config,
                          exam papers, assignments, attempts, AI document questions, paraphrase review,
                          competency, compliance, audit logs, prompt templates, training groups
  shared/
    api/httpClient.js   — Axios instance with JWT interceptors (auto-refresh on 401)
    context/ToastContext.jsx
    components/         — BrandLogo, FormField, Icon, SecurityBadge
  layouts/              — AdminLayout.jsx, StaffLayout.jsx (NOT used by router)
  styles/               — custom CSS
```

**Feature-internal conventions**: Each feature at minimum has `pages/` and `api/` directories. Larger features add `components/`, `styles/`, `utils/`, `hooks/`, `services/`, `constants/`. API modules export plain objects with methods that call `httpClient` and return the full axios response (callers must unwrap `.data` themselves).

**Auth flow**: Tokens stored in sessionStorage (keys: `carehub.accessToken`, `carehub.refreshToken`, `carehub.requiresFirstLoginSetup`). Axios request interceptor attaches `Bearer` token. Response interceptor handles 401 by attempting a refresh-token call (deduplicated — only one in-flight refresh at a time). On refresh failure, clears session and redirects to `/auth/login`.

**Role-based routing**: `ProtectedRoute` component gates routes by role and/or permission. Wrappers: `adminElement()` (ADMIN only), `evaluationElement()` (ADMIN or evaluation permissions), `managerOrAdminElement()`. Post-login redirect uses `getPostLoginRoute()` which checks if the requested path is allowed for the user's roles/permissions.

**Roles**: `ADMIN`, `MANAGER`, `USER`. Separate **evaluation permissions** (QUESTION_AUTHOR, QUESTION_REVIEWER, EXAM_PUBLISHER, etc.) grant access to `/admin/evaluation/*` without full admin role.

**No TypeScript** — the entire frontend is plain JavaScript/JSX. The `@types/react` devDependency is unused (IDE support only).

**All UI strings are in Vietnamese** — error messages, breadcrumbs, labels, toasts, and static text.

**Key frontend patterns**:
- API modules manually add `authHeaders()` in each call — this is redundant since the httpClient interceptor already attaches the Bearer token. Both approaches exist; don't add `authHeaders()` when writing new API modules.
- Pages use `Page` suffix everywhere except staff pages which use `Screen` suffix.
- Layout components (`AdminLayout.jsx`, `StaffLayout.jsx`) exist with proper `<Outlet/>` patterns but are **not used** by the router. Every page individually imports and renders its own Sidebar+Header. Don't introduce nested layouts without migrating all pages.
- The staff sidebar file is lowercase `sidebar.jsx` while admin uses `AdminSidebar.jsx`.
- Toast notifications use a custom `ToastContext` provider, not Ant Design's message component.

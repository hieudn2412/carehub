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
- **Infrastructure**: `docker compose up -d` (starts PostgreSQL 17, RabbitMQ 3, Redis 7)

### Frontend (`carehub-frontend/`)
- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Preview build**: `npm run preview`

### Environment
Backend requires a `.env.properties` or `env.properties` file at the project root (or environment variables) for secrets: `JWT_SECRET`, `DB_*`, `MAIL_*`, `DEEPSEEK_API_KEY`, admin seed credentials, etc. See `application.yaml` for all config keys and their defaults. Frontend uses `.env` (copy from `.env.example`; default `VITE_API_BASE_URL=http://localhost:8081/api/v1`).

## Architecture

### Backend (`carehub-backend/`)

**Stack**: Java 17, Spring Boot 4.0.6, Spring Security (OAuth2 Resource Server + JWT), Spring Data JPA (Hibernate → PostgreSQL 17), RabbitMQ, Redis.

**API prefix**: `/api/v1` (configured via `app.api-prefix`).

**Package structure** under `vn.vietduc.carehubbackend`:

| Package | Purpose |
|---------|---------|
| `auth/` | Login, JWT (HMAC-SHA256, 15min access / 7d refresh), refresh token rotation, logout |
| `user/` | User CRUD, roles (ADMIN/MANAGER/USER), permissions, departments, positions, first-login setup flow, reference data sync |
| `training/` | CME training records, activity types, evidence file uploads, training requirements, status tracking, legacy Excel import, manager review workflow |
| `form/` | Dynamic form/checklist builder — forms have versioned sections/questions/options. Sub-packages: `assignment/` (assign forms to employees/departments), `submission/` (submit responses), `importer/` (Google Forms import), `subject/` (employee/department targets) |
| `questiongeneration/` | AI-powered question generation pipeline. Sub-packages: `generation/` (DeepSeek API with mock fallback, circuit breaker, router pattern), `embedding/` (ONNX Runtime + multilingual-e5-small for semantic dedup), `paraphrase/` (VietQuill T5 model), `modelruntime/` (AI model status), plus exam papers, assignments, attempts, question bank, categories, sets, classification rules |
| `notification/` | Email notifications via RabbitMQ (`EmailProducer` → queue → `EmailConsumer`), email templates |
| `imports/` | User/reference data import with audit logging |
| `dashboard/` | Aggregated dashboard data |
| `config/` | SecurityConfig (JWT encoder/decoder, stateless sessions, public endpoints), WebConfig (CORS), RabbitMQConfig, DataSeeder (admin account + question bank seed), CustomJwtAuthenticationConverter (extracts roles/permissions from JWT claims) |
| `common/` | `ApiResponse<T>` standard response wrapper |
| `exception/` | Custom exceptions (BadRequest, Conflict, Forbidden, ResourceNotFound, Token, Unauthorized, UnprocessableEntity, Validation) + `GlobalExceptionHandler` |

**Key patterns**:
- Controller → Service (interface) → ServiceImpl → Repository (Spring Data JPA)
- MapStruct mappers for entity ↔ DTO conversion
- Lombok throughout (@Data, @Builder, @RequiredArgsConstructor, etc.)
- Hibernate ddl-auto: update (auto-creates/updates tables from entities)
- JWT claims carry roles and permissions; `CustomJwtAuthenticationConverter` maps them to Spring Security GrantedAuthorities
- `@EnableMethodSecurity` enabled — controllers and services use `@PreAuthorize` annotations

**Public endpoints** (no auth required): `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/training/evidence-download/**`.

**AI/ML pipeline** (in `questiongeneration/`):
- *Question generation*: `DocumentQuestionGenerator` interface → `DocumentQuestionGeneratorRouter` → `DeepSeekDocumentQuestionGenerator` (API) or `MockDocumentQuestionGenerator` (fallback). Configured via `ai.generation.*` properties. Includes circuit breaker and retry logic.
- *Embeddings*: `E5EmbeddingModelService` loads `intfloat/multilingual-e5-small` via ONNX Runtime for semantic duplicate detection. Backfills embeddings on startup by default.
- *Paraphrasing*: `VietQuillParaphraseModelService` uses a T5-based Vietnamese paraphraser. Model files must be placed in `models/` directory (not in repo).
- Models are loaded from local `models/` paths (configured via `E5_MODEL_PATH`, `VIETQUILL_MODEL_PATH` env vars). These are NOT committed — download separately.

**Database**: PostgreSQL 17, timezone set to `Asia/Ho_Chi_Minh` via HikariCP. Hibernate `ddl-auto: update` — schema evolves from entity classes, no migration framework used. Batch inserts configured (batch_size: 100).

### Frontend (`carehub-frontend/`)

**Stack**: React 19, Vite 8, React Router v7, Ant Design + @ant-design/icons, Axios, Recharts.

**Directory structure**:
```
src/
  main.jsx              — entry point
  app/                  — App, AppProviders (BrowserRouter + ToastProvider), AppRouter (all routes)
  features/
    auth/               — login, forgot password, OTP, reset password, email confirm, ProtectedRoute
    admin/              — admin dashboard, accounts, reference data, system settings, quality checklists,
                          quality history, training config, evaluation management, reports
    staff/              — staff dashboard, CME training hours, exams, profile, notifications
      pages/manager/    — manager-specific pages (employee oversight, evidence review, checklist eval)
    training/           — training foundation, records, status, employee status, legacy import, activity types
    evaluation/         — question documents, categories, sets, bank, classification rules, exam config,
                          exam papers, assignments, attempts, AI document questions, paraphrase review
  shared/
    api/httpClient.js   — Axios instance with JWT interceptors (auto-refresh on 401)
    context/ToastContext.jsx
    components/         — BrandLogo, FormField, Icon, SecurityBadge
```

**Feature-internal conventions**: Each feature at minimum has `pages/` and `api/` directories. Larger features add `components/`, `styles/`, `utils/`, `hooks/`, `services/`, `constants/`. API modules export plain async functions that call `httpClient` and return response `.data`.

**Auth flow**: Tokens stored in sessionStorage. Axios request interceptor attaches `Bearer` token. Response interceptor handles 401 by attempting a refresh-token call (deduplicated — only one in-flight refresh at a time). On refresh failure, clears session and redirects to `/auth/login`.

**Role-based routing**: `ProtectedRoute` component gates routes by role and/or permission. Wrappers: `adminElement()` (ADMIN only), `evaluationElement()` (ADMIN or evaluation permissions), `managerOrAdminElement()`. Post-login redirect uses `getPostLoginRoute()` which checks if the requested path is allowed for the user's roles/permissions.

**Roles**: `ADMIN`, `MANAGER`, `USER`. Separate **evaluation permissions** (QUESTION_AUTHOR, QUESTION_REVIEWER, EXAM_PUBLISHER, etc.) grant access to `/admin/evaluation/*` without full admin role.

**No TypeScript** — the entire frontend is plain JavaScript/JSX. The `@types/react` devDependency is unused (IDE support only).

**All UI strings are in Vietnamese** — error messages, breadcrumbs, labels, toasts, and static text.

**Notable architectural quirks**:
- `src/layouts/AdminLayout.jsx` and `StaffLayout.jsx` exist with proper `<Outlet/>` patterns but are **not used** by the router. Instead, every page individually imports and renders its own Sidebar+Header. Don't introduce nested layouts without migrating all pages.
- Naming is inconsistent: most pages use `Page` suffix but staff pages use `Screen` suffix. The staff sidebar file is lowercase `sidebar.jsx` while admin uses `AdminSidebar.jsx`.
- `antd` (Ant Design) is **not** a dependency — only `@ant-design/icons` is used. The UI is custom CSS, not Ant Design components.

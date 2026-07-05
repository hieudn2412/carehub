package vn.vietduc.carehubbackend.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.dashboard.dto.*;
import vn.vietduc.carehubbackend.exception.ValidationException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private static final ZoneId DASHBOARD_ZONE = ZoneId.of("Asia/Bangkok");
    private static final int OVERVIEW_CACHE_TTL_SECONDS = 30;
    private static final int USER_CACHE_TTL_SECONDS = 60;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_DEPARTMENT_LIMIT = 50;
    private static final int MAX_ACTIVITY_LIMIT = 20;
    private static final Set<String> PERFORMANCE_SORT_FIELDS = Set.of(
            "responseCount", "passRate", "averageConvertedScore", "lastSubmittedAt", "failedCriticalCount"
    );

    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    @Transactional(readOnly = true)
    public DashboardOverviewResponse overview(LocalDate fromDate, LocalDate toDate, Long departmentId) {
        DashboardPeriod period = resolvePeriod(fromDate, toDate, 366);
        DashboardOverviewResponse.Users users = overviewUsers(period, departmentId);
        DashboardOverviewResponse.Forms forms = overviewForms(departmentId);
        DashboardOverviewResponse.Submissions submissions = overviewSubmissions(period, departmentId);
        return DashboardOverviewResponse.builder()
                .generatedAt(generatedAt())
                .cacheTtlSeconds(OVERVIEW_CACHE_TTL_SECONDS)
                .period(new DashboardOverviewResponse.Period(period.fromDate(), period.toDate()))
                .users(users)
                .forms(forms)
                .submissions(submissions)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardUserSummaryResponse userSummary(Long departmentId) {
        MapSqlParameterSource params = departmentParams(departmentId);
        Map<String, Object> row = jdbc.queryForMap("""
                select
                    count(*) filter (where u.is_deleted = false) as total,
                    count(*) filter (where u.is_deleted = false and u.status = 'ACTIVE') as active,
                    count(*) filter (where u.is_deleted = false and u.status = 'INACTIVE') as inactive,
                    count(*) filter (where u.is_deleted = false and u.status = 'LOCKED') as locked,
                    count(*) filter (where u.is_deleted = true) as deleted,
                    count(*) filter (where u.is_deleted = false and u.first_login = true) as first_login_pending,
                    count(*) filter (where u.is_deleted = false and u.department_id is null) as without_department
                from users u
                where (:departmentId is null or u.department_id = :departmentId)
                """, params);
        List<DashboardUserSummaryResponse.RoleCount> byRole = jdbc.query("""
                select r.code as role_code, r.name as role_name, count(distinct u.id) as count
                from users u
                join user_roles ur on ur.user_id = u.id
                join roles r on r.id = ur.role_id
                where u.is_deleted = false
                  and (:departmentId is null or u.department_id = :departmentId)
                group by r.code, r.name
                order by count desc, r.code asc
                """, params, (rs, ignored) -> new DashboardUserSummaryResponse.RoleCount(
                rs.getString("role_code"),
                rs.getString("role_name"),
                rs.getLong("count")
        ));
        return DashboardUserSummaryResponse.builder()
                .generatedAt(generatedAt())
                .cacheTtlSeconds(USER_CACHE_TTL_SECONDS)
                .total(number(row, "total"))
                .byStatus(new LinkedHashMap<>(Map.of(
                        "ACTIVE", number(row, "active"),
                        "INACTIVE", number(row, "inactive"),
                        "LOCKED", number(row, "locked")
                )))
                .deleted(number(row, "deleted"))
                .firstLoginPending(number(row, "first_login_pending"))
                .withoutDepartment(number(row, "without_department"))
                .byRole(byRole)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardUsersByDepartmentResponse usersByDepartment(Integer limit) {
        int normalizedLimit = normalizeLimit(limit, 20, MAX_DEPARTMENT_LIMIT, "limit");
        MapSqlParameterSource params = new MapSqlParameterSource("limit", normalizedLimit);
        List<DashboardUsersByDepartmentResponse.Item> items = jdbc.query("""
                select
                    d.id as department_id,
                    d.department_code,
                    d.name as department_name,
                    count(u.id) filter (where u.is_deleted = false) as total,
                    count(u.id) filter (where u.is_deleted = false and u.status = 'ACTIVE') as active,
                    count(u.id) filter (where u.is_deleted = false and u.status = 'INACTIVE') as inactive,
                    count(u.id) filter (where u.is_deleted = false and u.status = 'LOCKED') as locked
                from departments d
                left join users u on u.department_id = d.id
                group by d.id, d.department_code, d.name
                order by total desc, d.name asc
                limit :limit
                """, params, (rs, ignored) -> DashboardUsersByDepartmentResponse.Item.builder()
                .departmentId(rs.getLong("department_id"))
                .departmentCode(rs.getString("department_code"))
                .departmentName(rs.getString("department_name"))
                .total(rs.getLong("total"))
                .active(rs.getLong("active"))
                .inactive(rs.getLong("inactive"))
                .locked(rs.getLong("locked"))
                .build());
        return DashboardUsersByDepartmentResponse.builder()
                .generatedAt(generatedAt())
                .cacheTtlSeconds(USER_CACHE_TTL_SECONDS)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardFormSummaryResponse formSummary(LocalDate fromDate, LocalDate toDate, Long departmentId) {
        DashboardPeriod period = resolvePeriod(fromDate, toDate, 366);
        MapSqlParameterSource params = baseParams(period, departmentId);
        params.addValue("nowInstant", dbInstant(Instant.now(clock)), Types.TIMESTAMP_WITH_TIMEZONE);
        Map<String, Object> forms = jdbc.queryForMap("""
                select
                    count(*) as total,
                    count(*) filter (where status = 'DRAFT') as draft,
                    count(*) filter (where status = 'PUBLISHED') as published,
                    count(*) filter (where status = 'RETIRED') as retired
                from form_templates
                where deleted = false
                  and (:departmentId is null or owner_department_id = :departmentId)
                """, params);
        Map<String, Object> versions = jdbc.queryForMap("""
                select
                    count(*) filter (where v.status = 'DRAFT') as draft,
                    count(*) filter (where v.status = 'PUBLISHED') as published,
                    count(*) filter (where v.status = 'RETIRED') as retired
                from form_versions v
                join form_templates f on f.id = v.form_template_id and f.deleted = false
                where (:departmentId is null or f.owner_department_id = :departmentId)
                """, params);
        Map<String, Object> assignments = jdbc.queryForMap("""
                select
                    count(*) filter (
                        where i.status = 'ACTIVE' and a.status = 'ACTIVE'
                          and (a.effective_from is null or a.effective_from <= :nowInstant)
                          and (a.effective_to is null or a.effective_to >= :nowInstant)
                    ) as active_items,
                    count(*) filter (
                        where i.status = 'ACTIVE' and a.status = 'ACTIVE'
                          and a.effective_to is not null and a.effective_to < :nowInstant
                    ) as expired_items,
                    count(*) filter (where i.status = 'REVOKED' or a.status = 'REVOKED') as revoked_items
                from form_assignment_items i
                join form_assignments a on a.id = i.assignment_id
                join form_templates f on f.id = i.form_template_id and f.deleted = false
                where (:departmentId is null or f.owner_department_id = :departmentId)
                """, params);
        DashboardOverviewResponse.Submissions responseStats = overviewSubmissions(period, departmentId);
        return DashboardFormSummaryResponse.builder()
                .generatedAt(generatedAt())
                .cacheTtlSeconds(OVERVIEW_CACHE_TTL_SECONDS)
                .forms(new DashboardFormSummaryResponse.Forms(
                        number(forms, "total"), number(forms, "draft"), number(forms, "published"), number(forms, "retired")))
                .versions(new DashboardFormSummaryResponse.Versions(
                        number(versions, "draft"), number(versions, "published"), number(versions, "retired")))
                .assignments(new DashboardFormSummaryResponse.Assignments(
                        number(assignments, "active_items"), number(assignments, "expired_items"), number(assignments, "revoked_items")))
                .responses(new DashboardFormSummaryResponse.Responses(
                        responseStats.totalInPeriod(),
                        responseStats.submitted(),
                        responseStats.draft(),
                        responseStats.voided(),
                        responseStats.passRate(),
                        responseStats.averageConvertedScore()
                ))
                .build();
    }

    @Transactional(readOnly = true)
    public Page<DashboardFormPerformanceResponse> formPerformance(
            LocalDate fromDate,
            LocalDate toDate,
            Long departmentId,
            Pageable pageable
    ) {
        DashboardPeriod period = resolvePeriod(fromDate, toDate, 366);
        Pageable normalized = normalizePageable(pageable, 10);
        Sort.Order order = normalized.getSort().isSorted()
                ? normalized.getSort().iterator().next()
                : Sort.Order.desc("responseCount");
        if (!PERFORMANCE_SORT_FIELDS.contains(order.getProperty())) {
            throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
        }
        String orderBy = performanceOrderBy(order);
        MapSqlParameterSource params = baseParams(period, departmentId)
                .addValue("limit", normalized.getPageSize())
                .addValue("offset", normalized.getOffset());
        String aggregateSql = """
                with filtered_submissions as (
                    select
                        s.id,
                        s.status,
                        s.result_status,
                        s.converted_score,
                        s.submitted_at,
                        fv.form_template_id
                    from form_submissions s
                    join form_versions fv on fv.id = s.form_version_id
                    left join form_submission_contexts ctx on ctx.submission_id = s.id
                    left join users subject_user on subject_user.id = ctx.subject_user_id
                    where %s
                      and (:departmentId is null or subject_user.department_id = :departmentId)
                ),
                agg as (
                    select
                        form_template_id,
                        count(*) as response_count,
                        count(*) filter (where status = 'SUBMITTED') as submitted_count,
                        count(*) filter (where status = 'SUBMITTED' and result_status = 'PASSED') as passed_count,
                        count(*) filter (where status = 'SUBMITTED' and result_status = 'FAILED_SCORE') as failed_score_count,
                        count(*) filter (where status = 'SUBMITTED' and result_status = 'FAILED_CRITICAL') as failed_critical_count,
                        avg(converted_score) filter (where status = 'SUBMITTED' and converted_score is not null) as average_converted_score,
                        max(submitted_at) filter (where status = 'SUBMITTED') as last_submitted_at
                    from filtered_submissions
                    group by form_template_id
                )
                """.formatted(periodPredicate("s"));
        List<DashboardFormPerformanceResponse> content = jdbc.query(aggregateSql + """
                select
                    f.id as form_id,
                    f.code as form_code,
                    f.title as form_title,
                    f.current_published_version_id,
                    f.current_version_no,
                    coalesce(a.response_count, 0) as response_count,
                    coalesce(a.submitted_count, 0) as submitted_count,
                    coalesce(a.passed_count, 0) as passed_count,
                    coalesce(a.failed_score_count, 0) as failed_score_count,
                    coalesce(a.failed_critical_count, 0) as failed_critical_count,
                    case when coalesce(a.submitted_count, 0) = 0
                         then 0
                         else round((a.passed_count * 100.0 / a.submitted_count)::numeric, 2)
                    end as pass_rate,
                    coalesce(round(a.average_converted_score::numeric, 4), 0) as average_converted_score,
                    a.last_submitted_at
                from form_templates f
                left join agg a on a.form_template_id = f.id
                where f.deleted = false
                order by %s, f.id desc
                limit :limit offset :offset
                """.formatted(orderBy), params, (rs, ignored) -> DashboardFormPerformanceResponse.builder()
                .formId(rs.getLong("form_id"))
                .formCode(rs.getString("form_code"))
                .formTitle(rs.getString("form_title"))
                .currentPublishedVersionId(nullableLong(rs.getObject("current_published_version_id")))
                .currentVersionNumber((Integer) rs.getObject("current_version_no"))
                .responseCount(rs.getLong("response_count"))
                .submittedCount(rs.getLong("submitted_count"))
                .passedCount(rs.getLong("passed_count"))
                .failedScoreCount(rs.getLong("failed_score_count"))
                .failedCriticalCount(rs.getLong("failed_critical_count"))
                .passRate(decimal(rs.getObject("pass_rate")))
                .averageConvertedScore(decimal(rs.getObject("average_converted_score")))
                .lastSubmittedAt(toInstant(rs.getObject("last_submitted_at")))
                .build());
        Long total = jdbc.queryForObject("select count(*) from form_templates where deleted = false",
                new MapSqlParameterSource(), Long.class);
        Pageable responsePageable = PageRequest.of(normalized.getPageNumber(), normalized.getPageSize(),
                Sort.by(order.getDirection(), order.getProperty()));
        return new PageImpl<>(content, responsePageable, total == null ? 0 : total);
    }

    @Transactional(readOnly = true)
    public DashboardFormTrendResponse formTrend(
            LocalDate fromDate,
            LocalDate toDate,
            DashboardTrendBucket bucket,
            Long departmentId
    ) {
        DashboardTrendBucket normalizedBucket = bucket == null ? DashboardTrendBucket.DAY : bucket;
        int maxDays = normalizedBucket == DashboardTrendBucket.DAY ? 366 : 365 * 5;
        DashboardPeriod period = resolvePeriod(fromDate, toDate, maxDays);
        String truncExpression = normalizedBucket == DashboardTrendBucket.DAY
                ? "date_trunc('day', s.submitted_at at time zone 'Asia/Bangkok')"
                : "date_trunc('month', s.submitted_at at time zone 'Asia/Bangkok')";
        String periodFormat = normalizedBucket == DashboardTrendBucket.DAY ? "YYYY-MM-DD" : "YYYY-MM";
        MapSqlParameterSource params = baseParams(period, departmentId);
        List<DashboardFormTrendResponse.Item> items = jdbc.query("""
                select
                    to_char(%s, '%s') as period,
                    count(*) as submitted_count,
                    count(*) filter (where s.result_status = 'PASSED') as passed_count,
                    count(*) filter (where s.result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed_count,
                    coalesce(round(avg(s.converted_score)::numeric, 4), 0) as average_converted_score
                from form_submissions s
                left join form_submission_contexts ctx on ctx.submission_id = s.id
                left join users subject_user on subject_user.id = ctx.subject_user_id
                where s.status = 'SUBMITTED'
                  and s.submitted_at >= :fromInstant and s.submitted_at < :toInstant
                  and (:departmentId is null or subject_user.department_id = :departmentId)
                group by %s
                order by %s asc
                """.formatted(truncExpression, periodFormat, truncExpression, truncExpression), params,
                (rs, ignored) -> DashboardFormTrendResponse.Item.builder()
                        .period(rs.getString("period"))
                        .submittedCount(rs.getLong("submitted_count"))
                        .passedCount(rs.getLong("passed_count"))
                        .failedCount(rs.getLong("failed_count"))
                        .averageConvertedScore(decimal(rs.getObject("average_converted_score")))
                        .build());
        return DashboardFormTrendResponse.builder()
                .bucket(normalizedBucket)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardRecentActivityResponse recentActivity(DashboardActivityType type, Integer limit) {
        int normalizedLimit = normalizeLimit(limit, 10, MAX_ACTIVITY_LIMIT, "limit");
        List<DashboardRecentActivityResponse.Item> items = new ArrayList<>();
        if (type == null || type == DashboardActivityType.SUBMISSION) {
            items.addAll(submissionActivities(normalizedLimit));
        }
        if (type == null || type == DashboardActivityType.FORM) {
            items.addAll(formActivities(normalizedLimit));
        }
        if (type == null || type == DashboardActivityType.ASSIGNMENT) {
            items.addAll(assignmentActivities(normalizedLimit));
        }
        items = items.stream()
                .filter(item -> item.occurredAt() != null)
                .sorted(Comparator.comparing(DashboardRecentActivityResponse.Item::occurredAt).reversed())
                .limit(normalizedLimit)
                .toList();
        return DashboardRecentActivityResponse.builder().items(items).build();
    }

    private DashboardOverviewResponse.Users overviewUsers(DashboardPeriod period, Long departmentId) {
        MapSqlParameterSource params = baseParams(period, departmentId);
        Map<String, Object> row = jdbc.queryForMap("""
                select
                    count(distinct u.id) filter (where u.is_deleted = false) as total,
                    count(distinct u.id) filter (where u.is_deleted = false and u.status = 'ACTIVE') as active,
                    count(distinct u.id) filter (where u.is_deleted = false and u.status = 'INACTIVE') as inactive,
                    count(distinct u.id) filter (where u.is_deleted = false and u.status = 'LOCKED') as locked,
                    count(distinct u.id) filter (where u.is_deleted = true) as deleted,
                    count(distinct u.id) filter (where u.is_deleted = false and u.first_login = true) as first_login_pending,
                    count(distinct u.id) filter (where u.is_deleted = false and u.created_at >= :fromLocal and u.created_at < :toLocal) as new_in_period,
                    count(distinct u.id) filter (where u.is_deleted = false and r.code = 'MANAGER') as managers,
                    count(distinct u.id) filter (where u.is_deleted = false and r.code = 'ADMIN') as admins
                from users u
                left join user_roles ur on ur.user_id = u.id
                left join roles r on r.id = ur.role_id
                where (:departmentId is null or u.department_id = :departmentId)
                """, params);
        return DashboardOverviewResponse.Users.builder()
                .total(number(row, "total"))
                .active(number(row, "active"))
                .inactive(number(row, "inactive"))
                .locked(number(row, "locked"))
                .deleted(number(row, "deleted"))
                .firstLoginPending(number(row, "first_login_pending"))
                .newInPeriod(number(row, "new_in_period"))
                .managers(number(row, "managers"))
                .admins(number(row, "admins"))
                .build();
    }

    private DashboardOverviewResponse.Forms overviewForms(Long departmentId) {
        MapSqlParameterSource params = departmentParams(departmentId)
                .addValue("nowInstant", dbInstant(Instant.now(clock)), Types.TIMESTAMP_WITH_TIMEZONE);
        Map<String, Object> row = jdbc.queryForMap("""
                select
                    count(*) filter (where f.deleted = false) as total,
                    count(*) filter (where f.deleted = false and f.status = 'DRAFT') as draft,
                    count(*) filter (where f.deleted = false and f.status = 'PUBLISHED') as published,
                    count(*) filter (where f.deleted = false and f.status = 'RETIRED') as retired,
                    (
                        select count(*)
                        from form_versions v
                        join form_templates vf on vf.id = v.form_template_id and vf.deleted = false
                        where v.status = 'PUBLISHED'
                          and (:departmentId is null or vf.owner_department_id = :departmentId)
                    ) as published_versions,
                    (
                        select count(*)
                        from form_assignment_items i
                        join form_assignments a on a.id = i.assignment_id
                        join form_templates af on af.id = i.form_template_id and af.deleted = false
                        where i.status = 'ACTIVE' and a.status = 'ACTIVE'
                          and (a.effective_from is null or a.effective_from <= :nowInstant)
                          and (a.effective_to is null or a.effective_to >= :nowInstant)
                          and (:departmentId is null or af.owner_department_id = :departmentId)
                    ) as active_assignments
                from form_templates f
                where (:departmentId is null or f.owner_department_id = :departmentId)
                """, params);
        return DashboardOverviewResponse.Forms.builder()
                .total(number(row, "total"))
                .draft(number(row, "draft"))
                .published(number(row, "published"))
                .retired(number(row, "retired"))
                .publishedVersions(number(row, "published_versions"))
                .activeAssignments(number(row, "active_assignments"))
                .build();
    }

    private DashboardOverviewResponse.Submissions overviewSubmissions(DashboardPeriod period, Long departmentId) {
        MapSqlParameterSource params = baseParams(period, departmentId);
        Map<String, Object> row = jdbc.queryForMap("""
                select
                    count(*) as total_in_period,
                    count(*) filter (where s.status = 'DRAFT') as draft,
                    count(*) filter (where s.status = 'SUBMITTED') as submitted,
                    count(*) filter (where s.status = 'VOIDED') as voided,
                    count(*) filter (where s.status = 'SUBMITTED' and s.result_status = 'PASSED') as passed,
                    count(*) filter (where s.status = 'SUBMITTED' and s.result_status = 'FAILED_SCORE') as failed_score,
                    count(*) filter (where s.status = 'SUBMITTED' and s.result_status = 'FAILED_CRITICAL') as failed_critical,
                    case when count(*) filter (where s.status = 'SUBMITTED') = 0
                         then 0
                         else round((
                            count(*) filter (where s.status = 'SUBMITTED' and s.result_status = 'PASSED') * 100.0
                            / count(*) filter (where s.status = 'SUBMITTED')
                         )::numeric, 2)
                    end as pass_rate,
                    coalesce(round((avg(s.converted_score) filter (where s.status = 'SUBMITTED' and s.converted_score is not null))::numeric, 4), 0) as average_converted_score
                from form_submissions s
                left join form_submission_contexts ctx on ctx.submission_id = s.id
                left join users subject_user on subject_user.id = ctx.subject_user_id
                where %s
                  and (:departmentId is null or subject_user.department_id = :departmentId)
                """.formatted(periodPredicate("s")), params);
        return DashboardOverviewResponse.Submissions.builder()
                .totalInPeriod(number(row, "total_in_period"))
                .draft(number(row, "draft"))
                .submitted(number(row, "submitted"))
                .voided(number(row, "voided"))
                .passed(number(row, "passed"))
                .failedScore(number(row, "failed_score"))
                .failedCritical(number(row, "failed_critical"))
                .passRate(decimal(row.get("pass_rate")))
                .averageConvertedScore(decimal(row.get("average_converted_score")))
                .build();
    }

    private List<DashboardRecentActivityResponse.Item> submissionActivities(int limit) {
        return jdbc.query("""
                select
                    s.id as submission_id,
                    s.submitted_at as occurred_at,
                    f.id as form_id,
                    f.code as form_code,
                    f.title as form_title,
                    u.employee_code,
                    u.name as full_name
                from form_submissions s
                join form_versions v on v.id = s.form_version_id
                join form_templates f on f.id = v.form_template_id
                join users u on u.id = s.submitted_by_user_id
                where s.status = 'SUBMITTED' and s.submitted_at is not null
                order by s.submitted_at desc
                limit :limit
                """, new MapSqlParameterSource("limit", limit), (rs, ignored) -> DashboardRecentActivityResponse.Item.builder()
                .type(DashboardActivityType.SUBMISSION)
                .occurredAt(toInstant(rs.getObject("occurred_at")))
                .title(rs.getString("full_name") + " submitted " + rs.getString("form_title"))
                .formId(rs.getLong("form_id"))
                .formCode(rs.getString("form_code"))
                .submissionId(rs.getLong("submission_id"))
                .actor(new DashboardRecentActivityResponse.Actor(rs.getString("employee_code"), rs.getString("full_name")))
                .build());
    }

    private List<DashboardRecentActivityResponse.Item> formActivities(int limit) {
        return jdbc.query("""
                select
                    id as form_id,
                    code as form_code,
                    title as form_title,
                    coalesce(updated_at, created_at) as occurred_at
                from form_templates
                where deleted = false
                order by coalesce(updated_at, created_at) desc
                limit :limit
                """, new MapSqlParameterSource("limit", limit), (rs, ignored) -> DashboardRecentActivityResponse.Item.builder()
                .type(DashboardActivityType.FORM)
                .occurredAt(toInstant(rs.getObject("occurred_at")))
                .title("Form updated: " + rs.getString("form_title"))
                .formId(rs.getLong("form_id"))
                .formCode(rs.getString("form_code"))
                .build());
    }

    private List<DashboardRecentActivityResponse.Item> assignmentActivities(int limit) {
        return jdbc.query("""
                select
                    a.id as assignment_id,
                    a.assigned_at as occurred_at,
                    f.id as form_id,
                    f.code as form_code,
                    f.title as form_title,
                    manager.employee_code,
                    manager.name as full_name
                from form_assignment_items i
                join form_assignments a on a.id = i.assignment_id
                join form_templates f on f.id = i.form_template_id
                join users manager on manager.id = a.manager_user_id
                order by a.assigned_at desc, i.id desc
                limit :limit
                """, new MapSqlParameterSource("limit", limit), (rs, ignored) -> DashboardRecentActivityResponse.Item.builder()
                .type(DashboardActivityType.ASSIGNMENT)
                .occurredAt(toInstant(rs.getObject("occurred_at")))
                .title("Assigned " + rs.getString("form_title") + " to " + rs.getString("full_name"))
                .formId(rs.getLong("form_id"))
                .formCode(rs.getString("form_code"))
                .assignmentId(rs.getLong("assignment_id"))
                .actor(new DashboardRecentActivityResponse.Actor(rs.getString("employee_code"), rs.getString("full_name")))
                .build());
    }

    private DashboardPeriod resolvePeriod(LocalDate fromDate, LocalDate toDate, int maxDaysInclusive) {
        LocalDate today = LocalDate.now(clock.withZone(DASHBOARD_ZONE));
        LocalDate to = toDate == null ? today : toDate;
        LocalDate from = fromDate == null ? to.minusDays(29) : fromDate;
        if (to.isBefore(from)) {
            throw ValidationException.field("toDate", "toDate must be greater than or equal to fromDate");
        }
        long days = Duration.between(from.atStartOfDay(), to.plusDays(1).atStartOfDay()).toDays();
        if (days > maxDaysInclusive) {
            throw ValidationException.field("toDate", "Date range is too large");
        }
        return new DashboardPeriod(from, to,
                from.atStartOfDay(DASHBOARD_ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(DASHBOARD_ZONE).toInstant(),
                from.atStartOfDay(),
                to.plusDays(1).atStartOfDay());
    }

    private MapSqlParameterSource baseParams(DashboardPeriod period, Long departmentId) {
        return departmentParams(departmentId)
                .addValue("fromInstant", dbInstant(period.fromInstant()), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("toInstant", dbInstant(period.toInstant()), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("fromLocal", period.fromLocal(), Types.TIMESTAMP)
                .addValue("toLocal", period.toLocal(), Types.TIMESTAMP);
    }

    private MapSqlParameterSource departmentParams(Long departmentId) {
        return new MapSqlParameterSource()
                .addValue("departmentId", departmentId, Types.BIGINT);
    }

    private OffsetDateTime dbInstant(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private String periodPredicate(String alias) {
        return """
                (
                    (%1$s.status = 'SUBMITTED' and %1$s.submitted_at >= :fromInstant and %1$s.submitted_at < :toInstant)
                    or (%1$s.status <> 'SUBMITTED' and %1$s.created_at >= :fromLocal and %1$s.created_at < :toLocal)
                )
                """.formatted(alias);
    }

    private Pageable normalizePageable(Pageable pageable, int defaultSize) {
        int page = Math.max(pageable.getPageNumber(), 0);
        int size = pageable.isPaged() ? pageable.getPageSize() : defaultSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(page, size, pageable.getSort());
    }

    private int normalizeLimit(Integer value, int defaultValue, int max, String field) {
        int limit = value == null ? defaultValue : value;
        if (limit < 1 || limit > max) {
            throw ValidationException.field(field, field + " must be between 1 and " + max);
        }
        return limit;
    }

    private String performanceOrderBy(Sort.Order order) {
        String column = switch (order.getProperty()) {
            case "responseCount" -> "response_count";
            case "passRate" -> "pass_rate";
            case "averageConvertedScore" -> "average_converted_score";
            case "lastSubmittedAt" -> "last_submitted_at";
            case "failedCriticalCount" -> "failed_critical_count";
            default -> throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
        };
        return column + (order.isAscending() ? " asc nulls last" : " desc nulls last");
    }

    private OffsetDateTime generatedAt() {
        return OffsetDateTime.now(clock).atZoneSameInstant(DASHBOARD_ZONE).toOffsetDateTime();
    }

    private long number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(String.valueOf(value));
    }

    private Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        if (value instanceof LocalDateTime localDateTime) return localDateTime.atZone(DASHBOARD_ZONE).toInstant();
        return Instant.parse(String.valueOf(value));
    }

    private record DashboardPeriod(
            LocalDate fromDate,
            LocalDate toDate,
            Instant fromInstant,
            Instant toInstant,
            LocalDateTime fromLocal,
            LocalDateTime toLocal
    ) {}
}

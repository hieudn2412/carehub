package vn.vietduc.carehubbackend.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormFilter;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormFilterOptionsResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormResultFilter;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormTrendResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardTrendBucket;
import vn.vietduc.carehubbackend.dashboard.dto.QualityChecklistPerformanceResponse;
import vn.vietduc.carehubbackend.dashboard.dto.QualityChecklistView;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.math.BigDecimal;
import java.sql.Types;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QualityChecklistDashboardService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Bangkok");
    private static final int MAX_PAGE_SIZE = 100;

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<QualityChecklistPerformanceResponse> performance(
            QualityChecklistView view,
            String keyword,
            DashboardFormFilter filter,
            Pageable pageable
    ) {
        Scope scope = scope(filter.departmentId());
        Period period = period(filter.fromDate(), filter.toDate());
        QualityChecklistView effectiveView = view == null ? QualityChecklistView.LATEST : view;
        int requestedSize = effectiveView == QualityChecklistView.LATEST ? 1 : pageable.getPageSize();
        if (requestedSize < 1 || requestedSize > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Kích thước trang phải từ 1 đến 100");
        }
        int pageNumber = effectiveView == QualityChecklistView.LATEST ? 0 : Math.max(0, pageable.getPageNumber());
        PageRequest normalized = PageRequest.of(pageNumber, requestedSize);
        MapSqlParameterSource params = params(scope, period, keyword, filter)
                .addValue("limit", normalized.getPageSize())
                .addValue("offset", normalized.getOffset());

        String cte = eligibleFormsCte(scope) + ",\n" + aggregateCte(scope);
        String latestCondition = effectiveView == QualityChecklistView.LATEST
                ? "and a.last_submitted_at is not null\n" : "";
        String targetCondition = targetCondition();
        List<QualityChecklistPerformanceResponse> content = jdbc.query(cte + """
                select
                    ef.form_id,
                    ef.form_code,
                    ef.form_title,
                    ef.current_published_version_id,
                    ef.version_number,
                    coalesce(a.monitoring_count, 0) as monitoring_count,
                    coalesce(a.passed_count, 0) as passed_count,
                    coalesce(a.failed_count, 0) as failed_count,
                    coalesce(a.unique_subject_count, 0) as unique_subject_count,
                    case when coalesce(a.monitoring_count, 0) = 0 then null
                         else round((a.passed_count * 100.0 / a.monitoring_count)::numeric, 2)
                    end as compliance_rate,
                    round(a.average_converted_score::numeric, 2) as average_converted_score,
                    a.last_submitted_at,
                    coalesce(dt.target_percent, ht.target_percent, 80.00) as target_percent,
                    case when dt.id is not null then 'DEPARTMENT'
                         when ht.id is not null then 'HOSPITAL'
                         else 'DEFAULT'
                    end as target_source
                from eligible_forms ef
                left join aggregate_submissions a on a.form_id = ef.form_id
                left join form_compliance_targets ht
                  on ht.form_template_id = ef.form_id and ht.department_id is null
                left join form_compliance_targets dt
                  on dt.form_template_id = ef.form_id and dt.department_id = :targetDepartmentId
                where 1 = 1
                """ + latestCondition + targetCondition + """
                order by a.last_submitted_at desc nulls last, ef.form_title asc, ef.form_id asc
                limit :limit offset :offset
                """, params, (rs, ignored) -> QualityChecklistPerformanceResponse.builder()
                .formId(rs.getLong("form_id"))
                .formCode(rs.getString("form_code"))
                .formTitle(rs.getString("form_title"))
                .currentPublishedVersionId(rs.getLong("current_published_version_id"))
                .versionNumber(rs.getInt("version_number"))
                .monitoringCount(rs.getLong("monitoring_count"))
                .passedCount(rs.getLong("passed_count"))
                .failedCount(rs.getLong("failed_count"))
                .uniqueSubjectCount(rs.getLong("unique_subject_count"))
                .complianceRate(decimal(rs.getObject("compliance_rate")))
                .averageConvertedScore(decimal(rs.getObject("average_converted_score")))
                .lastSubmittedAt(instant(rs.getObject("last_submitted_at")))
                .targetPercent(decimal(rs.getObject("target_percent")))
                .targetSource(rs.getString("target_source"))
                .build());

        Long total = effectiveView == QualityChecklistView.LATEST
                ? (long) content.size()
                : jdbc.queryForObject(cte + """
                    select count(*)
                    from eligible_forms ef
                    left join aggregate_submissions a on a.form_id = ef.form_id
                    left join form_compliance_targets ht
                      on ht.form_template_id = ef.form_id and ht.department_id is null
                    left join form_compliance_targets dt
                      on dt.form_template_id = ef.form_id and dt.department_id = :targetDepartmentId
                    where 1 = 1
                    """ + targetCondition, params, Long.class);
        return new PageImpl<>(content, normalized, total == null ? 0 : total);
    }

    @Transactional(readOnly = true)
    public DashboardFormFilterOptionsResponse filterOptions(LocalDate fromDate, LocalDate toDate,
                                                             Long requestedDepartmentId) {
        Scope scope = scope(requestedDepartmentId);
        Period period = period(fromDate, toDate);
        DashboardFormFilter emptyFilter = new DashboardFormFilter(fromDate, toDate, scope.metricDepartmentId(),
                null, null, null, null, null);
        MapSqlParameterSource params = params(scope, period, null, emptyFilter);
        String eligible = eligibleFormsCte(scope);
        List<DashboardFormFilterOptionsResponse.FormOption> forms = jdbc.query(eligible + """
                select form_id, form_code, form_title from eligible_forms
                order by form_title asc, form_id asc
                """, params, (rs, ignored) -> DashboardFormFilterOptionsResponse.FormOption.builder()
                .id(rs.getLong("form_id")).code(rs.getString("form_code"))
                .title(rs.getString("form_title")).build());

        String scopedSubmissions = eligible + ", scoped_submissions as (\n" + scopedSubmissionSelect(scope) + "\n)\n";
        List<DashboardFormFilterOptionsResponse.UserOption> subjects = jdbc.query(scopedSubmissions + """
                select distinct u.id, u.employee_code, u.name
                from scoped_submissions ss
                join form_submission_contexts ctx on ctx.submission_id = ss.id
                join users u on u.id = ctx.subject_user_id
                order by u.name asc, u.id asc
                """, params, (rs, ignored) -> userOption(rs.getLong("id"), rs.getString("employee_code"), rs.getString("name")));
        List<DashboardFormFilterOptionsResponse.UserOption> evaluators = jdbc.query(scopedSubmissions + """
                select distinct u.id, u.employee_code, u.name
                from scoped_submissions ss
                join users u on u.id = ss.submitted_by_user_id
                order by u.name asc, u.id asc
                """, params, (rs, ignored) -> userOption(rs.getLong("id"), rs.getString("employee_code"), rs.getString("name")));
        return DashboardFormFilterOptionsResponse.builder().generatedAt(OffsetDateTime.now(clock))
                .forms(forms).subjects(subjects).evaluators(evaluators).build();
    }

    @Transactional(readOnly = true)
    public DashboardFormTrendResponse trend(DashboardFormFilter filter, DashboardTrendBucket bucket) {
        Scope scope = scope(filter.departmentId());
        Period period = period(filter.fromDate(), filter.toDate());
        DashboardTrendBucket effectiveBucket = bucket == null ? DashboardTrendBucket.MONTH : bucket;
        String trunc = effectiveBucket == DashboardTrendBucket.DAY
                ? "date_trunc('day', ss.submitted_at at time zone 'Asia/Bangkok')"
                : "date_trunc('month', ss.submitted_at at time zone 'Asia/Bangkok')";
        String format = effectiveBucket == DashboardTrendBucket.DAY ? "YYYY-MM-DD" : "YYYY-MM";
        MapSqlParameterSource params = params(scope, period, null, filter);
        String sql = eligibleFormsCte(scope) + ", scoped_submissions as (\n" + scopedSubmissionSelect(scope) + "\n)\n";
        List<DashboardFormTrendResponse.Item> items = jdbc.query(sql + """
                select to_char(%s, '%s') as period,
                       count(*) as submitted_count,
                       count(*) filter (where ss.result_status = 'PASSED') as passed_count,
                       count(*) filter (where ss.result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed_count,
                       round(avg(ss.converted_score)::numeric, 2) as average_converted_score
                from scoped_submissions ss
                group by %s
                order by %s asc
                """.formatted(trunc, format, trunc, trunc), params, (rs, ignored) ->
                DashboardFormTrendResponse.Item.builder().period(rs.getString("period"))
                        .submittedCount(rs.getLong("submitted_count"))
                        .passedCount(rs.getLong("passed_count"))
                        .failedCount(rs.getLong("failed_count"))
                        .averageConvertedScore(decimal(rs.getObject("average_converted_score"))).build());
        return DashboardFormTrendResponse.builder().bucket(effectiveBucket).items(items).build();
    }

    private String eligibleFormsCte(Scope scope) {
        String activeAssignmentExists = """
                exists (
                    select 1
                    from form_assignment_items fai
                    join form_assignments fa on fa.id = fai.assignment_id
                    where fai.form_template_id = f.id
                      and fai.form_version_id = f.current_published_version_id
                      and fai.status = 'ACTIVE'
                      and fa.status = 'ACTIVE'
                      and fa.manager_user_id = :actorId
                      and (fa.effective_from is null or fa.effective_from <= :now)
                      and (fa.effective_to is null or fa.effective_to >= :now)
                )
                """;
        String assignmentPredicate = switch (scope.role()) {
            case ADMIN -> "";
            case USER -> "and " + activeAssignmentExists;
            case MANAGER -> """
                    and (
                """ + activeAssignmentExists + """
                        or exists (
                            select 1
                            from form_submissions historical_submission
                            join form_versions historical_version
                              on historical_version.id = historical_submission.form_version_id
                            join form_submission_contexts historical_context
                              on historical_context.submission_id = historical_submission.id
                            join users historical_subject
                              on historical_subject.id = historical_context.subject_user_id
                            where historical_version.form_template_id = f.id
                              and historical_submission.status = 'SUBMITTED'
                              and historical_subject.department_id = :metricDepartmentId
                        )
                    )
                    """;
        };
        return """
                with eligible_forms as (
                    select f.id as form_id, f.code as form_code, f.title as form_title,
                           f.current_published_version_id, f.current_version_no as version_number
                    from form_templates f
                    join form_versions current_version on current_version.id = f.current_published_version_id
                    where f.deleted = false
                      and f.status = 'PUBLISHED'
                      and current_version.status = 'PUBLISHED'
                      and (:formId is null or f.id = :formId)
                      and (:keyword is null or lower(f.code) like :keyword or lower(f.title) like :keyword)
                """ + assignmentPredicate + "\n)";
    }

    private String aggregateCte(Scope scope) {
        return """
                aggregate_submissions as (
                    select ss.form_id,
                           count(*) as monitoring_count,
                           count(*) filter (where ss.result_status = 'PASSED') as passed_count,
                           count(*) filter (where ss.result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed_count,
                           count(distinct ss.subject_user_id) filter (where ss.subject_user_id is not null) as unique_subject_count,
                           avg(ss.converted_score) filter (where ss.converted_score is not null) as average_converted_score,
                           max(ss.submitted_at) as last_submitted_at
                    from (
                """ + scopedSubmissionSelect(scope) + """
                    ) ss
                    group by ss.form_id
                )
                """;
    }

    private String targetCondition() {
        String target = "coalesce(dt.target_percent, ht.target_percent, 80.00)";
        String rate = "(a.passed_count * 100.0 / nullif(a.monitoring_count, 0))";
        return """
                and (
                    :targetStatus is null
                    or (:targetStatus = 'MET' and coalesce(a.monitoring_count, 0) > 0 and %s > %s)
                    or (:targetStatus = 'NOT_MET' and (
                        coalesce(a.monitoring_count, 0) = 0
                        or %s <= %s
                    ))
                )
                """.formatted(rate, target, rate, target);
    }

    private String scopedSubmissionSelect(Scope scope) {
        String departmentPredicate = scope.metricDepartmentId() == null
                ? "" : "and (subject_user.department_id = :metricDepartmentId or subject_user.id is null)";
        String evaluatorPredicate = scope.role() == Role.USER
                ? "and s.submitted_by_user_id = :actorId"
                : "and (:submittedByUserId is null or s.submitted_by_user_id = :submittedByUserId)";
        return """
                select s.id, fv.form_template_id as form_id, s.result_status, s.converted_score,
                       s.submitted_at, s.submitted_by_user_id, ctx.subject_user_id
                from form_submissions s
                join form_versions fv on fv.id = s.form_version_id
                join eligible_forms ef on ef.form_id = fv.form_template_id
                left join form_submission_contexts ctx on ctx.submission_id = s.id
                left join users subject_user on subject_user.id = ctx.subject_user_id
                where s.status = 'SUBMITTED'
                  and s.submitted_at >= :fromInstant and s.submitted_at < :toInstant
                  and (:subjectUserId is null or ctx.subject_user_id = :subjectUserId)
                  %s
                  %s
                  and (
                      :resultStatus is null
                      or s.result_status = :resultStatus
                      or (:resultStatus = 'FAILED' and s.result_status in ('FAILED_SCORE', 'FAILED_CRITICAL'))
                  )
                """.formatted(departmentPredicate, evaluatorPredicate);
    }

    private MapSqlParameterSource params(Scope scope, Period period, String keyword, DashboardFormFilter filter) {
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null : "%" + keyword.trim().toLowerCase() + "%";
        String result = filter.resultStatus() == null ? null : filter.resultStatus().name();
        String targetStatus = filter.targetStatus() == null ? null : filter.targetStatus().name();
        return new MapSqlParameterSource()
                .addValue("actorId", scope.actorId(), Types.BIGINT)
                .addValue("now", OffsetDateTime.ofInstant(Instant.now(clock), ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("metricDepartmentId", scope.metricDepartmentId(), Types.BIGINT)
                .addValue("targetDepartmentId", scope.targetDepartmentId(), Types.BIGINT)
                .addValue("fromInstant", OffsetDateTime.ofInstant(period.from(), ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("toInstant", OffsetDateTime.ofInstant(period.to(), ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("keyword", normalizedKeyword, Types.VARCHAR)
                .addValue("formId", filter.formId(), Types.BIGINT)
                .addValue("subjectUserId", filter.subjectUserId(), Types.BIGINT)
                .addValue("submittedByUserId", scope.role() == Role.USER ? scope.actorId() : filter.submittedByUserId(), Types.BIGINT)
                .addValue("resultStatus", result, Types.VARCHAR)
                .addValue("targetStatus", targetStatus, Types.VARCHAR);
    }

    private Scope scope(Long requestedDepartmentId) {
        Set<String> roles = roles();
        Long actorId = securityUtils.getCurrentUserId();
        if (roles.contains("ADMIN")) return new Scope(Role.ADMIN, actorId, requestedDepartmentId, requestedDepartmentId);
        User actor = userRepository.findByIdAndIsDeletedFalse(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng hiện tại"));
        Long ownDepartmentId = actor.getDepartment() == null ? null : actor.getDepartment().getId();
        if (roles.contains("MANAGER")) {
            if (ownDepartmentId == null) throw new ForbiddenException("Manager chưa được gán khoa/phòng");
            return new Scope(Role.MANAGER, actorId, ownDepartmentId, ownDepartmentId);
        }
        if (roles.contains("USER")) return new Scope(Role.USER, actorId, null, ownDepartmentId);
        throw new ForbiddenException("Bạn không có quyền xem dashboard chất lượng chăm sóc");
    }

    private Period period(LocalDate fromDate, LocalDate toDate) {
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        LocalDate from = fromDate == null ? LocalDate.of(today.getYear(), 1, 1) : fromDate;
        LocalDate to = toDate == null ? today : toDate;
        if (from.isAfter(to)) throw ValidationException.field("fromDate", "Từ ngày không được sau đến ngày");
        return new Period(from.atStartOfDay(BUSINESS_ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant());
    }

    private Set<String> roles() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) throw new ForbiddenException("Thiếu thông tin xác thực");
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .map(value -> value.startsWith("ROLE_") ? value.substring(5) : value)
                .collect(Collectors.toSet());
    }

    private DashboardFormFilterOptionsResponse.UserOption userOption(Long id, String code, String name) {
        return DashboardFormFilterOptionsResponse.UserOption.builder().id(id).employeeCode(code).name(name).build();
    }

    private BigDecimal decimal(Object value) {
        return value == null ? null : value instanceof BigDecimal decimal ? decimal : new BigDecimal(value.toString());
    }

    private Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime offset) return offset.toInstant();
        return ((java.sql.Timestamp) value).toInstant();
    }

    private enum Role { ADMIN, MANAGER, USER }
    private record Scope(Role role, Long actorId, Long metricDepartmentId, Long targetDepartmentId) {}
    private record Period(Instant from, Instant to) {}
}

package vn.vietduc.carehubbackend.form.submission.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.service.FormService;
import vn.vietduc.carehubbackend.form.service.FormVersionService;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistoryTotalsResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormVersionHistorySummaryResponse;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class FormHistoryService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Bangkok");

    private final NamedParameterJdbcTemplate jdbc;
    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final FormService formService;
    private final FormVersionService versionService;
    private final FormHistoryAccessPolicy accessPolicy;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<FormHistorySummaryResponse> searchForms(
            String keyword, LocalDate dateFrom, LocalDate dateTo, Pageable pageable) {
        Pageable normalized = normalize(pageable);
        FormHistoryAccessPolicy.Scope scope = accessPolicy.requireHistoryScope();
        Period period = period(dateFrom, dateTo);
        MapSqlParameterSource params = params(scope, period, keyword)
                .addValue("limit", normalized.getPageSize())
                .addValue("offset", normalized.getOffset());

        String eligible = eligibleFormsCte(scope);
        String aggregate = """
                , scoped_submissions as (
                    select ev.form_id, s.result_status, s.submitted_at
                    from eligible_versions ev
                    join form_submissions s on s.form_version_id = ev.version_id
                    left join form_submission_contexts ctx on ctx.submission_id = s.id
                    left join users subject_user on subject_user.id = ctx.subject_user_id
                    where s.status = 'SUBMITTED'
                      and s.submitted_at >= :fromInstant
                      and s.submitted_at < :toInstant
                      and (:isAdmin = true or subject_user.department_id = :departmentId)
                ), aggregate_submissions as (
                    select form_id,
                           count(*) as monitoring_count,
                           count(*) filter (where result_status = 'PASSED') as passed_count,
                           count(*) filter (where result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed_count,
                           max(submitted_at) as last_submitted_at
                    from scoped_submissions
                    group by form_id
                )
                """;

        List<FormHistorySummaryResponse> content = jdbc.query(eligible + aggregate + """
                select ef.form_id, ef.form_code, ef.form_title, ef.version_count,
                       coalesce(a.monitoring_count, 0) as monitoring_count,
                       coalesce(a.passed_count, 0) as passed_count,
                       coalesce(a.failed_count, 0) as failed_count,
                       case when coalesce(a.monitoring_count, 0) = 0 then null
                            else round((a.passed_count * 100.0 / a.monitoring_count)::numeric, 2)
                       end as compliance_rate,
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
                order by a.last_submitted_at desc nulls last, ef.form_title asc, ef.form_id asc
                limit :limit offset :offset
                """, params, (rs, ignored) -> {
            long monitoringCount = rs.getLong("monitoring_count");
            return new FormHistorySummaryResponse(
                    rs.getLong("form_id"),
                    rs.getString("form_code"),
                    rs.getString("form_title"),
                    rs.getLong("version_count"),
                    monitoringCount,
                    monitoringCount,
                    rs.getLong("passed_count"),
                    rs.getLong("failed_count"),
                    decimal(rs.getObject("compliance_rate")),
                    instant(rs.getObject("last_submitted_at")),
                    decimal(rs.getObject("target_percent")),
                    rs.getString("target_source")
            );
        });

        Long total = jdbc.queryForObject(eligible + "select count(*) from eligible_forms", params, Long.class);
        return new PageImpl<>(content, normalized, total == null ? 0 : total);
    }

    @Transactional(readOnly = true)
    public FormHistoryTotalsResponse getSummary(
            LocalDate dateFrom, LocalDate dateTo, Long subjectUserId) {
        FormHistoryAccessPolicy.Scope scope = accessPolicy.requireHistoryScope();
        Period period = period(dateFrom, dateTo);
        MapSqlParameterSource queryParams = params(scope, period, null)
                .addValue("subjectUserId", subjectUserId, Types.BIGINT);

        return jdbc.queryForObject(eligibleFormsCte(scope) + """
                select
                    count(*) as monitoring_count,
                    count(*) filter (where s.result_status = 'PASSED') as passed_count,
                    count(*) filter (where s.result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed_count,
                    case when count(*) = 0 then 0
                         else round((count(*) filter (where s.result_status = 'PASSED') * 100.0 / count(*))::numeric, 2)
                    end as compliance_rate,
                    coalesce(round(avg(s.converted_score)::numeric, 2), 0) as average_converted_score
                from eligible_versions ev
                join eligible_forms ef on ef.form_id = ev.form_id
                join form_submissions s on s.form_version_id = ev.version_id
                left join form_submission_contexts ctx on ctx.submission_id = s.id
                left join users subject_user on subject_user.id = ctx.subject_user_id
                where s.status = 'SUBMITTED'
                  and s.submitted_at >= :fromInstant
                  and s.submitted_at < :toInstant
                  and (:isAdmin = true or subject_user.department_id = :departmentId)
                  and (:subjectUserId is null or subject_user.id = :subjectUserId)
                """, queryParams, (rs, ignored) -> new FormHistoryTotalsResponse(
                rs.getLong("monitoring_count"),
                rs.getLong("passed_count"),
                rs.getLong("failed_count"),
                decimal(rs.getObject("compliance_rate")),
                decimal(rs.getObject("average_converted_score"))
        ));
    }

    @Transactional(readOnly = true)
    public FormResponse getForm(Long formId) {
        accessPolicy.requireFormAccess(formId);
        return formService.get(formId);
    }

    @Transactional(readOnly = true)
    public List<FormVersionHistorySummaryResponse> getVersions(
            Long formId, LocalDate dateFrom, LocalDate dateTo) {
        formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        accessPolicy.requireFormAccess(formId);
        FormHistoryAccessPolicy.Scope scope = accessPolicy.requireHistoryScope();
        Period period = period(dateFrom, dateTo);
        MapSqlParameterSource params = params(scope, period, null).addValue("formId", formId, Types.BIGINT);

        return jdbc.query("""
                with history_versions as (
                    select fv.id as version_id, fv.form_template_id as form_id,
                           fv.version_no as version_number, fv.title, fv.description, fv.status,
                           fv.published_at, publisher.name as published_by
                    from form_versions fv
                    left join users publisher on publisher.id = fv.created_by_user_id
                    where fv.form_template_id = :formId
                      and fv.status in ('PUBLISHED', 'RETIRED')
                ), scoped_submissions as (
                    select s.form_version_id, s.result_status, s.converted_score, s.submitted_at
                    from form_submissions s
                    join history_versions hv on hv.version_id = s.form_version_id
                    left join form_submission_contexts ctx on ctx.submission_id = s.id
                    left join users subject_user on subject_user.id = ctx.subject_user_id
                    where s.status = 'SUBMITTED'
                      and s.submitted_at >= :fromInstant
                      and s.submitted_at < :toInstant
                      and (:isAdmin = true or subject_user.department_id = :departmentId)
                ), aggregates as (
                    select form_version_id,
                           count(*) as total,
                           count(*) filter (where result_status = 'PASSED') as passed,
                           count(*) filter (where result_status in ('FAILED_SCORE', 'FAILED_CRITICAL')) as failed,
                           round(avg(converted_score)::numeric, 4) as average_converted_score,
                           max(submitted_at) as last_submitted_at
                    from scoped_submissions
                    group by form_version_id
                )
                select hv.*, coalesce(a.total, 0) as total,
                       coalesce(a.passed, 0) as passed,
                       coalesce(a.failed, 0) as failed,
                       a.average_converted_score,
                       case when coalesce(a.total, 0) = 0 then null
                            else round((a.passed * 100.0 / a.total)::numeric, 2)
                       end as compliance_rate,
                       a.last_submitted_at
                from history_versions hv
                left join aggregates a on a.form_version_id = hv.version_id
                order by hv.version_number desc, hv.version_id desc
                """, params, (rs, ignored) -> new FormVersionHistorySummaryResponse(
                rs.getLong("form_id"),
                rs.getLong("version_id"),
                rs.getInt("version_number"),
                rs.getString("title"),
                rs.getString("description"),
                vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus.valueOf(rs.getString("status")),
                instant(rs.getObject("published_at")),
                rs.getString("published_by"),
                rs.getLong("total"),
                rs.getLong("passed"),
                rs.getLong("failed"),
                decimal(rs.getObject("average_converted_score")),
                decimal(rs.getObject("compliance_rate")),
                instant(rs.getObject("last_submitted_at"))
        ));
    }

    @Transactional(readOnly = true)
    public FormVersionResponse getVersion(Long formId, Long versionId) {
        accessPolicy.requireFormAccess(formId);
        var version = versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        if (version.getStatus() != FormVersionStatus.PUBLISHED
                && version.getStatus() != FormVersionStatus.RETIRED) {
            throw new ResourceNotFoundException("Form version not found in history");
        }
        return versionService.get(formId, versionId);
    }

    private String eligibleFormsCte(FormHistoryAccessPolicy.Scope scope) {
        String assignmentCondition = scope.admin() ? "" : """
                  and exists (
                      select 1
                      from form_assignment_items fai
                      join form_assignments fa on fa.id = fai.assignment_id
                      where fai.form_template_id = f.id
                        and fa.manager_user_id = :actorId
                  )
                """;
        return """
                with eligible_versions as (
                    select fv.id as version_id, fv.form_template_id as form_id
                    from form_versions fv
                    where fv.status in ('PUBLISHED', 'RETIRED')
                ), eligible_forms as (
                    select f.id as form_id, f.code as form_code, f.title as form_title,
                           count(distinct ev.version_id) as version_count
                    from form_templates f
                    join eligible_versions ev on ev.form_id = f.id
                    where f.deleted = false
                      and (:keyword is null or lower(f.code) like :keyword or lower(f.title) like :keyword)
                """ + assignmentCondition + """
                    group by f.id, f.code, f.title
                )
                """;
    }

    private MapSqlParameterSource params(
            FormHistoryAccessPolicy.Scope scope, Period period, String keyword) {
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        return new MapSqlParameterSource()
                .addValue("actorId", scope.actorId(), Types.BIGINT)
                .addValue("isAdmin", scope.admin(), Types.BOOLEAN)
                .addValue("departmentId", scope.departmentId(), Types.BIGINT)
                .addValue("targetDepartmentId", scope.departmentId(), Types.BIGINT)
                .addValue("fromInstant", OffsetDateTime.ofInstant(period.from(), ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("toInstant", OffsetDateTime.ofInstant(period.to(), ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("keyword", normalizedKeyword, Types.VARCHAR);
    }

    private Period period(LocalDate dateFrom, LocalDate dateTo) {
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        LocalDate from = dateFrom == null ? LocalDate.of(today.getYear(), 1, 1) : dateFrom;
        LocalDate to = dateTo == null ? today : dateTo;
        if (from.isAfter(to)) {
            throw ValidationException.field("dateFrom", "Từ ngày không được sau đến ngày");
        }
        return new Period(
                from.atStartOfDay(BUSINESS_ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant());
    }

    private Pageable normalize(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(Math.max(pageable.getPageNumber(), 0), pageable.getPageSize());
    }

    private BigDecimal decimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal decimal) return decimal;
        return new BigDecimal(value.toString());
    }

    private Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        return ((Timestamp) value).toInstant();
    }

    private record Period(Instant from, Instant to) {}
}

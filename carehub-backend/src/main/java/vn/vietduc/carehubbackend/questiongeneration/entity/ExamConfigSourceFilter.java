package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_config_source_filters", uniqueConstraints = @UniqueConstraint(name = "uq_exam_config_source_filter", columnNames = {"exam_config_id", "filter_type", "reference_id"}))
public class ExamConfigSourceFilter extends BaseEntity {
    public enum FilterType { INCLUDE_CATEGORY, EXCLUDE_CATEGORY, INCLUDE_DOCUMENT, EXCLUDE_DOCUMENT }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @Enumerated(EnumType.STRING)
    @Column(name = "filter_type", nullable = false, length = 32)
    private FilterType filterType;

    @Column(name = "reference_id", nullable = false)
    private Long referenceId;
}

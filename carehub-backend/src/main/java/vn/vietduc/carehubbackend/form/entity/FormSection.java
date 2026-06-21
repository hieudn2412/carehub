package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.BatchSize;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_sections")
public class FormSection extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_version_id", nullable = false)
    private FormVersion formVersion;

    @Column(nullable = false)
    private UUID sectionKey;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "sort_order", nullable = false)
    private Integer displayOrder;

    @Builder.Default
    @BatchSize(size = 50)
    @OrderBy("displayOrder ASC")
    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FormQuestion> questions = new ArrayList<>();
}

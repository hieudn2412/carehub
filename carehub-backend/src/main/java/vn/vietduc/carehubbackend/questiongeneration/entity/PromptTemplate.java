package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
@Table(name = "prompt_templates")
public class PromptTemplate extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(nullable = false, length = 50)
    private String model;

    @Column(nullable = false)
    private Integer version;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "system_prompt", columnDefinition = "text")
    private String systemPrompt;

    @Column(name = "user_prompt_template", columnDefinition = "text", nullable = false)
    private String userPromptTemplate;

    @Column(name = "temperature", precision = 3, scale = 2)
    private java.math.BigDecimal temperature;

    @Column(name = "max_tokens")
    private Integer maxTokens;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "created_by", length = 100)
    private String createdBy;
}

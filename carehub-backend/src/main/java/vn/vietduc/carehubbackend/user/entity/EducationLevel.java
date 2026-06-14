package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "education_level")
public class EducationLevel extends BaseEntity {
    private String name;

    @OneToMany(mappedBy = "educationLevel")
    private List<User> users;
}

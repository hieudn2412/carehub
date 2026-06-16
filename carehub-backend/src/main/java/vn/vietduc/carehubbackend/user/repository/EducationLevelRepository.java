package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.EducationLevel;

import java.util.Collection;
import java.util.List;

public interface EducationLevelRepository extends JpaRepository<EducationLevel,Long> {
    boolean existsByEducationCode(String educationCode);
    boolean existsByEducationCodeAndIdNot(String educationCode, Long id);

    List<EducationLevel> findByEducationCodeIn(Collection<String> educationCodes);
}

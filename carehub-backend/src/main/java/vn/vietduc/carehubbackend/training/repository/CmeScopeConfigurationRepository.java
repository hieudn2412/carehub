package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;

import java.util.Optional;

public interface CmeScopeConfigurationRepository extends JpaRepository<CmeScopeConfiguration, Long> {
    @EntityGraph(attributePaths = "departments")
    Optional<CmeScopeConfiguration> findByScopeKey(String scopeKey);
}

package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.PromptTemplate;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, Long> {

    List<PromptTemplate> findByProviderAndModelOrderByVersionDesc(String provider, String model);

    Optional<PromptTemplate> findByProviderAndModelAndActiveTrue(String provider, String model);

    Optional<PromptTemplate> findByProviderAndModelAndVersion(String provider, String model, Integer version);

    List<PromptTemplate> findAllByOrderByUpdatedAtDesc();

    boolean existsByProviderAndModelAndVersion(String provider, String model, Integer version);
}

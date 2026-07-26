package vn.vietduc.carehubbackend.systemsettings.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.systemsettings.entity.SystemSetting;

import java.util.Optional;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, Long> {
    Optional<SystemSetting> findByScopeKey(String scopeKey);
}

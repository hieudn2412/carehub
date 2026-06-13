package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.Position;

public interface PositionRepository extends JpaRepository<Position,Long> {
}

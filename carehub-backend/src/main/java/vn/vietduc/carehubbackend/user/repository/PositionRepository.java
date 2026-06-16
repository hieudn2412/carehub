package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.Position;

import java.util.Collection;
import java.util.List;

public interface PositionRepository extends JpaRepository<Position,Long> {
    boolean existsByName(String name);
    boolean existsByNameAndIdNot(String name, Long id);

    List<Position> findByNameIn(Collection<String> names);
}

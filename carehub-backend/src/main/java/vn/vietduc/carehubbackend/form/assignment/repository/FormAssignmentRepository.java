package vn.vietduc.carehubbackend.form.assignment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignment;

public interface FormAssignmentRepository extends JpaRepository<FormAssignment, Long> {
    @EntityGraph(attributePaths = {"manager", "assignedBy"})
    @Query("""
            select a from FormAssignment a
            where (:managerId is null or a.manager.id = :managerId)
            order by a.assignedAt desc
            """)
    Page<FormAssignment> search(@Param("managerId") Long managerId, Pageable pageable);
}

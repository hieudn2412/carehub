package vn.vietduc.carehubbackend.form.service;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.form.entity.Form;

public interface FormRepository extends JpaRepository<Form,Long> {
}

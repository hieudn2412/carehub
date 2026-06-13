package vn.vietduc.carehubbackend.user.repository.custom;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;

public interface UserRepositoryCustom {
    Page<User> searchUsers(UserFilterRequest request, Pageable pageable);
    List<User> getAllUsersToExport(UserFilterRequest request);
}

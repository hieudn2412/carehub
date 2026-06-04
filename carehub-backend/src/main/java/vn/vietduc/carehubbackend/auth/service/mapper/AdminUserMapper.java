package vn.vietduc.carehubbackend.auth.service.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import vn.vietduc.carehubbackend.auth.dto.response.AdminUserSummaryResponse;
import vn.vietduc.carehubbackend.user.entity.User;

@Mapper(componentModel = "spring")
public interface AdminUserMapper extends EntityMapper<AdminUserSummaryResponse, User> {

    @Override
    @Mapping(target = "password", ignore = true)
    User toEntity(AdminUserSummaryResponse dto);
}
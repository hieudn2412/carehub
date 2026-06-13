package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.auth.service.JwtTokenService;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JwtTokenServiceImpl implements JwtTokenService {
    private final JwtEncoder jwtEncoder;
    private final UserRoleRepository userRoleRepository;

    @Value("${app.jwt.access-token-expiration-minutes}")
    private Long accessTokenExpiration;

    @Override
    public AccessTokenResult generateAccessToken(User user) {
        Instant now = Instant.now();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        List<String> roleCodes = userRoleRepository.findRolesByUserId(user.getId())
                .stream()
                .map(Role::getCode)
                .toList();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(String.valueOf(user.getId()))
                .claim("roles", roleCodes)
                .claim("employeeCode", user.getEmployeeCode())
                .issuedAt(now)
                .expiresAt(now.plus(accessTokenExpiration, ChronoUnit.MINUTES))
                .build();

        String tokenValue = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        return new AccessTokenResult(tokenValue, accessTokenExpiration * 60);
    }
}

package vn.vietduc.carehubbackend.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;

import java.util.Collection;
import java.util.List;
import java.util.stream.Stream;

@Component
public class CustomJwtAuthenticationConverter
        implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {

        Long userId = Long.valueOf(jwt.getSubject());

        String email = jwt.getClaimAsString("email");

        String employeeCode = jwt.getClaimAsString("employeeCode");

        List<String> roles = jwt.getClaimAsStringList("roles");

        List<String> permissions = jwt.getClaimAsStringList("permissions");

        Collection<GrantedAuthority> authorities = Stream.concat(
                        safeList(roles).stream().map(role -> "ROLE_" + role),
                        safeList(permissions).stream()
                )
                .distinct()
                .<GrantedAuthority>map(SimpleGrantedAuthority::new)
                .toList();

        UserPrincipal principal =
                new UserPrincipal(
                        userId,
                        email,
                        employeeCode,
                        authorities
                );

        return new UsernamePasswordAuthenticationToken(
                principal,
                jwt,
                authorities
        );
    }

    private List<String> safeList(List<String> values) {
        return values == null ? List.of() : values;
    }
}

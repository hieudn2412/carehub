package vn.vietduc.carehubbackend.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500)
    private String token;

    @Column(name = "session_id", unique = true, length = 64)
    private String sessionId;

    @Column(nullable = false)
    @Builder.Default
    private Integer generation = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    @Builder.Default
    private Boolean revoked = false;

    @Column(name = "expired_at", nullable = false)
    private LocalDateTime expiredAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "first_login_session", nullable = false)
    @Builder.Default
    private Boolean firstLoginSession = false;

    @Transient
    private String issuedToken;

    public String getToken() {
        return issuedToken != null ? issuedToken : token;
    }

    public void revoke(LocalDateTime now) {
        this.revoked = true;
        this.revokedAt = now;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.revoked == null) {
            this.revoked = false;
        }
        if (this.generation == null) {
            this.generation = 0;
        }
        if (this.firstLoginSession == null) {
            this.firstLoginSession = false;
        }
    }
}

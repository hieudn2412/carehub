package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "training_hours",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_training_hours",
                        columnNames = {
                                "ma_vd",
                                "dau_thoi_gian"
                        }
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingHour {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dau_thoi_gian", nullable = false)
    private String dauThoiGian;

    @Column(name = "ma_vd", nullable = false)
    private String maVd;

    @Column(name = "ho_va_ten")
    private String hoVaTen;

    @Column(name = "ngay_sinh")
    private String ngaySinh;

    @Column(name = "chuong_trinh_dao_tao", columnDefinition = "TEXT")
    private String chuongTrinhDaoTao;

    @Column(name = "thoi_gian_dao_tao")
    private String thoiGianDaoTao;

    @Column(name = "so_tiet_dao_tao")
    private String soTietDaoTao;

    @Column(name = "giay_chung_nhan")
    private String giayChungNhan;

    @Column(name = "chuc_danh")
    private String chucDanh;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
